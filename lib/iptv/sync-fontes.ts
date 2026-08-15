import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { detectCategory } from "@/lib/iptv/category-detector";
import { fetchXtreamPlaylist } from "@/lib/iptv/xtream-client";
import { normalizeTitleKey, slugify } from "@/lib/utils";

/**
 * Sincroniza o catálogo de CADA servidor e unifica num acervo só.
 *
 * ------------------------------------------------------------------
 * O QUE FALTAVA
 * ------------------------------------------------------------------
 * A sincronização antiga importava UMA playlist e não sabia de qual servidor o
 * conteúdo tinha vindo. Com várias linhas, isso dava dois problemas ao mesmo
 * tempo:
 *
 *  - o mesmo canal vindo de três servidores virava três itens repetidos na
 *    grade, porque nada dizia que eram o mesmo conteúdo;
 *  - o conteúdo exclusivo de um servidor não podia ser distinguido, então não
 *    havia como saber para onde mandar quem clicasse nele.
 *
 * Aqui a chave de unificação é o `nameKey` (nome normalizado, sem tag de
 * qualidade nem dublagem). Dois servidores com "Globo HD" e "GLOBO FHD"
 * produzem UM canal "Globo" com DUAS fontes. Um servidor que tem algo que
 * ninguém mais tem produz um canal com UMA fonte — que é a definição de
 * exclusivo, sem precisar de campo próprio.
 *
 * O `M3uChannel` passa a ser o conteúdo canônico; o endereço de cada servidor
 * vive em `ChannelSource`.
 */

export type RelatorioFontes = {
  servidor: string;
  itensLidos: number;
  canaisNovos: number;
  fontesGravadas: number;
  erro?: string;
};

/** Itens processados por lote. Mantém a memória constante em lista grande. */
const LOTE = 1000;

/**
 * Sincroniza uma linha e devolve o que ela acrescentou ao acervo.
 *
 * Não apaga nada: fonte que sumiu apenas deixa de ter `vistoEm` atualizado, e
 * a varredura de fontes velhas é decisão separada (ver `varrerFontesMortas`).
 * Apagar durante a sincronização é como o catálogo já sumiu inteiro uma vez:
 * uma leitura parcial da lista do provedor viraria remoção em massa.
 */
export async function sincronizarFontesDaLinha(linha: {
  id: string;
  label: string;
  serverCode: string;
  serverUrl: string;
  username: string;
  password: string;
}): Promise<RelatorioFontes> {
  const relatorio: RelatorioFontes = {
    servidor: linha.serverCode,
    itensLidos: 0,
    canaisNovos: 0,
    fontesGravadas: 0,
  };

  const playlistDoSistema = await prisma.m3uPlaylist.findFirst({
    where: { isSystem: true },
    select: { id: true },
  });

  if (!playlistDoSistema) {
    relatorio.erro = "Nenhuma playlist marcada como isSystem.";
    return relatorio;
  }

  let parsed;
  try {
    parsed = await fetchXtreamPlaylist(linha.serverUrl, linha.username, linha.password);
  } catch (erro) {
    relatorio.erro = erro instanceof Error ? erro.message : "Falha ao ler o servidor";
    return relatorio;
  }

  const itens = parsed?.channels ?? [];
  relatorio.itensLidos = itens.length;
  if (itens.length === 0) return relatorio;

  const playlistId = playlistDoSistema.id;

  for (let i = 0; i < itens.length; i += LOTE) {
    const lote = itens.slice(i, i + LOTE);

    // Chave de unificação por item, descartando o que normaliza para nada.
    const preparados = lote
      .map((ch) => ({ ch, chave: normalizeTitleKey(ch.name) }))
      .filter((p) => p.chave.length > 0);

    if (preparados.length === 0) continue;

    /**
     * Uma consulta por lote para descobrir o que já existe.
     *
     * Consultar por item seriam mil idas ao banco por lote. O índice
     * (playlistId, nameKey) já existe e é exatamente o que esta busca usa.
     */
    const existentes = await prisma.m3uChannel.findMany({
      where: { playlistId, nameKey: { in: preparados.map((p) => p.chave) } },
      select: { id: true, nameKey: true },
    });

    const idPorChave = new Map(existentes.map((e) => [e.nameKey ?? "", e.id]));

    // 1. Cria os canais que ainda não existem em NENHUM servidor.
    const novos = preparados.filter((p) => !idPorChave.has(p.chave));
    if (novos.length > 0) {
      // Dedup dentro do próprio lote: a lista do provedor repete o mesmo
      // título em qualidades diferentes, e sem isto o createMany viola a
      // restrição única na metade do lote.
      const unicos = new Map<string, (typeof novos)[number]>();
      for (const n of novos) if (!unicos.has(n.chave)) unicos.set(n.chave, n);

      const grupos = await garantirGrupos(playlistId, [...unicos.values()].map((n) => n.ch));

      await prisma.m3uChannel.createMany({
        data: [...unicos.values()].map(({ ch, chave }) => ({
          playlistId,
          groupId: grupos.get(ch.groupTitle) ?? null,
          name: ch.name,
          nameKey: chave,
          streamUrl: ch.streamUrl,
          logoUrl: ch.logoUrl,
          tvgId: ch.tvgId,
          quality: ch.quality,
          isActive: true,
        })),
        skipDuplicates: true,
      });

      relatorio.canaisNovos += unicos.size;

      const recemCriados = await prisma.m3uChannel.findMany({
        where: { playlistId, nameKey: { in: [...unicos.keys()] } },
        select: { id: true, nameKey: true },
      });
      for (const c of recemCriados) idPorChave.set(c.nameKey ?? "", c.id);
    }

    // 2. Grava a fonte: este servidor tem este conteúdo, neste endereço.
    const valores: Prisma.Sql[] = [];
    const jaNoLote = new Set<string>();

    for (const { ch, chave } of preparados) {
      const channelId = idPorChave.get(chave);
      if (!channelId || jaNoLote.has(channelId)) continue;
      jaNoLote.add(channelId);
      valores.push(
        Prisma.sql`(gen_random_uuid()::text, ${channelId}, ${linha.serverCode}, ${ch.streamUrl}, now(), now())`,
      );
    }

    if (valores.length > 0) {
      /**
       * `ON CONFLICT ... DO UPDATE` em vez de upsert item a item.
       *
       * São dezenas de milhares de fontes por servidor; um upsert do Prisma
       * por item seria uma ida ao banco por linha. Aqui o lote inteiro vai
       * numa instrução, e o conflito atualiza o endereço e o `vistoEm` — que é
       * como uma fonte que mudou de id no painel se conserta sozinha.
       */
      const gravadas = await prisma.$executeRaw`
        INSERT INTO "ChannelSource" ("id", "channelId", "serverCode", "streamUrl", "vistoEm", "criadoEm")
        VALUES ${Prisma.join(valores)}
        ON CONFLICT ("channelId", "serverCode")
        DO UPDATE SET "streamUrl" = EXCLUDED."streamUrl", "vistoEm" = now()
      `;
      relatorio.fontesGravadas += gravadas;
    }

    // Devolve o event loop: a sincronização não pode deixar o site sem resposta.
    await new Promise((r) => setTimeout(r, 15));
  }

  return relatorio;
}

/** Garante que os grupos do lote existem e devolve nome -> id. */
async function garantirGrupos(
  playlistId: string,
  itens: Array<{ name: string; groupTitle: string; streamUrl: string }>,
): Promise<Map<string, string>> {
  const nomes = [...new Set(itens.map((i) => i.groupTitle).filter(Boolean))];
  if (nomes.length === 0) return new Map();

  const amostra = new Map<string, { name: string; streamUrl: string }>();
  for (const i of itens) {
    if (!amostra.has(i.groupTitle)) {
      amostra.set(i.groupTitle, { name: i.name, streamUrl: i.streamUrl });
    }
  }

  await prisma.m3uGroup.createMany({
    data: nomes.map((nome, idx) => {
      const ex = amostra.get(nome);
      const categoria = detectCategory(nome, ex?.name ?? "", ex?.streamUrl ?? "");
      return {
        playlistId,
        name: nome,
        slug: slugify(nome) || `grupo-${idx}`,
        category: categoria,
        // Adulto nasce oculto. Liberar é ato explícito no painel, nunca padrão.
        isHidden: categoria === "adult",
      };
    }),
    skipDuplicates: true,
  });

  const grupos = await prisma.m3uGroup.findMany({
    where: { playlistId, name: { in: nomes } },
    select: { id: true, name: true },
  });

  return new Map(grupos.map((g) => [g.name, g.id]));
}

/**
 * Remove fontes que nenhum servidor confirma há muito tempo.
 *
 * Separado da sincronização de propósito: apagar durante a leitura da lista
 * transforma uma resposta parcial do provedor em remoção em massa — foi assim
 * que o catálogo já sumiu inteiro uma vez neste projeto.
 *
 * O canal em si NÃO é apagado aqui. Ele pode continuar existindo em outro
 * servidor; e mesmo sem nenhuma fonte, apagá-lo levaria junto o favorito e o
 * progresso do assinante.
 */
export async function varrerFontesMortas(diasSemVer = 7): Promise<number> {
  const corte = new Date(Date.now() - diasSemVer * 24 * 60 * 60 * 1000);
  const res = await prisma.channelSource.deleteMany({
    where: { vistoEm: { lt: corte } },
  });
  return res.count;
}
