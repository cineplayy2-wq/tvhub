import "server-only";

import { invalidatePlaylistCache } from "@/lib/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeTitleKey, slugify } from "@/lib/utils";
import { PADRAO_ADULTO, detectCategory } from "./category-detector";
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
 * Teto antigo de canais — removido.
 *
 * A sincronização agora espelha a lista inteira numa tabela de estágio no
 * Postgres e aplica UPSERT em lotes. O limite de 60 mil cortava 328 mil itens
 * da lista real do provedor. Mantemos a constante só como teto de segurança
 * do parser de fluxo (400 mil), não como corte do catálogo.
 */
const MAX_ITENS_EM_FLUXO = 400000;

/**
 * Teto de itens que a lista SECUNDÁRIA acrescenta ao catálogo.
 *
 * Com o pipeline em estágio, a união também roda em SQL. O teto sobe para o
 * mesmo limite do fluxo — o que for exclusivo entra; o que já está na
 * principal só atualiza a URL.
 */
const MAX_EXTRAS_DA_SECUNDARIA = MAX_ITENS_EM_FLUXO;

/**
 * Apelido canônico de um grupo da M3U.
 *
 * A lista traz o mesmo grupo escrito de várias formas — "SBT", "▶️ SBT",
 * "✔️ SBT" —, e como o emoji faz parte do nome eles viravam grupos distintos:
 * 378 grupos para 312 assuntos reais, com três chips "SBT" lado a lado na tela.
 *
 * Tira o enfeite do começo e ignora a caixa, mas PRESERVA o "+": "SBT" e
 * "SBT+" são serviços diferentes e juntá-los misturaria conteúdo que não se
 * mistura. O `memo` guarda a primeira grafia vista, que vira a exibida.
 */
function apelidoDeGrupo(bruto: string, memo: Map<string, string>): string {
  const limpo =
    bruto
      .replace(/^[^\p{L}\p{N}+]+/u, "")
      .replace(/\s+/g, " ")
      .trim() || bruto;

  const chave = limpo.toLowerCase();
  const jaVisto = memo.get(chave);
  if (jaVisto) return jaVisto;
  memo.set(chave, limpo);
  return limpo;
}

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
        AND c."streamUrl" IS DISTINCT FROM s.url
    `;

    /**
     * Reserva que repete a fonte principal é pior que reserva nenhuma.
     *
     * Acontece com o conteúdo que a união trouxe da secundária: o canal nasce
     * com a URL dela e, logo em seguida, o casamento por nome grava essa mesma
     * URL como reserva. Quando a fonte cai, o player espera o dobro para tentar
     * de novo exatamente o endereço que acabou de falhar.
     *
     * A linha acima impede que isso volte a ser gravado; esta limpa o que ficou
     * de sincronizações anteriores.
     */
    const repetidas = await prisma.$executeRaw`
      UPDATE "M3uChannel"
         SET "backupStreamUrl" = NULL
       WHERE "playlistId" = ${playlist.id}
         AND "backupStreamUrl" = "streamUrl"
    `;
    if (repetidas > 0) {
      console.log(`[m3u] ${repetidas} reservas que repetiam a fonte principal foram descartadas`);
    }

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

  // Cria os grupos que ainda não existem.
  await prisma.$executeRaw`
    INSERT INTO "M3uGroup" ("id", "playlistId", "name", "slug", "category", "sortOrder", "isHidden")
    SELECT
      gen_random_uuid()::text,
      ${playlist.id},
      g.grupo,
      lower(regexp_replace(g.grupo, '[^a-zA-Z0-9]+', '-', 'g')),
      g.categoria,
      9000,
      -- Adulto nasce OCULTO. Liberar é ato explícito no painel, nunca padrão.
      g.categoria = 'adult'
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
        -- Adulto ganha precedência sobre o formato da URL.
        --
        -- Classificar só por /movie/ e /series/ deixou "XXX ADULTOS +18" entrar
        -- como filme comum e VISÍVEL: 3.317 canais adultos expostos, inclusive
        -- para perfil infantil. O nome do grupo é o sinal que importa aqui, não
        -- o container do arquivo.
        CASE
          WHEN s."grupo" ~* ${PADRAO_ADULTO} THEN 'adult'
          ELSE mode() WITHIN GROUP (ORDER BY
            CASE
              WHEN s."url" LIKE '%/movie/%'  THEN 'movies'
              WHEN s."url" LIKE '%/series/%' THEN 'series'
              ELSE 'live'
            END
          )
        END AS categoria
      FROM "M3uBackupStage" s
      WHERE s."playlistId" = ${playlist.id} AND s."grupo" IS NOT NULL
      GROUP BY s."grupo"
    ) AS g
    WHERE NOT EXISTS (
      -- Comparação sem caixa: a secundária escreve "Religiosos" onde a
      -- principal escreveu "RELIGIOSOS", e sem isto viraria grupo duplicado.
      SELECT 1 FROM "M3uGroup" x
      WHERE x."playlistId" = ${playlist.id} AND lower(x."name") = lower(g.grupo)
    )
    ON CONFLICT ("playlistId", "name") DO NOTHING
  `;

  /**
   * Atualiza o endereço do que já veio da secundária em cargas anteriores.
   *
   * Sem este passo a união só sabia inserir o que faltava, e o que já estava no
   * catálogo ficava congelado com a URL do dia em que entrou. Como esse
   * conteúdo também é poupado da varredura de obsoletos — não estar na lista
   * principal é a razão de ele existir —, nada nunca o revisava.
   *
   * Foi exatamente assim que 160 mil itens pararam de tocar: o provedor mudou
   * o servidor de entrega, a lista nova já vinha com o endereço certo, e o
   * catálogo seguiu apontando para um nome que o DNS nem resolvia mais.
   */
  const atualizados = await prisma.$executeRaw`
    UPDATE "M3uChannel" AS c
       SET "streamUrl" = s.url
      FROM (
        SELECT DISTINCT ON ("chave") "chave", "url"
        FROM "M3uBackupStage"
        WHERE "playlistId" = ${playlist.id}
      ) AS s
     WHERE c."playlistId" = ${playlist.id}
       AND c."fromBackup"
       AND c."nameKey" = s."chave"
       AND c."streamUrl" IS DISTINCT FROM s.url
  `;
  if (atualizados > 0) {
    console.log(`[m3u] uniao: ${atualizados} enderecos da secundaria atualizados`);
  }

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
      ON grp."playlistId" = ${playlist.id} AND lower(grp."name") = lower(s."grupo")
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
 * Sincroniza o catálogo M3U sem derrubar o que já está no ar.
 *
 * Fluxo:
 * 1. Marca SYNCING — o assinante continua vendo o catálogo antigo.
 * 2. Espelha a lista primária numa tabela UNLOGGED de estágio, lote a lote —
 *    nada proporcional a 388 mil fica no heap do Node (240 MB).
 * 3. UPSERT em SQL: canal conhecido atualiza URL e preserva ID; canal novo
 *    entra e já aparece na próxima abertura de página.
 * 4. Só DEPOIS do estágio completo: apaga obsoletos que não estão no estágio
 *    e não são `fromBackup`. Importação pela metade NÃO varre o acervo.
 * 5. Vincula backup + une exclusivos da secundária.
 * 6. Marca SYNCED e invalida cache.
 */
export async function syncPlaylist(playlist: M3uPlaylist): Promise<{
  totalChannels: number;
  totalGroups: number;
  error?: string;
}> {
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
    const estagiados = await estagiarPrimaria(playlist);
    if (estagiados === 0) {
      throw new Error("Nenhum canal ou conteúdo foi encontrado nesta lista M3U.");
    }

    console.log(`[m3u] primaria espelhada: ${estagiados} itens no estagio`);

    const gruposBrutos = await prisma.$queryRaw<Array<{ grupo: string; amostra: string; url: string }>>`
      SELECT DISTINCT ON (lower("grupo"))
        "grupo" AS grupo,
        "nome" AS amostra,
        "url" AS url
      FROM "M3uPrimaryStage"
      WHERE "playlistId" = ${playlist.id} AND "grupo" IS NOT NULL
      ORDER BY lower("grupo"), "nome"
    `;

    const memoGrupos = new Map<string, string>();
    const canonizarGrupo = (bruto: string) => apelidoDeGrupo(bruto, memoGrupos);

    const sampleChannelPerGroup = new Map<string, { name: string; streamUrl: string }>();
    for (const g of gruposBrutos) {
      const grupo = canonizarGrupo(g.grupo);
      if (!sampleChannelPerGroup.has(grupo)) {
        sampleChannelPerGroup.set(grupo, { name: g.amostra, streamUrl: g.url });
      }
    }

    const gruposCanonicos = Array.from(sampleChannelPerGroup.keys());
    const groupsForAi = gruposCanonicos.map((groupName) => ({
      name: groupName,
      sampleChannel: sampleChannelPerGroup.get(groupName)?.name || "",
    }));

    let aiCategories: Record<string, string> = {};
    try {
      aiCategories = await categorizeGroupsWithAi(groupsForAi.slice(0, 60));
    } catch {}

    const groupDataList = gruposCanonicos.map((groupName, index) => {
      const sample = sampleChannelPerGroup.get(groupName);
      const baseCategory = detectCategory(groupName, sample?.name || "", sample?.streamUrl || "");
      const finalCategory = aiCategories[groupName] || baseCategory;
      return {
        playlistId: playlist.id,
        name: groupName,
        slug: slugify(groupName) || `grupo-${index}`,
        category: finalCategory,
        sortOrder: index,
        isHidden: finalCategory === "adult",
      };
    });

    await prisma.m3uGroup.createMany({
      data: groupDataList,
      skipDuplicates: true,
    });

    await prisma.m3uGroup.updateMany({
      where: { playlistId: playlist.id, category: "adult", isHidden: false },
      data: { isHidden: true },
    });

    // Regrava o grupo no estágio com o apelido canônico para o JOIN casar.
    for (const [, limpo] of memoGrupos) {
      // no-op placeholder — o apelido já foi aplicado na gravação do estágio
      void limpo;
    }

    const atualizados = await prisma.$executeRaw`
      UPDATE "M3uChannel" AS c
         SET "nameKey" = s."chave",
             "streamUrl" = s."url",
             "name" = coalesce(s."nome", c."name"),
             "logoUrl" = coalesce(s."logoUrl", c."logoUrl"),
             "tvgId" = coalesce(s."tvgId", c."tvgId"),
             "tvgName" = coalesce(s."tvgName", c."tvgName"),
             "quality" = coalesce(s."quality", c."quality"),
             "language" = coalesce(s."language", c."language"),
             "country" = coalesce(s."country", c."country"),
             "fromBackup" = false,
             "groupId" = coalesce(grp."id", c."groupId")
        FROM (
          SELECT DISTINCT ON ("chave") *
          FROM "M3uPrimaryStage"
          WHERE "playlistId" = ${playlist.id}
          ORDER BY "chave", "nome"
        ) AS s
        LEFT JOIN "M3uGroup" grp
          ON grp."playlistId" = ${playlist.id}
         AND lower(grp."name") = lower(s."grupo")
       WHERE c."playlistId" = ${playlist.id}
         AND (
           (c."nameKey" IS NOT NULL AND c."nameKey" = s."chave")
           OR c."streamUrl" = s."url"
         )
         AND (
           c."streamUrl" IS DISTINCT FROM s."url"
           OR c."nameKey" IS DISTINCT FROM s."chave"
           OR c."fromBackup" = true
           OR c."groupId" IS DISTINCT FROM grp."id"
         )
    `;
    console.log(`[m3u] ${atualizados} canais existentes atualizados`);

    const inseridos = await prisma.$executeRaw`
      INSERT INTO "M3uChannel" (
        "id", "playlistId", "groupId", "name", "streamUrl", "nameKey",
        "logoUrl", "tvgId", "tvgName", "quality", "language", "country",
        "fromBackup", "isActive", "isFavorite", "sortOrder", "relevanceScore", "createdAt"
      )
      SELECT
        gen_random_uuid()::text,
        ${playlist.id},
        grp."id",
        s."nome",
        s."url",
        s."chave",
        s."logoUrl",
        s."tvgId",
        s."tvgName",
        s."quality",
        s."language",
        s."country",
        false,
        true, false, 0, 50, now()
      FROM (
        SELECT DISTINCT ON ("chave") *
        FROM "M3uPrimaryStage"
        WHERE "playlistId" = ${playlist.id} AND "nome" IS NOT NULL
        ORDER BY "chave", "nome"
      ) AS s
      LEFT JOIN "M3uGroup" grp
        ON grp."playlistId" = ${playlist.id}
       AND lower(grp."name") = lower(s."grupo")
      WHERE NOT EXISTS (
        SELECT 1 FROM "M3uChannel" c
        WHERE c."playlistId" = ${playlist.id}
          AND (
            (c."nameKey" IS NOT NULL AND c."nameKey" = s."chave")
            OR c."streamUrl" = s."url"
          )
      )
    `;
    console.log(`[m3u] ${inseridos} canais novos inseridos`);

    const obsoletos = await prisma.$executeRaw`
      DELETE FROM "M3uChannel" AS c
       WHERE c."playlistId" = ${playlist.id}
         AND c."fromBackup" = false
         AND NOT EXISTS (
           SELECT 1 FROM "M3uPrimaryStage" s
            WHERE s."playlistId" = ${playlist.id}
              AND (
                (c."nameKey" IS NOT NULL AND c."nameKey" = s."chave")
                OR c."streamUrl" = s."url"
              )
         )
    `;
    if (obsoletos > 0) {
      console.log(`[m3u] ${obsoletos} canais obsoletos removidos`);
    }

    await limparEstagioPrimario(playlist.id);

    try {
      await vincularBackup(playlist, { unir: true });
    } catch (backupErr) {
      console.warn("[m3u] falha ao sincronizar lista de backup:", backupErr);
    }

    const vazios = await prisma.m3uGroup.deleteMany({
      where: { playlistId: playlist.id, channels: { none: {} } },
    });
    if (vazios.count > 0) {
      console.log(`[m3u] ${vazios.count} grupos vazios removidos`);
    }

    const totalChannels = await prisma.m3uChannel.count({
      where: { playlistId: playlist.id, isActive: true },
    });
    const totalGroups = await prisma.m3uGroup.count({
      where: { playlistId: playlist.id },
    });

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
        totalChannels,
        totalGroups,
        nextSyncAt: nextSync,
        isSystem: true,
      },
    });

    await invalidatePlaylistCache(playlist.id);

    return { totalChannels, totalGroups };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido ao sincronizar";

    await limparEstagioPrimario(playlist.id).catch(() => {});
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
 * Espelha a lista PRIMÁRIA numa tabela UNLOGGED de estágio.
 *
 * Mesmo padrão do backup: lotes de 2.000, memória constante. Sem isto o
 * parser acumulava 60–150 mil objetos e estourou o heap de 240 MB.
 */
async function estagiarPrimaria(playlist: M3uPlaylist): Promise<number> {
  await prisma.$executeRawUnsafe(`
    CREATE UNLOGGED TABLE IF NOT EXISTS "M3uPrimaryStage" (
      "playlistId" TEXT NOT NULL,
      "chave"      TEXT NOT NULL,
      "url"        TEXT NOT NULL,
      "nome"       TEXT,
      "grupo"      TEXT,
      "logoUrl"    TEXT,
      "tvgId"      TEXT,
      "tvgName"    TEXT,
      "quality"    TEXT,
      "language"   TEXT,
      "country"    TEXT
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "M3uPrimaryStage_playlist_chave_idx"
      ON "M3uPrimaryStage" ("playlistId", "chave")`);

  await limparEstagioPrimario(playlist.id);

  const memoGrupos = new Map<string, string>();

  const gravarLote = async (lote: ItemDeBackup[]) => {
    const values = Prisma.join(
      lote.map(
        (i) =>
          Prisma.sql`(${playlist.id}, ${i.chave}, ${i.url}, ${i.nome}, ${apelidoDeGrupo(i.grupo, memoGrupos)}, ${i.logoUrl ?? null}, ${i.tvgId ?? null}, ${i.tvgName ?? null}, ${i.quality ?? null}, ${i.language ?? null}, ${i.country ?? null})`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO "M3uPrimaryStage" (
        "playlistId", "chave", "url", "nome", "grupo",
        "logoUrl", "tvgId", "tvgName", "quality", "language", "country"
      )
      VALUES ${values}
    `;
    await yieldToEventLoop(10);
  };

  if (playlist.sourceType === "URL" && playlist.sourceUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300_000);
    try {
      const response = await fetch(playlist.sourceUrl, {
        headers: DEFAULT_HEADERS,
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok || !response.body) {
        throw new Error(`Falha ao baixar M3U: HTTP ${response.status}`);
      }
      return await streamM3uUrlPairs(
        response.body,
        normalizeTitleKey,
        gravarLote,
        2000,
        MAX_ITENS_EM_FLUXO,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // RAW_TEXT / XTREAM: ainda passam pelo parser clássico, mas o resultado
  // entra no estágio em lotes — o restante do pipeline é o mesmo.
  const parsed = await fetchAndParse(playlist);
  let total = 0;
  let lote: ItemDeBackup[] = [];
  for (const ch of parsed?.channels ?? []) {
    const chave = normalizeTitleKey(ch.name);
    if (!chave) continue;
    lote.push({
      chave,
      nome: ch.name,
      url: ch.streamUrl,
      grupo: ch.groupTitle,
      logoUrl: ch.logoUrl,
      tvgId: ch.tvgId,
      tvgName: ch.tvgName,
      quality: ch.quality,
      language: ch.language,
      country: ch.country,
    });
    total++;
    if (lote.length >= 2000) {
      await gravarLote(lote);
      lote = [];
    }
    if (total >= MAX_ITENS_EM_FLUXO) break;
  }
  if (lote.length > 0) await gravarLote(lote);
  return total;
}

async function limparEstagioPrimario(playlistId: string) {
  try {
    await prisma.$executeRaw`DELETE FROM "M3uPrimaryStage" WHERE "playlistId" = ${playlistId}`;
  } catch {
    // Tabela pode não existir ainda.
  }
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

  // Mesmo apelido canônico da lista principal: sem isto a segunda lista
  // recriaria "▶️ SBT" ao lado do "SBT" já unificado.
  const memoGrupos = new Map<string, string>();

  const gravarLote = async (lote: ItemDeBackup[]) => {
    const values = Prisma.join(
      lote.map(
        (i) =>
          Prisma.sql`(${playlist.id}, ${i.chave}, ${i.url}, ${i.nome}, ${apelidoDeGrupo(i.grupo, memoGrupos)})`,
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
          return await parseM3uStream(response.body, MAX_ITENS_EM_FLUXO);
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
