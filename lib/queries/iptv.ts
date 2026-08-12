import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cached, TTL } from "@/lib/cache";
import { dedupeChannels } from "@/lib/utils";
import {
  mesmaBase,
  nivelDe,
  nomeBaseDoCanal,
  umaPorNivel,
  type VarianteQualidade,
} from "@/lib/iptv/quality";


const PAGE_SIZE = 20;

export async function listAllPlaylists({
  query,
  page = 1,
}: {
  query?: string;
  page?: number;
}) {
  const where: Prisma.M3uPlaylistWhereInput = query
    ? {
        OR: [
          { label: { contains: query, mode: "insensitive" } },
          { user: { name: { contains: query, mode: "insensitive" } } },
          { user: { email: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.m3uPlaylist.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        userId: true,
        label: true,
        sourceType: true,
        syncStatus: true,
        lastSyncAt: true,
        lastSyncError: true,
        totalChannels: true,
        totalGroups: true,
        autoSyncHours: true,
        updatedAt: true,
        user: {
          select: { name: true, email: true },
        },
      },
    }),
    prisma.m3uPlaylist.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getUserPlaylist(userId: string) {
  return prisma.m3uPlaylist.findUnique({
    where: { userId },
    include: {
      groups: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { channels: true } },
        },
      },
      _count: { select: { channels: true } },
    },
  });
}

const SYNC_STALE_AFTER_MS = 45 * 60 * 1000;

export type ViewablePlaylist = NonNullable<
  Awaited<ReturnType<typeof getUserPlaylist>>
> & {
  hasChannels: boolean;
  isSyncing: boolean;
  isSyncStale: boolean;
};

export async function getViewablePlaylist(
  userId: string,
): Promise<ViewablePlaylist | null> {
  const playlist = await getUserPlaylist(userId);
  if (!playlist) return null;

  const totalChannels = playlist._count.channels;
  const isSyncing = playlist.syncStatus === "SYNCING";
  const isSyncStale =
    isSyncing &&
    playlist.updatedAt.getTime() < Date.now() - SYNC_STALE_AFTER_MS;

  return {
    ...playlist,
    hasChannels: totalChannels > 0,
    isSyncing,
    isSyncStale,
  };
}

export async function getPlaylistChannels({
  playlistId,
  groupId,
  search,
  category,
  favoritesOnly,
  page = 1,
  pageSize = PAGE_SIZE,
  adultUnlocked = false,
}: {
  playlistId: string;
  groupId?: string;
  search?: string;
  category?: string;
  favoritesOnly?: boolean;
  page?: number;
  pageSize?: number;
  /** Módulo +18 contratado. Sem ele a categoria adulta não retorna nada. */
  adultUnlocked?: boolean;
}) {
  const where: Prisma.M3uChannelWhereInput = {
    playlistId,
    isActive: true,
  };

  if (groupId) where.groupId = groupId;
  if (favoritesOnly) where.isFavorite = true;

  const extraWhere: Prisma.M3uChannelWhereInput[] = [];

  if (search) {
    extraWhere.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { tvgName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (category === "movies") {
    extraWhere.push({
      OR: [
        { streamUrl: { contains: "/movie/" } },
        { group: { category: "movies", isHidden: false } },
      ],
    });
  } else if (category === "series") {
    extraWhere.push({
      OR: [
        { streamUrl: { contains: "/series/" } },
        { group: { category: "series", isHidden: false } },
      ],
    });
  } else if (category === "live") {
    extraWhere.push({
      AND: [
        { NOT: { streamUrl: { contains: "/movie/" } } },
        { NOT: { streamUrl: { contains: "/series/" } } },
        { group: { category: "live", isHidden: false } },
      ],
    });
  } else if (category === "sports") {
    extraWhere.push({
      group: { category: "sports", isHidden: false },
    });
  } else if (category === "kids") {
    extraWhere.push({
      group: { category: "kids", isHidden: false },
    });
  } else if (category === "adult") {
    /**
     * Adulto exige o módulo contratado. Sem ele, some.
     *
     * Antes esta ramificação era a única que NÃO aplicava `isHidden`: ocultar
     * os grupos no painel não bloqueava nada aqui, e bastava digitar
     * `/tv/adult` para ver tudo. O bloqueio precisa valer na consulta, não só
     * na navegação.
     */
    if (!adultUnlocked) {
      extraWhere.push({ id: "__bloqueado__" });
    } else {
      extraWhere.push({ group: { category: "adult" } });
    }
  }

  if (category !== "adult") {
    where.group = {
      ...((where.group as Prisma.M3uGroupWhereInput) || {}),
      category: { not: "adult" },
      isHidden: false,
    };
  }

  if (extraWhere.length > 0) {
    where.AND = [
      ...((where.AND as Prisma.M3uChannelWhereInput[]) ?? []),
      ...extraWhere,
    ];
  }

  const totalCacheKey = `channels_count:${playlistId}:${category ?? "all"}:${search ?? "all"}`;

  const [items, total] = await Promise.all([
    prisma.m3uChannel.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        streamUrl: true,
        logoUrl: true,
        quality: true,
        language: true,
        country: true,
        isFavorite: true,
        relevanceScore: true,
        group: { select: { name: true, slug: true, category: true } },
      },
    }),
    cached(totalCacheKey, TTL.playlist, () => prisma.m3uChannel.count({ where })),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getFeaturedChannels(playlistId: string, limit = 10) {
  const items = await prisma.m3uChannel.findMany({
    where: { playlistId, isActive: true, group: { category: { not: "adult" }, isHidden: false } },
    orderBy: { relevanceScore: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      streamUrl: true,
      logoUrl: true,
      quality: true,
      isFavorite: true,
      relevanceScore: true,
      group: { select: { name: true, slug: true, category: true } },
    },
  });

  return dedupeChannels(items);
}

export async function getRegionalChannels(playlistId: string, limit = 18) {
  const items = await prisma.m3uChannel.findMany({
    where: {
      playlistId,
      isActive: true,
      group: { isHidden: false, category: { not: "adult" } },
      OR: [
        { name: { contains: "GLOBO", mode: "insensitive" } },
        { name: { contains: "SBT", mode: "insensitive" } },
        { name: { contains: "RECORD", mode: "insensitive" } },
        { name: { contains: "BAND", mode: "insensitive" } },
      ],
    },
    orderBy: { relevanceScore: "desc" },
    take: limit * 2,
    select: {
      id: true,
      name: true,
      streamUrl: true,
      logoUrl: true,
      quality: true,
      isFavorite: true,
      relevanceScore: true,
      group: { select: { name: true, slug: true, category: true } },
    },
  });

  return dedupeChannels(items).slice(0, limit);
}

export async function getStateChannels(
  playlistId: string,
  stateTerms: string[],
  limit = 18,
) {
  if (stateTerms.length === 0) return [];

  const items = await prisma.m3uChannel.findMany({
    where: {
      playlistId,
      isActive: true,
      group: { isHidden: false, category: { not: "adult" } },
      OR: stateTerms.map((term) => ({
        name: { contains: term, mode: "insensitive" },
      })),
    },
    orderBy: { relevanceScore: "desc" },
    take: limit * 2,
    select: {
      id: true,
      name: true,
      streamUrl: true,
      logoUrl: true,
      quality: true,
      isFavorite: true,
      relevanceScore: true,
      group: { select: { name: true, slug: true, category: true } },
    },
  });

  return dedupeChannels(items).slice(0, limit);
}

export async function getNovelasList(playlistId: string, limit = 18) {
  const items = await prisma.m3uChannel.findMany({
    where: {
      playlistId,
      isActive: true,
      group: { isHidden: false, category: { not: "adult" } },
      OR: [
        { group: { name: { contains: "NOVELA", mode: "insensitive" } } },
        { group: { name: { contains: "DORAMA", mode: "insensitive" } } },
        { name: { contains: "NOVELA", mode: "insensitive" } },
        { name: { contains: "DORAMA", mode: "insensitive" } },
      ],
    },
    orderBy: { relevanceScore: "desc" },
    take: limit * 3,
    select: {
      id: true,
      name: true,
      streamUrl: true,
      logoUrl: true,
      quality: true,
      isFavorite: true,
      relevanceScore: true,
      group: { select: { name: true, slug: true, category: true } },
    },
  });

  return dedupeChannels(items).slice(0, limit);
}

export async function getChannelsByCategory(
  playlistId: string,
  category: string,
  limit = 18,
) {
  const where: Prisma.M3uChannelWhereInput = {
    playlistId,
    isActive: true,
    group: { isHidden: false, category: { not: "adult" } },
  };

  if (category === "movies") {
    where.streamUrl = { contains: "/movie/" };
    where.AND = [
      { NOT: { name: { contains: "24H", mode: "insensitive" } } },
      { NOT: { group: { name: { contains: "24H", mode: "insensitive" } } } },
    ];

    const releases = await prisma.m3uChannel.findMany({
      where: {
        ...where,
        OR: [
          { group: { name: { contains: "CINEMA", mode: "insensitive" } } },
          { group: { name: { contains: "LANÇAMENTO", mode: "insensitive" } } },
          { group: { name: { contains: "2024", mode: "insensitive" } } },
          { group: { name: { contains: "2025", mode: "insensitive" } } },
          { group: { name: { contains: "2026", mode: "insensitive" } } },
          { group: { name: { contains: "FILMES", mode: "insensitive" } } },
        ],
      },
      orderBy: { id: "desc" },
      take: limit * 3,
      select: {
        id: true,
        name: true,
        streamUrl: true,
        logoUrl: true,
        quality: true,
        isFavorite: true,
        relevanceScore: true,
        group: { select: { name: true, slug: true, category: true } },
      },
    });

    if (releases.length >= Math.min(limit, 8)) {
      return dedupeChannels(releases).slice(0, limit);
    }
  } else if (category === "series") {
    where.streamUrl = { contains: "/series/" };
    where.AND = [
      { NOT: { name: { contains: "24H", mode: "insensitive" } } },
      { NOT: { group: { name: { contains: "24H", mode: "insensitive" } } } },
    ];

    const releases = await prisma.m3uChannel.findMany({
      where: {
        ...where,
        OR: [
          { group: { name: { contains: "NETFLIX", mode: "insensitive" } } },
          { group: { name: { contains: "GLOBOPLAY", mode: "insensitive" } } },
          { group: { name: { contains: "OUTRAS PRODUTORAS", mode: "insensitive" } } },
          { group: { name: { contains: "SERIES", mode: "insensitive" } } },
        ],
      },
      orderBy: { id: "desc" },
      take: limit * 3,
      select: {
        id: true,
        name: true,
        streamUrl: true,
        logoUrl: true,
        quality: true,
        isFavorite: true,
        relevanceScore: true,
        group: { select: { name: true, slug: true, category: true } },
      },
    });

    if (releases.length >= Math.min(limit, 8)) {
      return dedupeChannels(releases).slice(0, limit);
    }
  } else if (category === "live") {
    where.AND = [
      { NOT: { streamUrl: { contains: "/movie/" } } },
      { NOT: { streamUrl: { contains: "/series/" } } },
      { group: { category: "live", isHidden: false } },
    ];
  } else {
    where.group = { category, isHidden: false };
  }

  const items = await prisma.m3uChannel.findMany({
    where,
    orderBy: { id: "desc" },
    take: limit * 3,
    select: {
      id: true,
      name: true,
      streamUrl: true,
      logoUrl: true,
      quality: true,
      isFavorite: true,
      relevanceScore: true,
      group: { select: { name: true, slug: true, category: true } },
    },
  });

  return dedupeChannels(items).slice(0, limit);
}

export async function getChannelById(channelId: string) {
  return prisma.m3uChannel.findUnique({
    where: { id: channelId },
    include: {
      group: { select: { id: true, name: true, slug: true, category: true } },
      playlist: { select: { id: true, userId: true } },
    },
  });
}

export async function getGroupBySlug(playlistId: string, slug: string) {
  return prisma.m3uGroup.findFirst({
    where: { playlistId, slug },
    include: {
      _count: { select: { channels: true } },
    },
  });
}

export async function getPlaylistCategories(playlistId: string) {
  const groups = await prisma.m3uGroup.findMany({
    where: { playlistId, isHidden: false },
    select: { category: true, name: true, slug: true },
    orderBy: { sortOrder: "asc" },
  });

  const categories = new Set<string>();
  for (const g of groups) {
    if (g.category) categories.add(g.category);
  }
  return Array.from(categories);
}

export async function toggleChannelFavorite(channelId: string, isFavorite: boolean) {
  return prisma.m3uChannel.update({
    where: { id: channelId },
    data: { isFavorite },
  });
}

export async function toggleGroupLock(groupId: string, isHidden: boolean) {
  return prisma.m3uGroup.update({
    where: { id: groupId },
    data: { isHidden },
  });
}

export async function toggleCategoryLock(playlistId: string, category: string, isHidden: boolean) {
  const groups = await prisma.m3uGroup.findMany({
    where: { playlistId, category },
    select: { id: true },
  });

  const groupIds = groups.map((g) => g.id);

  if (groupIds.length === 0) return false;

  await prisma.m3uGroup.updateMany({
    where: { id: { in: groupIds } },
    data: { isHidden },
  });

  return true;
}

/**
 * Episódios de uma série.
 *
 * `seriesName` vem do card, que por sua vez veio do RECORTE_EPISODIO aplicado
 * no Postgres — ou seja, é literalmente um PREFIXO do nome de cada episódio.
 * Por isso a busca é `startsWith`: casa exato, usa índice e não inventa.
 *
 * A versão anterior quebrava as palavras do título, descartava as de até dois
 * caracteres e recolava o resto com espaço. Isso produzia uma string que não
 * existia em canal nenhum: "O Cravo e a Rosa" virava "Cravo Rosa" e a página
 * respondia "série não encontrada". Como títulos em português são cheios de
 * artigo e preposição curta, isso derrubava boa parte do acervo.
 */
export async function getSeriesEpisodes(playlistId: string, seriesName: string) {
  const alvo = seriesName.trim();
  if (!alvo) return [];

  const candidatos = await prisma.m3uChannel.findMany({
    where: {
      playlistId,
      isActive: true,
      name: { startsWith: alvo, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
    // Novela diária passa de 200 capítulos; o teto antigo de 300 cortava as
    // maiores no meio, e ainda por ordem alfabética.
    take: 1500,
    select: {
      id: true,
      name: true,
      streamUrl: true,
      logoUrl: true,
      quality: true,
      isFavorite: true,
      relevanceScore: true,
      group: { select: { name: true, slug: true, category: true } },
    },
  });

  // Prefixo sozinho arrastaria "The Office US" para dentro de "The Office".
  // Só vale quando o que sobra depois do nome é a marcação de episódio.
  return candidatos.filter((canal) => {
    const resto = canal.name.slice(alvo.length).trim();
    return resto === "" || /^[-–:|]?\s*(?:[sStT]\s*\d|\d+\s*[xX]\s*\d)/.test(resto);
  });
}

/**
 * As outras qualidades do mesmo canal.
 *
 * A busca é por prefixo porque o marcador de qualidade fica sempre no fim do
 * nome, então o nome base é literalmente o começo do nome de cada irmã. O
 * `startsWith` no banco só desbasta; quem decide de fato é a comparação do
 * nome base em JS, que ignora caixa e espaço repetido — sem ela, "GLOBO SP"
 * arrastaria "GLOBO SP RECORD" e afins.
 */
export async function getQualityVariants(
  playlistId: string,
  channelName: string,
): Promise<VarianteQualidade[]> {
  const base = nomeBaseDoCanal(channelName);
  if (!base) return [];

  const candidatos = await prisma.m3uChannel.findMany({
    where: {
      playlistId,
      isActive: true,
      name: { startsWith: base, mode: "insensitive" },
    },
    select: { id: true, name: true, quality: true, streamUrl: true },
    orderBy: [{ relevanceScore: "desc" }, { sortOrder: "asc" }],
    take: 40,
  });

  const irmas = candidatos
    .filter((c) => mesmaBase(nomeBaseDoCanal(c.name), base))
    .map((c) => ({
      id: c.id,
      name: c.name,
      streamUrl: c.streamUrl,
      nivel: nivelDe(c.quality, c.name),
    }));

  // Uma sozinha não é escolha: o seletor só faz sentido com alternativa real.
  const porNivel = umaPorNivel(irmas);
  return porNivel.length > 1 ? porNivel : [];
}

export type SeriesListItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  quality: string | null;
  episodeCount: number;
  firstEpisodeId: string;
  group: { name: string; slug: string; category: string | null } | null;
};

/**
 * Padrão de episódio nas listas M3U: "Nome S02E05", "Nome T02E05", "Nome 2x05".
 * Tudo a partir daí é descartado para sobrar o nome da série.
 */
const RECORTE_EPISODIO =
  "[[:space:]]*[-–]?[[:space:]]*" +
  "([sStT][0-9]{1,2}[[:space:]]*[eExX][0-9]{1,3}|[0-9]{1,2}[xX][0-9]{1,3})" +
  ".*$";

/**
 * Lista de séries AGRUPADAS, uma linha por série.
 *
 * A versão anterior devolvia um item por episódio, com `episodeCount: 1` fixo:
 * a aba Séries virava uma parede de "Fulano S01E09", "Fulano S01E10", cada um
 * como se fosse uma série diferente, e clicar levava direto para o player em
 * vez da página de temporadas.
 *
 * O agrupamento é feito no Postgres, não em JS. São quase 39 mil episódios —
 * trazer tudo para a memória para agrupar aqui é o mesmo erro que já derrubou
 * o contêiner antes. O banco devolve só as séries, já contadas.
 */
/**
 * O segundo parâmetro é o GRUPO, não um limite.
 *
 * Ele já era chamado assim pelos dois lugares que usam esta função, mas a
 * assinatura antiga dizia `limitArg?: number | string` e fazia `Number(cuid)`,
 * que dá NaN e caía no padrão de 4000. Resultado: escolher um subgrupo de
 * séries devolvia o acervo inteiro da playlist, como se o filtro não existisse
 * — e não existia mesmo, porque a consulta nunca teve cláusula por grupo.
 */
export async function getSeriesList(
  playlistId: string,
  groupId?: string | null,
  limite = 4000,
): Promise<SeriesListItem[]> {
  const teto = Math.min(limite, 5000);
  const filtroGrupo = groupId ? Prisma.sql`AND c."groupId" = ${groupId}` : Prisma.empty;

  const linhas = await prisma.$queryRaw<
    Array<{
      serie: string;
      episodeCount: number;
      firstEpisodeId: string;
      logoUrl: string | null;
      quality: string | null;
      groupName: string | null;
      groupSlug: string | null;
      groupCategory: string | null;
    }>
  >`
    WITH eps AS (
      SELECT
        c.id, c.name, c."logoUrl", c.quality, c."sortOrder",
        g.name AS "groupName", g.slug AS "groupSlug", g.category AS "groupCategory",
        NULLIF(btrim(regexp_replace(c.name, ${RECORTE_EPISODIO}, '', 'g')), '') AS serie
      FROM "M3uChannel" c
      LEFT JOIN "M3uGroup" g ON g.id = c."groupId"
      WHERE c."playlistId" = ${playlistId}
        AND c."isActive" = true
        ${filtroGrupo}
        AND (
          c."streamUrl" LIKE '%/series/%'
          OR (g.category = 'series' AND g."isHidden" = false)
        )
    )
    SELECT
      serie,
      COUNT(*)::int                                              AS "episodeCount",
      (array_agg(id            ORDER BY name ASC))[1]            AS "firstEpisodeId",
      (array_agg("logoUrl"     ORDER BY ("logoUrl" IS NULL), name ASC))[1] AS "logoUrl",
      (array_agg(quality       ORDER BY (quality IS NULL), name ASC))[1]   AS quality,
      (array_agg("groupName"   ORDER BY name ASC))[1]            AS "groupName",
      (array_agg("groupSlug"   ORDER BY name ASC))[1]            AS "groupSlug",
      (array_agg("groupCategory" ORDER BY name ASC))[1]          AS "groupCategory"
    FROM eps
    WHERE serie IS NOT NULL
    GROUP BY serie
    ORDER BY MIN("sortOrder") ASC, serie ASC
    LIMIT ${teto}
  `;

  return linhas.map((l) => ({
    id: l.firstEpisodeId,
    name: l.serie,
    logoUrl: l.logoUrl,
    quality: l.quality,
    episodeCount: l.episodeCount,
    firstEpisodeId: l.firstEpisodeId,
    group: l.groupSlug
      ? { name: l.groupName ?? l.serie, slug: l.groupSlug, category: l.groupCategory }
      : null,
  }));
}

export async function getLiveCategoryOverview(playlistId: string) {
  const groups = await prisma.m3uGroup.findMany({
    where: { playlistId, isHidden: false, category: "live" },
    select: {
      category: true,
      channels: {
        where: { isActive: true },
        take: 3,
        select: { logoUrl: true },
      },
      _count: { select: { channels: true } },
    },
  });

  return groups.map((g) => ({
    category: g.category ?? "live",
    count: g._count.channels,
    logos: g.channels.map((c) => c.logoUrl).filter((l): l is string => Boolean(l)),
  }));
}

export async function getLiveChannelsByCategory(playlistId: string, category: string, limit = 18) {
  return getChannelsByCategory(playlistId, "live", limit);
}
