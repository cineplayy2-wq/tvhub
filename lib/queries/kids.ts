import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { dedupeChannels } from "@/lib/utils";

/**
 * Área infantil.
 *
 * A regra que manda aqui é a segurança: nada entra sem passar pelo filtro de
 * grupo adulto e pelo bloqueio de novela/dorama — listas brasileiras jogam
 * "Carrossel" e "Chiquititas" na categoria infantil, e não é isso que uma
 * criança de cinco anos deveria abrir sozinha.
 *
 * A navegação é por personagem, não por categoria: criança reconhece a Barbie
 * antes de saber ler "animação".
 */

const KIDS_SELECT = {
  id: true,
  name: true,
  streamUrl: true,
  logoUrl: true,
  quality: true,
  isFavorite: true,
  relevanceScore: true,
  group: { select: { name: true, slug: true, category: true } },
} satisfies Prisma.M3uChannelSelect;

export type KidsChannel = Prisma.M3uChannelGetPayload<{ select: typeof KIDS_SELECT }>;

/** Títulos que a lista classifica como infantil mas são novela adolescente. */
const NOT_FOR_KIDS = [
  "novela",
  "dorama",
  "rebelde",
  "carrossel",
  "chiquititas",
  "poliana",
  "cumplices",
  "malhação",
  "floribella",
  "violetta",
  "soy luna",
  "carinha de anjo",
];

const SAFE_GUARDS: Prisma.M3uChannelWhereInput[] = NOT_FOR_KIDS.map((term) => ({
  NOT: { name: { contains: term, mode: "insensitive" } },
}));

export type Franchise = {
  key: string;
  label: string;
  /** Termos casados no nome do canal ou do grupo. */
  terms: string[];
};

/** Prateleiras por personagem/estúdio, na ordem em que aparecem na página. */
export const FRANCHISES: Franchise[] = [
  {
    key: "disney",
    label: "Disney e Pixar",
    terms: ["disney", "pixar", "frozen", "moana", "toy story", "encanto", "lilo"],
  },
  {
    key: "herois",
    label: "Super-heróis",
    terms: [
      "homem-aranha",
      "homem aranha",
      "spider",
      "batman",
      "superman",
      "vingadores",
      "marvel",
      "tartarugas ninja",
      "liga da justiça",
    ],
  },
  {
    key: "barbie",
    label: "Barbie e princesas",
    terms: ["barbie", "princesa", "polly", "my little pony", "rainbow high"],
  },
  {
    key: "patrulha",
    label: "Patrulha Canina e amigos",
    terms: ["patrulha canina", "paw patrol", "peppa", "pocoyo", "bluey", "bob esponja"],
  },
  {
    key: "classicos",
    label: "Clássicos",
    terms: ["tom e jerry", "pica pau", "scooby", "chaves", "looney", "pantera cor"],
  },
  {
    key: "aventura",
    label: "Aventura e games",
    terms: ["sonic", "mario", "minecraft", "pokemon", "pokémon", "dragon ball", "lego"],
  },
  {
    key: "musical",
    label: "Música e bebês",
    terms: ["galinha pintadinha", "bolofofos", "mundo bita", "baby", "canções", "luccas neto"],
  },
];

function termConditions(terms: string[]): Prisma.M3uChannelWhereInput[] {
  return terms.flatMap((term) => [
    { name: { contains: term, mode: "insensitive" as const } },
    { group: { name: { contains: term, mode: "insensitive" as const } } },
  ]);
}

function safeKidsWhere(playlistId: string): Prisma.M3uChannelWhereInput {
  return {
    playlistId,
    isActive: true,
    group: { isHidden: false, category: { not: "adult" } },
    AND: SAFE_GUARDS,
  };
}

export async function getFranchiseChannels(
  playlistId: string,
  franchise: Franchise,
  limit = 18,
) {
  const items = await prisma.m3uChannel.findMany({
    where: {
      ...safeKidsWhere(playlistId),
      OR: termConditions(franchise.terms),
    },
    orderBy: { relevanceScore: "desc" },
    take: limit * 3,
    select: KIDS_SELECT,
  });

  return dedupeChannels(items).slice(0, limit);
}

/** Desenhos que rodam em canal 24h — o "liga e deixa" da área infantil. */
export async function getKidsLiveChannels(playlistId: string, limit = 18) {
  const items = await prisma.m3uChannel.findMany({
    where: {
      ...safeKidsWhere(playlistId),
      group: { isHidden: false, category: "kids" },
      OR: [
        { name: { contains: "24H", mode: "insensitive" } },
        { group: { name: { contains: "24H", mode: "insensitive" } } },
        {
          AND: [
            { NOT: { streamUrl: { contains: "/movie/" } } },
            { NOT: { streamUrl: { contains: "/series/" } } },
          ],
        },
      ],
    },
    orderBy: { relevanceScore: "desc" },
    take: limit * 3,
    select: KIDS_SELECT,
  });

  return dedupeChannels(items).slice(0, limit);
}

/** Filmes de animação da lista. */
export async function getKidsMovies(playlistId: string, limit = 18) {
  const items = await prisma.m3uChannel.findMany({
    where: {
      ...safeKidsWhere(playlistId),
      streamUrl: { contains: "/movie/" },
      group: { isHidden: false, category: "kids" },
    },
    orderBy: { id: "desc" },
    take: limit * 3,
    select: KIDS_SELECT,
  });

  return dedupeChannels(items).slice(0, limit);
}

/** Séries e desenhos episodados. */
export async function getKidsSeries(playlistId: string, limit = 18) {
  const items = await prisma.m3uChannel.findMany({
    where: {
      ...safeKidsWhere(playlistId),
      streamUrl: { contains: "/series/" },
      group: { isHidden: false, category: "kids" },
    },
    orderBy: { id: "desc" },
    take: limit * 3,
    select: KIDS_SELECT,
  });

  return dedupeChannels(items).slice(0, limit);
}

/** Grade completa infantil, paginada — usada na busca e no "ver tudo". */
export async function getKidsCatalog(
  playlistId: string,
  { search, page = 1, pageSize = 48 }: { search?: string; page?: number; pageSize?: number },
) {
  const where: Prisma.M3uChannelWhereInput = {
    ...safeKidsWhere(playlistId),
    group: { isHidden: false, category: "kids" },
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.m3uChannel.findMany({
      where,
      orderBy: { relevanceScore: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: KIDS_SELECT,
    }),
    prisma.m3uChannel.count({ where }),
  ]);

  return {
    items: dedupeChannels(items),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
