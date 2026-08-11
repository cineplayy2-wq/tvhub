import "server-only";

import type { AgeRating, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AGE_RATING_ORDER } from "@/lib/constants";
import type { TitleCard, TitleCardWithProgress } from "@/types";

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  posterUrl: true,
  backdropUrl: true,
  releaseYear: true,
  ageRating: true,
  durationSeconds: true,
} satisfies Prisma.TitleSelect;

/**
 * Filtro de faixa etária do perfil.
 *
 * Aplicado na QUERY, não na renderização. Filtrar no componente traria o
 * título proibido até o navegador — bastaria abrir o HTML para ver o que o
 * perfil infantil não deveria nem saber que existe.
 */
function ageFilter(maxAgeRating: AgeRating): Prisma.TitleWhereInput {
  const limit = AGE_RATING_ORDER.indexOf(maxAgeRating);
  const allowed = AGE_RATING_ORDER.slice(0, limit + 1);
  return { ageRating: { in: allowed } };
}

function publishedWhere(maxAgeRating: AgeRating): Prisma.TitleWhereInput {
  return {
    status: "PUBLISHED",
    ...ageFilter(maxAgeRating),
  };
}

// ==========================================================
// HERO
// ==========================================================

export async function getHeroTitle(maxAgeRating: AgeRating) {
  const where = publishedWhere(maxAgeRating);

  // Preferência por título marcado como destaque E com backdrop 16:9.
  // Sem backdrop o Hero fica com pôster esticado, que é pior que não ter Hero.
  const featured = await prisma.title.findFirst({
    where: { ...where, isFeatured: true, backdropUrl: { not: null } },
    orderBy: { popularity: "desc" },
    select: {
      ...CARD_SELECT,
      synopsis: true,
      logoUrl: true,
      genres: { select: { name: true, slug: true }, take: 3 },
    },
  });

  if (featured) return featured;

  // Sem destaque disponível, cai para o mais popular que tenha arte
  return prisma.title.findFirst({
    where: { ...where, backdropUrl: { not: null } },
    orderBy: { popularity: "desc" },
    select: {
      ...CARD_SELECT,
      synopsis: true,
      logoUrl: true,
      genres: { select: { name: true, slug: true }, take: 3 },
    },
  });
}

// ==========================================================
// TRILHAS
// ==========================================================

export type Row = {
  key: string;
  title: string;
  items: TitleCard[];
};

export async function getContinueWatching(
  profileId: string,
  maxAgeRating: AgeRating,
): Promise<TitleCardWithProgress[]> {
  const progress = await prisma.watchProgress.findMany({
    where: {
      profileId,
      completed: false,
      positionSeconds: { gt: 30 },
      title: publishedWhere(maxAgeRating),
    },
    orderBy: { lastWatched: "desc" },
    take: 12,
    select: {
      positionSeconds: true,
      durationSeconds: true,
      episodeId: true,
      episode: { select: { season: true, number: true } },
      title: { select: CARD_SELECT },
    },
  });

  // `title` virou opcional no modelo (o progresso de IPTV aponta para canal,
  // não para o catálogo próprio), então os registros sem título são
  // descartados aqui — esta trilha é só do VOD interno.
  return progress.flatMap((entry) => {
    if (!entry.title) return [];
    return [{
    ...entry.title,
    progress: {
      positionSeconds: entry.positionSeconds,
      durationSeconds: entry.durationSeconds,
      percent:
        entry.durationSeconds > 0
          ? Math.min(100, (entry.positionSeconds / entry.durationSeconds) * 100)
          : 0,
      episodeId: entry.episodeId,
      episodeLabel: entry.episode
        ? `T${entry.episode.season}:E${entry.episode.number}`
        : null,
    },
    }];
  });
}

/**
 * Monta todas as trilhas do dashboard em UMA ida ao banco por trilha,
 * disparadas em paralelo. Sequencial, com 6 trilhas, somaria 6 round-trips
 * de latência antes do primeiro byte chegar ao usuário.
 */
export async function getCatalogRows(
  profileId: string,
  maxAgeRating: AgeRating,
): Promise<Row[]> {
  const where = publishedWhere(maxAgeRating);

  const [trending, recent, watchlist, collections, genres] = await Promise.all([
    prisma.title.findMany({
      where,
      orderBy: [{ popularity: "desc" }, { viewCount: "desc" }],
      take: 16,
      select: CARD_SELECT,
    }),
    prisma.title.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: 16,
      select: CARD_SELECT,
    }),
    prisma.watchlistItem.findMany({
      where: { profileId, title: where },
      orderBy: { createdAt: "desc" },
      take: 16,
      select: { title: { select: CARD_SELECT } },
    }),
    prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      take: 4,
      select: {
        slug: true,
        name: true,
        items: {
          orderBy: { sortOrder: "asc" },
          take: 16,
          where: { title: where },
          select: { title: { select: CARD_SELECT } },
        },
      },
    }),
    prisma.genre.findMany({
      orderBy: { order: "asc" },
      // Sem limite baixo: cortar em 6 derrubava "Infantil" (ordem 7) do
      // catálogo — justamente a trilha que mais importa no perfil infantil.
      // Gêneros vazios já são descartados abaixo, então o teto é inofensivo.
      take: 20,
      select: {
        slug: true,
        name: true,
        titles: {
          where,
          orderBy: { popularity: "desc" },
          take: 16,
          select: CARD_SELECT,
        },
      },
    }),
  ]);

  const rows: Row[] = [
    { key: "trending", title: "Em alta", items: trending },
    { key: "new", title: "Lançamentos", items: recent },
  ];

  if (watchlist.length > 0) {
    rows.push({
      key: "watchlist",
      title: "Minha lista",
      items: watchlist.map((entry) => entry.title),
    });
  }

  for (const collection of collections) {
    if (collection.items.length === 0) continue;
    rows.push({
      key: `col-${collection.slug}`,
      title: collection.name,
      items: collection.items.map((entry) => entry.title),
    });
  }

  for (const genre of genres) {
    // Trilha com 1 card parece bug, não curadoria. Com 2 já lê como seleção —
    // e num catálogo pequeno exigir 3 apagava gêneros inteiros da tela.
    if (genre.titles.length < 2) continue;
    rows.push({
      key: `genre-${genre.slug}`,
      title: genre.name,
      items: genre.titles,
    });
  }

  return rows;
}

// ==========================================================
// DETALHE
// ==========================================================

export async function getTitleDetail(slug: string, maxAgeRating: AgeRating) {
  return prisma.title.findFirst({
    // O filtro etário entra aqui também: sem ele, o link direto para a página
    // de um título 18 abriria normalmente num perfil infantil.
    where: { slug, ...publishedWhere(maxAgeRating) },
    select: {
      ...CARD_SELECT,
      synopsis: true,
      logoUrl: true,
      originalName: true,
      director: true,
      cast: true,
      country: true,
      tags: true,
      videoStatus: true,
      genres: { select: { name: true, slug: true } },
      episodes: {
        orderBy: [{ season: "asc" }, { number: "asc" }],
        select: {
          id: true,
          season: true,
          number: true,
          name: true,
          synopsis: true,
          thumbnailUrl: true,
          durationSeconds: true,
          videoStatus: true,
        },
      },
    },
  });
}

export async function isInWatchlist(profileId: string, titleId: string) {
  const item = await prisma.watchlistItem.findUnique({
    where: { profileId_titleId: { profileId, titleId } },
    select: { id: true },
  });
  return item !== null;
}

// ==========================================================
// BUSCA
// ==========================================================

export async function searchCatalog(query: string, maxAgeRating: AgeRating) {
  const term = query.trim();
  if (term.length < 2) return [];

  return prisma.title.findMany({
    where: {
      ...publishedWhere(maxAgeRating),
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { originalName: { contains: term, mode: "insensitive" } },
        { director: { contains: term, mode: "insensitive" } },
        { cast: { has: term } },
      ],
    },
    orderBy: { popularity: "desc" },
    take: 40,
    select: CARD_SELECT,
  });
}
