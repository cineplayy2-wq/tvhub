import "server-only";

import { invalidatePlaylistCache } from "@/lib/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeTitleKey, slugify } from "@/lib/utils";
import { detectCategory } from "./category-detector";
import {
  parseM3u,
  parseM3uStream,
  streamM3uUrlPairs,
  type ItemDeBackup,
} from "./m3u-parser";
import { fetchXtreamPlaylist } from "./xtream-client";
import { isTmdbConfigured, searchTmdb, tmdbImage } from "@/lib/tmdb/client";
import { categorizeGroupsWithAi } from "@/lib/ai/client";

import type { M3uPlaylist } from "@prisma/client";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
};

/** Pausa assíncrona para liberar o Event Loop do Node.js e permitir que o site responda a usuários sem travar */
const yieldToEventLoop = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Teto de canais importados por lista.
 *
 * Este número precisa chegar ao PARSER, não só ao corte depois dele. Lendo a
 * M3U inteira para só então fatiar, o pico de memória é o da lista completa —
 * 150 mil objetos de canal — e o contêiner tem 240MB de heap. Era esse pico
 * que vinha matando a sincronização no meio e deixando o catálogo pela metade.
 */
const MAX_CANAIS_POR_LISTA = 60000;

/**
 * Teto de itens que a lista SECUNDÁRIA acrescenta ao catálogo.
 *
 * A segunda M3U não é só reserva: o que existe só nela também tem que aparecer.
 * Mas ela tem mais de 300 mil itens e o Postgres divide a VPS com outro sistema
 * em produção, então a soma precisa de um limite explícito. O que não couber é
 * registrado no log — nunca cortado em silêncio.
 */
const MAX_EXTRAS_DA_SECUNDARIA = 40000;

/**
 * Vincula as URLs da lista de backup aos canais já importados.
 * Processamento fracionado em lotes leves para evitar picos de memória e CPU.
 */
export async function vincularBackup(
  playlist: M3uPlaylist,
  opcoes: { unir?: boolean; tetoUniao?: number } = {},
): Promise<{
  vinculados: number;
  analisados: number;
  canaisNoBackup: number;
  adicionados: number;
  disponiveis: number;
}> {
  const canaisNoBackup = await estagiarBackup(playlist);
  if (canaisNoBackup === 0) {
    return { vinculados: 0, analisados: 0, canaisNoBackup: 0, adicionados: 0, disponiveis: 0 };
  }

  try {
    // Uma consulta só: o casamento acontece pelo índice (playlistId, nameKey).
    // Antes isso era um laço em JS paginando o catálogo inteiro e montando
    // mapas — dezenas de idas ao banco e memória proporcional ao catálogo.
    const vinculados = await prisma.$executeRaw`
      UPDATE "M3uChannel" AS c
      SET "backupStreamUrl" = s.url
      FROM (
        SELECT DISTINCT ON ("chave") "chave", "url"
        FROM "M3uBackupStage"
        WHERE "playlistId" = ${playlist.id}
      ) AS s
      WHERE c."playlistId" = ${playlist.id}
        AND c."nameKey" = s."chave"
        AND c."backupStreamUrl" IS DISTINCT FROM s.url
    `;

    const analisados = await prisma.m3uChannel.count({
      where: { playlistId: playlist.id },
    });

    console.log(`[m3u] backup vinculado em ${vinculados} de ${analisados} canais`);

    // A união precisa do estágio ainda preenchido, por isso roda aqui dentro,
    // antes do `finally` que o limpa.
    const uniao = opcoes.unir
      ? await unirConteudoDaSecundaria(playlist, opcoes.tetoUniao ?? MAX_EXTRAS_DA_SECUNDARIA)
      : { adicionados: 0, disponiveis: 0 };

    return { vinculados, analisados, canaisNoBackup, ...uniao };
  } finally {
    await limparEstagioDeBackup(playlist.id);
  }
}

/**
 * Traz para o catálogo o que existe SÓ na lista secundária.
 *
 * A segunda M3U não serve apenas de reserva: ela costuma ter títulos que a
 * principal não tem. Sem este passo, esse conteúdo fica invisível para o
 * assinante mesmo estando disponível.
 *
 * Roda inteiramente dentro do Postgres — nenhuma linha passa pela memória do
 * app. Os grupos que faltam são criados a partir do próprio nome de grupo da
 * lista secundária, e a categoria sai do formato da URL, que é o sinal mais
 * confiável (`/movie/`, `/series/`, o resto é ao vivo).
 *
 * O teto existe para a soma não explodir: a lista secundária tem mais de 300
 * mil itens e o banco divide a VPS com outro sistema em produção. O que sobrar
 * do teto é registrado no log, nunca descartado em silêncio.
 */
async function unirConteudoDaSecundaria(
  playlist: M3uPlaylist,
  teto: number,
): Promise<{ adicionados: number; disponiveis: number }> {
  /**
   * Trava contra duplicação em massa.
   *
   * A união decide o que falta comparando `nameKey`. Se houver canal com a
   * chave nula, ele não casa com nada da secundária e o conteúdo dele seria
   * reinserido como se fosse novidade — duplicando o catálogo inteiro. A chave
   * só fica completa depois de uma sincronização, então antes disso a união
   * simplesmente não roda.
   */
  const [{ semChave }] = await prisma.$queryRaw<Array<{ semChave: number }>>`
    SELECT COUNT(*)::int AS "semChave"
    FROM "M3uChannel"
    WHERE "playlistId" = ${playlist.id} AND "nameKey" IS NULL
  `;

  if (semChave > 0) {
    console.warn(
      `[m3u] uniao adiada: ${semChave} canais ainda sem nameKey. ` +
        `Rode uma sincronizacao completa primeiro.`,
    );
    return { adicionados: 0, disponiveis: 0 };
  }

  const [{ disponiveis }] = await prisma.$queryRaw<Array<{ disponiveis: number }>>`
    SELECT COUNT(*)::int AS disponiveis
    FROM (
      SELECT DISTINCT s."chave"
      FROM "M3uBackupStage" s
      WHERE s."playlistId" = ${playlist.id}
        AND s."nome" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "M3uChannel" c
          WHERE c."playlistId" = ${playlist.id} AND c."nameKey" = s."chave"
        )
    ) AS q
  `;

  if (disponiveis === 0) return { adicionados: 0, disponiveis: 0 };

  // Cria os grupos que ainda não existem, com categoria deduzida da URL.
  await prisma.$executeRaw`
    INSERT INTO "M3uGroup" ("id", "playlistId", "name", "slug", "category", "sortOrder", "isHidden")
    SELECT
      gen_random_uuid()::text,
      ${playlist.id},
      g.grupo,
      lower(regexp_replace(g.grupo, '[^a-zA-Z0-9]+', '-', 'g')),
      g.categoria,
      9000,
      false
    FROM (
      -- Uma linha por grupo, com a categoria PREDOMINANTE dele.
      --
      -- DISTINCT (grupo, categoria) parecia certo e nao era: um mesmo grupo
      -- costuma misturar URLs de tipos diferentes -- o grupo "SBT" tem tanto
      -- /movie/ quanto /series/ --, entao ele saia duas vezes e batia na
      -- restricao unica (playlistId, name). O mode() resolve escolhendo o tipo
      -- que mais aparece, que tambem e a classificacao mais fiel do grupo.
      SELECT
        s."grupo" AS grupo,
        mode() WITHIN GROUP (ORDER BY
          CASE
            WHEN s."url" LIKE '%/movie/%'  THEN 'movies'
            WHEN s."url" LIKE '%/series/%' THEN 'series'
            ELSE 'live'
          END
        ) AS categoria
      FROM "M3uBackupStage" s
      WHERE s."playlistId" = ${playlist.id} AND s."grupo" IS NOT NULL
      GROUP BY s."grupo"
    ) AS g
    ON CONFLICT ("playlistId", "name") DO NOTHING
  `;

  const adicionados = await prisma.$executeRaw`
    INSERT INTO "M3uChannel" (
      "id", "playlistId", "groupId", "name", "streamUrl", "nameKey", "fromBackup",
      "isActive", "isFavorite", "sortOrder", "relevanceScore", "createdAt"
    )
    SELECT
      gen_random_uuid()::text,
      ${playlist.id},
      grp."id",
      s."nome",
      s."url",
      s."chave",
      true,
      true, false, 9000, 0, now()
    FROM (
      SELECT DISTINCT ON ("chave") "chave", "nome", "url", "grupo"
      FROM "M3uBackupStage"
      WHERE "playlistId" = ${playlist.id} AND "nome" IS NOT NULL
      ORDER BY "chave", "nome"
    ) AS s
    LEFT JOIN "M3uGroup" grp
      ON grp."playlistId" = ${playlist.id} AND grp."name" = s."grupo"
    WHERE NOT EXISTS (
      SELECT 1 FROM "M3uChannel" c
      WHERE c."playlistId" = ${playlist.id} AND c."nameKey" = s."chave"
    )
    LIMIT ${teto}
  `;

  if (disponiveis > adicionados) {
    console.log(
      `[m3u] uniao: ${adicionados} itens exclusivos da secundaria adicionados; ` +
        `${disponiveis - adicionados} ficaram de fora pelo teto de ${teto}`,
    );
  } else {
    console.log(`[m3u] uniao: ${adicionados} itens exclusivos da secundaria adicionados`);
  }

  return { adicionados, disponiveis };
}

/**
 * Revincula só o backup, sem reimportar o catálogo.
 */
export async function revincularBackup(playlist: M3uPlaylist) {
  const resultado = await vincularBackup(playlist, { unir: true });

  await prisma.m3uPlaylist.update({
    where: { id: playlist.id },
    data: {
      syncStatus: "SYNCED",
      lastSyncError: null,
      nextSyncAt:
        playlist.autoSyncHours > 0
          ? new Date(Date.now() + playlist.autoSyncHours * 60 * 60 * 1000)
          : null,
    },
  });

  await invalidatePlaylistCache(playlist.id);
  return resultado;
}

/**
 * Sincroniza uma playlist M3U primária e vincula a lista secundária de backup.
 * 
 * MELHORIA DE ALTA PERFORMANCE & ESCALABILIDADE (PERSISTÊNCIA DE IDS & ZERO DOWNTIME):
 * 1. Trava de concorrência se a lista já estiver sincronizando.
 * 2. Manutenção de IDs Existentes: Os canais mantêm exatamente o mesmo ID no banco,
 *    eliminando links quebrados, páginas não encontradas (404) e preservando favoritos.
 * 3. Atualização sem Indisponibilidade: Nenhum canal é deletado antes que a nova carga
 *    esteja salva e pronta.
 * 4. Processamento fracionado em lotes leves de 1.000 itens com micro-pausas (25ms),
 *    mantendo o servidor extremamente rápido e responsivo.
 */
export async function syncPlaylist(playlist: M3uPlaylist): Promise<{
  totalChannels: number;
  totalGroups: number;
  error?: string;
}> {
  // Trava de Concorrência: Evita execuções duplicadas para a mesma lista em menos de 10 minutos
  if (
    playlist.syncStatus === "SYNCING" &&
    playlist.lastSyncAt &&
    Date.now() - playlist.lastSyncAt.getTime() < 10 * 60 * 1000
  ) {
    console.log(`[m3u] Lista ${playlist.id} já está sincronizando. Ignorando chamada simultânea.`);
    return {
      totalChannels: playlist.totalChannels,
      totalGroups: playlist.totalGroups,
    };
  }

  await prisma.m3uPlaylist.update({
    where: { id: playlist.id },
    data: { syncStatus: "SYNCING", lastSyncError: null },
  });

  try {
    // 1. Buscar e parsear a lista primária
    const parsed = await fetchAndParse(playlist);

    if (!parsed || parsed.channels.length === 0) {
      throw new Error("Nenhum canal ou conteúdo foi encontrado nesta lista M3U.");
    }

    // O corte já acontece dentro do parser (ver MAX_CANAIS_POR_LISTA); aqui é
    // só uma garantia para as fontes que não passam pelo caminho em fluxo.
    const maxChannels = Math.min(parsed.channels.length, MAX_CANAIS_POR_LISTA);
    const incomingChannels = parsed.channels.slice(0, maxChannels);

    // Tenta enriquecer canais/filmes/séries sem logo via TMDB em segundo plano
    void enrichChannelsWithTmdb(incomingChannels).catch(() => {});

    // 2. Mapeia os canais existentes no banco para PRESERVAR OS IDS (Evita erros 404 e links quebrados!)
    const existingChannels = await prisma.m3uChannel.findMany({
      where: { playlistId: playlist.id },
      select: { id: true, streamUrl: true, name: true, fromBackup: true },
    });

    const existingByUrl = new Map<string, string>();
    const existingByName = new Map<string, string>();
    const usedExistingIds = new Set<string>();

    for (const ch of existingChannels) {
      if (ch.streamUrl) existingByUrl.set(ch.streamUrl, ch.id);
      const nameKey = normalizeTitleKey(ch.name);
      if (nameKey) existingByName.set(nameKey, ch.id);
    }

    // 3. Criar / Atualizar Grupos
    const sampleChannelPerGroup = new Map<string, { name: string; streamUrl: string }>();
    for (const ch of incomingChannels) {
      if (!sampleChannelPerGroup.has(ch.groupTitle)) {
        sampleChannelPerGroup.set(ch.groupTitle, { name: ch.name, streamUrl: ch.streamUrl });
      }
    }

    const groupsForAi = parsed.groups.map((groupName) => ({
      name: groupName,
      sampleChannel: sampleChannelPerGroup.get(groupName)?.name || "",
    }));

    let aiCategories: Record<string, string> = {};
    try {
      aiCategories = await categorizeGroupsWithAi(groupsForAi.slice(0, 60));
    } catch {}

    const groupDataList = parsed.groups.map((groupName, index) => {
      const sample = sampleChannelPerGroup.get(groupName);
      const baseCategory = detectCategory(groupName, sample?.name || "", sample?.streamUrl || "");
      const finalCategory = aiCategories[groupName] || baseCategory;

      return {
        playlistId: playlist.id,
        name: groupName,
        slug: slugify(groupName) || `grupo-${index}`,
        category: finalCategory,
        sortOrder: index,
      };
    });

    await prisma.m3uGroup.createMany({
      data: groupDataList,
      skipDuplicates: true,
    });

    const createdGroups = await prisma.m3uGroup.findMany({
      where: { playlistId: playlist.id },
      select: { id: true, name: true },
    });

    const groupMap = new Map<string, string>();
    for (const g of createdGroups) {
      groupMap.set(g.name, g.id);
    }

    // 4. Separar canais entre NOVOS e EXISTENTES (para atualizar sem alterar IDs)
    const newChannelsToInsert: Array<any> = [];

    /**
     * Canais preservados que ainda não têm `nameKey`.
     *
     * A coluna é nova: as linhas gravadas antes dela estão com NULL, e sem
     * chave elas não casam com a lista secundária — nem para failover nem para
     * a união. Como o ID é preservado, uma reimportação sozinha não corrige;
     * é preciso preencher explicitamente.
     */
    const chavesAtrasadas: Array<[string, string]> = [];

    for (let idx = 0; idx < incomingChannels.length; idx++) {
      const ch = incomingChannels[idx];
      const nameKey = normalizeTitleKey(ch.name);
      const existingId = existingByUrl.get(ch.streamUrl) || existingByName.get(nameKey);

      if (existingId && !usedExistingIds.has(existingId)) {
        usedExistingIds.add(existingId);
        // Canal já existe: ID é preservado!
        //
        // Grava a chave mesmo quando ela sai vazia. Alguns nomes são só
        // símbolos ou números e normalizam para nada; se esses ficassem em
        // NULL, "ainda falta chavear" e "não dá para chavear" virariam a mesma
        // coisa — e a trava da união, que olha justamente para o NULL, ficaria
        // presa para sempre por causa de algumas dezenas de linhas.
        chavesAtrasadas.push([existingId, nameKey ?? ""]);
      } else {
        newChannelsToInsert.push({
          playlistId: playlist.id,
          groupId: groupMap.get(ch.groupTitle) ?? null,
          name: ch.name,
          nameKey,
          streamUrl: ch.streamUrl,
          logoUrl: ch.logoUrl,
          tvgId: ch.tvgId,
          tvgName: ch.tvgName,
          quality: ch.quality,
          language: ch.language,
          country: ch.country,
          sortOrder: idx,
          relevanceScore: calculateRelevance(ch.quality, ch.name),
        });
      }
    }

    // Preenche a chave dos canais preservados que ainda estão sem ela.
    for (let i = 0; i < chavesAtrasadas.length; i += 1000) {
      const bloco = chavesAtrasadas.slice(i, i + 1000);
      const values = Prisma.join(bloco.map(([id, k]) => Prisma.sql`(${id}, ${k})`));
      await prisma.$executeRaw`
        UPDATE "M3uChannel" AS c
        SET "nameKey" = v.chave
        FROM (VALUES ${values}) AS v(id, chave)
        WHERE c.id = v.id AND c."nameKey" IS DISTINCT FROM v.chave
      `;
      await yieldToEventLoop(15);
    }

    // Inserir novos canais em lotes leves de 1.000 itens com pausa de Event Loop
    const BATCH_SIZE = 1000;
    for (let i = 0; i < newChannelsToInsert.length; i += BATCH_SIZE) {
      const batch = newChannelsToInsert.slice(i, i + BATCH_SIZE);
      await prisma.m3uChannel.createMany({
        data: batch,
      });
      await yieldToEventLoop(25);
    }

    /**
     * 5. Apagar os canais antigos que não existem mais na lista principal.
     *
     * Vem ANTES da união de propósito. A união se recusa a rodar enquanto
     * houver canal sem `nameKey`, e canal obsoleto nunca recebe chave (ele não
     * está na lista nova). Limpando primeiro, a união encontra o catálogo todo
     * chaveado e resolve numa única sincronização.
     *
     * O que veio da lista secundária é preservado: não estar na principal é
     * justamente a razão de existir desse conteúdo.
     */
    const obsoleteIds = existingChannels
      .filter((c) => !usedExistingIds.has(c.id) && !c.fromBackup)
      .map((c) => c.id);

    if (obsoleteIds.length > 0) {
      const DELETE_BATCH = 4000;
      for (let i = 0; i < obsoleteIds.length; i += DELETE_BATCH) {
        const batchIds = obsoleteIds.slice(i, i + DELETE_BATCH);
        await prisma.m3uChannel.deleteMany({
          where: { id: { in: batchIds } },
        });
        await yieldToEventLoop(20);
      }
    }

    // 6. Vincular a Lista de Backup (secundária) E trazer o que só existe nela
    try {
      await vincularBackup(playlist, { unir: true });
    } catch (backupErr) {
      console.warn("[m3u] falha ao sincronizar lista de backup:", backupErr);
    }

    const nextSync =
      playlist.autoSyncHours > 0
        ? new Date(Date.now() + playlist.autoSyncHours * 60 * 60 * 1000)
        : null;

    await prisma.m3uPlaylist.update({
      where: { id: playlist.id },
      data: {
        syncStatus: "SYNCED",
        lastSyncAt: new Date(),
        lastSyncError: null,
        totalChannels: incomingChannels.length,
        totalGroups: parsed.groups.length,
        nextSyncAt: nextSync,
      },
    });

    await invalidatePlaylistCache(playlist.id);

    return {
      totalChannels: incomingChannels.length,
      totalGroups: parsed.groups.length,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido ao sincronizar";

    await markSyncFailed(playlist.id, errorMessage);

    return { totalChannels: 0, totalGroups: 0, error: errorMessage };
  }
}

async function markSyncFailed(playlistId: string, errorMessage: string) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.m3uPlaylist.update({
        where: { id: playlistId },
        data: {
          syncStatus: "ERROR",
          lastSyncAt: new Date(),
          lastSyncError: errorMessage.slice(0, 500),
        },
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }

  console.error(
    `[m3u] não foi possível registrar a falha de sincronização da lista ${playlistId}`,
  );
}

/**
 * Descarrega a lista de backup numa tabela de estágio no Postgres.
 *
 * O casamento entre as duas listas é por nome, e a lista de backup tem 200 mil
 * canais. Manter esse índice em memória custa ~150MB — inviável num contêiner
 * de 240MB de heap onde o app dos assinantes já mora. Então o índice vive no
 * banco: a leitura é em fluxo e cada lote é inserido e esquecido, deixando o
 * consumo de memória constante e independente do tamanho da lista.
 *
 * A tabela é UNLOGGED (não vai para o WAL: é dado descartável) e as linhas são
 * apagadas no fim, em `limparEstagioDeBackup`.
 */
async function estagiarBackup(playlist: M3uPlaylist): Promise<number> {
  await prisma.$executeRawUnsafe(`
    CREATE UNLOGGED TABLE IF NOT EXISTS "M3uBackupStage" (
      "playlistId" TEXT NOT NULL,
      "chave"      TEXT NOT NULL,
      "url"        TEXT NOT NULL
    )`);
  // Colunas acrescentadas depois: a tabela pode já existir em produção sem elas.
  await prisma.$executeRawUnsafe(`ALTER TABLE "M3uBackupStage" ADD COLUMN IF NOT EXISTS "nome" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "M3uBackupStage" ADD COLUMN IF NOT EXISTS "grupo" TEXT`);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "M3uBackupStage_playlist_chave_idx"
      ON "M3uBackupStage" ("playlistId", "chave")`);

  await limparEstagioDeBackup(playlist.id);

  const gravarLote = async (lote: ItemDeBackup[]) => {
    const values = Prisma.join(
      lote.map(
        (i) => Prisma.sql`(${playlist.id}, ${i.chave}, ${i.url}, ${i.nome}, ${i.grupo})`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO "M3uBackupStage" ("playlistId", "chave", "url", "nome", "grupo")
      VALUES ${values}
    `;
    await yieldToEventLoop(10);
  };

  if (playlist.backupSourceUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180_000);

    try {
      const response = await fetch(playlist.backupSourceUrl, {
        headers: DEFAULT_HEADERS,
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok || !response.body) return 0;
      return await streamM3uUrlPairs(response.body, normalizeTitleKey, gravarLote);
    } catch (erro) {
      console.warn("[m3u] falha ao baixar a lista de backup:", erro);
      await limparEstagioDeBackup(playlist.id);
      return 0;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (
    playlist.backupXtreamServer &&
    playlist.backupXtreamUsername &&
    playlist.backupXtreamPassword
  ) {
    const parsed = await fetchXtreamPlaylist(
      playlist.backupXtreamServer,
      playlist.backupXtreamUsername,
      playlist.backupXtreamPassword,
    );

    let total = 0;
    let lote: ItemDeBackup[] = [];
    for (const ch of parsed?.channels ?? []) {
      const chave = normalizeTitleKey(ch.name);
      if (!chave) continue;
      lote.push({ chave, nome: ch.name, url: ch.streamUrl, grupo: ch.groupTitle });
      total++;
      if (lote.length >= 2000) {
        await gravarLote(lote);
        lote = [];
      }
    }
    if (lote.length > 0) await gravarLote(lote);
    return total;
  }

  return 0;
}

async function limparEstagioDeBackup(playlistId: string) {
  try {
    await prisma.$executeRaw`DELETE FROM "M3uBackupStage" WHERE "playlistId" = ${playlistId}`;
  } catch {
    // A tabela pode nem existir ainda; não é motivo para derrubar a operação.
  }
}

async function fetchAndParse(playlist: M3uPlaylist) {
  switch (playlist.sourceType) {
    case "RAW_TEXT": {
      if (!playlist.rawContent) {
        throw new Error("Conteúdo M3U não informado");
      }
      return parseM3u(playlist.rawContent);
    }

    case "URL": {
      if (!playlist.sourceUrl) {
        throw new Error("URL da M3U não informada");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(playlist.sourceUrl, {
          headers: DEFAULT_HEADERS,
          signal: controller.signal,
          next: { revalidate: 0 },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Falha ao baixar M3U: HTTP ${response.status}`);
        }

        if (response.body) {
          return await parseM3uStream(response.body, MAX_CANAIS_POR_LISTA);
        }

        const text = await response.text();
        return parseM3u(text);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("O servidor da M3U demorou mais de 60 segundos para responder (Timeout).");
        }
        throw err;
      }
    }

    case "XTREAM": {
      if (!playlist.xtreamServer || !playlist.xtreamUsername || !playlist.xtreamPassword) {
        throw new Error("Credenciais Xtream incompletas");
      }
      return fetchXtreamPlaylist(
        playlist.xtreamServer,
        playlist.xtreamUsername,
        playlist.xtreamPassword,
      );
    }

    default:
      throw new Error(`Tipo de fonte não suportado: ${playlist.sourceType}`);
  }
}

function calculateRelevance(quality: string | null, name: string): number {
  let score = 50;
  if (quality === "4K") score += 40;
  else if (quality === "FHD") score += 30;
  else if (quality === "HD") score += 20;

  if (name.length < 20) score += 10;
  if (name.length < 10) score += 5;

  return Math.min(score, 100);
}

function cleanNameForTmdb(rawName: string): string {
  return rawName
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/\b(4K|FHD|HD|SD|UHD|DUBLADO|DUB|LEGENDADO|LEG|NACIONAL|PT|BR)\b/gi, "")
    .replace(/\b(S\d+E\d+|T\d+E\d+|EP\d+|TEMPORADA \d+)\b/gi, "")
    .replace(/[\-\|_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function enrichChannelsWithTmdb(
  channels: Array<{ name: string; logoUrl: string | null }>,
) {
  if (!isTmdbConfigured()) return;

  const candidates = channels.filter((c) => !c.logoUrl).slice(0, 50);
  if (candidates.length === 0) return;

  await Promise.all(
    candidates.map(async (channel) => {
      try {
        const cleanName = cleanNameForTmdb(channel.name);
        if (!cleanName || cleanName.length < 2) return;

        const results = await searchTmdb(cleanName);
        if (results.length > 0 && results[0].posterPath) {
          channel.logoUrl = tmdbImage(results[0].posterPath, "w500");
        }
      } catch {}
    }),
  );
}
