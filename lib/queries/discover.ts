import "server-only";

import type { Prisma } from "@prisma/client";

import { cached, TTL } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import type { TmdbSearchResult } from "@/lib/tmdb/client";
import { getTmdbPopular, getTmdbSimilarAndRecommended, getTmdbTopRated, tmdbImage } from "@/lib/tmdb/client";
import { normalizeTitleKey, qualityRank, searchStemFor } from "@/lib/utils";

/**
 * Cruzamento TMDB × M3U.
 *
 * A home antiga fazia o caminho inverso: pegava canais da lista e perguntava
 * ao TMDB o que eram — uma requisição por canal, dezenas por render, e o
 * "destaque" acabava sendo qualquer coisa que estivesse no topo da tabela.
 *
 * Aqui a direção é a certa: o TMDB diz o que é novidade AGORA (uma requisição
 * por trilha, cacheada), e o banco responde em UMA consulta quais desses
 * títulos o assinante realmente tem. O que ele não tem simplesmente não é
 * anunciado — destaque de conteúdo inexistente é a pior experiência possível.
 */

export type ShowcaseItem = {
  /** Id do canal na M3U — é para onde o play aponta. */
  id: string;
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  quality: string | null;
  isFavorite: boolean;
  relevanceScore: number;
  group: { name: string; slug: string; category: string | null } | null;

  // Metadados do TMDB
  tmdbId: number;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  rating: number;
  year: number | null;
  mediaType: "movie" | "tv";
  /** Verdadeiro quando o item é episódio de série na lista (rota diferente). */
  isSeries: boolean;
};

type CandidateChannel = {
  id: string;
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  quality: string | null;
  isFavorite: boolean;
  relevanceScore: number;
  group: { name: string; slug: string; category: string | null } | null;
};

const CANDIDATE_SELECT = {
  id: true,
  name: true,
  streamUrl: true,
  logoUrl: true,
  quality: true,
  isFavorite: true,
  relevanceScore: true,
  group: { select: { name: true, slug: true, category: true } },
} satisfies Prisma.M3uChannelSelect;

/** Teto de termos por consulta: cada `contains` é um ILIKE a mais no plano. */
const MAX_TERMS = 24;
/** Teto de linhas trazidas para o casamento em memória. */
const MAX_CANDIDATES = 900;

/**
 * Dado um lote de títulos do TMDB, devolve os que existem na lista do usuário.
 *
 * Uma única consulta com OR de prefixos, e o casamento fino acontece em
 * memória — comparar chave normalizada no JS é barato e captura variações que
 * o `contains` sozinho erraria ("Homem-Aranha" vs "Homem Aranha").
 */
export async function matchTmdbInPlaylist(
  playlistId: string,
  tmdbItems: TmdbSearchResult[],
  { limit = 12, preferType }: { limit?: number; preferType?: "movie" | "tv" } = {},
): Promise<ShowcaseItem[]> {
  if (tmdbItems.length === 0) return [];

  const wanted = tmdbItems.slice(0, MAX_TERMS).filter((item) => {
    const key = normalizeTitleKey(item.name);
    return key.length >= 3;
  });
  if (wanted.length === 0) return [];

  const stems = wanted
    .map((item) => searchStemFor(item.name, 3))
    .filter((stem) => stem.length >= 3);
  if (stems.length === 0) return [];

  const candidates = (await prisma.m3uChannel.findMany({
    where: {
      playlistId,
      isActive: true,
      group: { isHidden: false, category: { not: "adult" } },
      OR: stems.map((stem) => ({
        name: { contains: stem, mode: "insensitive" as const },
      })),
      NOT: [
        { name: { contains: "24H", mode: "insensitive" } },
        { name: { contains: "XXX", mode: "insensitive" } },
      ],
    },
    take: MAX_CANDIDATES,
    orderBy: { relevanceScore: "desc" },
    select: CANDIDATE_SELECT,
  })) as CandidateChannel[];

  if (candidates.length === 0) return [];

  // Índice por chave normalizada: um título pode ter várias versões na lista
  // (dublado, legendado, 4K) e queremos escolher, não a primeira que aparecer.
  const byKey = new Map<string, CandidateChannel[]>();
  for (const channel of candidates) {
    const key = normalizeTitleKey(channel.name);
    if (!key) continue;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(channel);
    else byKey.set(key, [channel]);
  }
  const keys = [...byKey.keys()];

  const matched: ShowcaseItem[] = [];
  const usedChannelIds = new Set<string>();

  for (const item of wanted) {
    if (matched.length >= limit) break;

    const key = normalizeTitleKey(item.name);
    let bucket = byKey.get(key);

    // Sem casamento exato, aceita o nome do canal que COMEÇA pelo título —
    // é o formato de episódio ("Round 6 S02E01") e de edição ("Duna Parte 2").
    if (!bucket) {
      const nearKey = keys.find(
        (candidateKey) =>
          candidateKey.startsWith(`${key} `) || key.startsWith(`${candidateKey} `),
      );
      if (nearKey) bucket = byKey.get(nearKey);
    }
    if (!bucket || bucket.length === 0) continue;

    const wantSeries = (preferType ?? item.mediaType) === "tv";
    const best = pickBestVersion(bucket, wantSeries);
    if (!best || usedChannelIds.has(best.id)) continue;

    usedChannelIds.add(best.id);
    matched.push({
      ...best,
      name: item.name,
      tmdbId: item.tmdbId,
      posterUrl: tmdbImage(item.posterPath, "w342") ?? best.logoUrl,
      backdropUrl: tmdbImage(item.backdropPath, "w1280"),
      overview: item.overview,
      rating: item.rating,
      year: item.releaseYear,
      mediaType: item.mediaType,
      isSeries: best.streamUrl.includes("/series/") || best.group?.category === "series",
    });
  }

  return matched;
}

/**
 * Escolhe a melhor versão de um mesmo título.
 *
 * Prioridade: tipo certo (filme x série) > resolução > relevância. Sem isso o
 * destaque cai numa cópia SD quando existe 4K na mesma lista.
 */
function pickBestVersion(bucket: CandidateChannel[], wantSeries: boolean) {
  const typed = bucket.filter((channel) => {
    const isSeries =
      channel.streamUrl.includes("/series/") || channel.group?.category === "series";
    return isSeries === wantSeries;
  });

  const pool = typed.length > 0 ? typed : bucket;

  return [...pool].sort(
    (a, b) =>
      qualityRank(b.quality) - qualityRank(a.quality) ||
      b.relevanceScore - a.relevanceScore,
  )[0];
}

/** Rota de destino de um item: série vai para a página de temporadas. */
export function showcaseHref(item: ShowcaseItem) {
  return item.isSeries
    ? `/tv/serie/${encodeURIComponent(item.name)}`
    : `/tv/assistir/${item.id}`;
}

/**
 * Cache de uma trilha da vitrine.
 *
 * As trilhas dependem de TMDB + banco e mudam devagar — o TMDB atualiza
 * "em alta" uma vez por dia. Meia hora de cache por playlist derruba o tempo
 * de render de segundos para milissegundos sem congelar a vitrine.
 */
export function cachedRow<T>(key: string, build: () => Promise<T>): Promise<T> {
  return cached(`showcase:${key}`, TTL.showcase, build);
}

/**
 * Recomendações personalizadas para o perfil com base no histórico ou populares.
 */
export async function getPersonalizedRecommendations(
  playlistId: string,
  profileId: string,
  type: "movie" | "tv",
  limit = 20,
): Promise<ShowcaseItem[]> {
  return cachedRow(`${playlistId}:recs:${profileId}:${type}`, async () => {
    try {
      const history = await prisma.watchProgress.findMany({
        where: { profileId, positionSeconds: { gt: 30 } },
        orderBy: { lastWatched: "desc" },
        take: 4,
        select: { tmdbId: true, itemKey: true, tmdbMediaType: true },
      });

      const candidateTmdbIds: number[] = history
        .filter((h) => typeof h.tmdbId === "number" && (h.tmdbMediaType === type || !h.tmdbMediaType))
        .map((h) => h.tmdbId as number);

      let tmdbRecs: TmdbSearchResult[] = [];

      for (const tmdbId of candidateTmdbIds.slice(0, 2)) {
        try {
          const recs = await getTmdbSimilarAndRecommended(tmdbId, type);
          if (recs.length > 0) tmdbRecs.push(...recs);
        } catch {}
      }

      if (tmdbRecs.length < 10) {
        try {
          const [popular, topRated] = await Promise.all([
            getTmdbPopular(type),
            getTmdbTopRated(type),
          ]);
          tmdbRecs.push(...popular, ...topRated);
        } catch {}
      }

      const seen = new Set<number>();
      const uniqueTmdb = tmdbRecs.filter((item) => {
        if (seen.has(item.tmdbId)) return false;
        seen.add(item.tmdbId);
        return true;
      });

      return matchTmdbInPlaylist(playlistId, uniqueTmdb, {
        limit,
        preferType: type,
      });
    } catch {
      return [];
    }
  });
}
