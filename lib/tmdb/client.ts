import "server-only";

import { redis, redisKeys } from "@/lib/redis";

/**
 * Cliente do TMDB (themoviedb.org).
 *
 * Serve para METADADOS e RECOMENDAÇÕES — sinopse, elenco, arte, títulos
 * semelhantes. O TMDB não distribui vídeo e a integração não fornece nem
 * indexa nenhum arquivo de mídia.
 *
 * A chave é gratuita mas exige cadastro em themoviedb.org/settings/api.
 * Sem TMDB_API_KEY configurada, tudo aqui degrada em silêncio: o admin
 * continua cadastrando à mão e as trilhas de recomendação somem.
 */

const BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/** TTL do cache. Metadados de filme praticamente não mudam; 24h é conservador. */
const CACHE_TTL_SECONDS = 60 * 60 * 24;

export type TmdbSearchResult = {
  tmdbId: number;
  name: string;
  originalName: string;
  overview: string;
  releaseYear: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  mediaType: "movie" | "tv";
};

export type TmdbDetails = TmdbSearchResult & {
  runtimeSeconds: number | null;
  genres: string[];
  director: string | null;
  cast: string[];
  country: string | null;
  /** Classificação indicativa brasileira, quando o TMDB tem o dado. */
  brazilianRating: string | null;
};

export function isTmdbConfigured() {
  return Boolean(process.env.TMDB_API_KEY || process.env.TMDB_READ_TOKEN);
}

export class TmdbNotConfiguredError extends Error {
  constructor() {
    super("TMDB_API_KEY ou TMDB_READ_TOKEN não configurada.");
    this.name = "TmdbNotConfiguredError";
  }
}

/**
 * GET com cache em Redis.
 *
 * O TMDB limita requisições por IP. Sem cache, abrir a mesma página de título
 * algumas vezes já começa a levar 429 — e o cache também evita pagar latência
 * de rede em toda renderização.
 */
async function tmdbFetch<T>(path: string, params: Record<string, string> = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  const readToken = process.env.TMDB_READ_TOKEN;
  if (!apiKey && !readToken) throw new TmdbNotConfiguredError();

  const url = new URL(`${BASE_URL}${path}`);
  if (apiKey) url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "pt-BR");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  // A chave do cache não pode conter a api_key, senão ela vaza para o Redis
  const cacheKey = redisKeys.tmdb(
    `${path}?${new URLSearchParams(params).toString()}`,
  );

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Redis fora do ar não pode impedir a consulta — apenas perde o cache
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (readToken) {
    headers["Authorization"] = `Bearer ${readToken}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`TMDB ${response.status} em ${path}`);
  }

  const data = (await response.json()) as T;

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(data));
  } catch {
    // idem
  }

  return data;
}

// ==========================================================
// NORMALIZAÇÃO
// ==========================================================

type RawResult = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  media_type?: string;
};

/** O TMDB usa `title` para filme e `name` para série. Aqui vira um formato só. */
function normalize(raw: RawResult, fallbackType: "movie" | "tv"): TmdbSearchResult {
  const date = raw.release_date || raw.first_air_date || "";
  const year = date ? Number(date.slice(0, 4)) : null;

  return {
    tmdbId: raw.id,
    name: raw.title || raw.name || "",
    originalName: raw.original_title || raw.original_name || "",
    overview: raw.overview || "",
    releaseYear: year && Number.isFinite(year) ? year : null,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    rating: raw.vote_average ?? 0,
    mediaType: (raw.media_type === "tv" ? "tv" : raw.media_type === "movie" ? "movie" : fallbackType),
  };
}

export function tmdbImage(
  path: string | null,
  size: "w342" | "w500" | "w780" | "w1280" | "original" = "w500",
) {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

// ==========================================================
// API PÚBLICA
// ==========================================================

export async function searchTmdb(query: string): Promise<TmdbSearchResult[]> {
  if (!query.trim()) return [];

  const data = await tmdbFetch<{ results: RawResult[] }>("/search/multi", {
    query: query.trim(),
    include_adult: "false",
  });

  return data.results
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 12)
    .map((item) => normalize(item, "movie"));
}

export async function getTmdbDetails(
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<TmdbDetails> {
  const path = mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;

  const data = await tmdbFetch<
    RawResult & {
      runtime?: number;
      episode_run_time?: number[];
      genres?: { name: string }[];
      production_countries?: { iso_3166_1: string }[];
      credits?: {
        crew?: { job: string; name: string }[];
        cast?: { name: string }[];
      };
      release_dates?: {
        results?: { iso_3166_1: string; release_dates?: { certification: string }[] }[];
      };
      content_ratings?: { results?: { iso_3166_1: string; rating: string }[] };
    }
  >(path, { append_to_response: "credits,release_dates,content_ratings" });

  const base = normalize(data, mediaType);

  const minutes = data.runtime ?? data.episode_run_time?.[0] ?? null;

  // Classificação indicativa brasileira: filme e série ficam em campos
  // diferentes na API, e nem todo título tem o dado para o Brasil.
  const brazilianRating =
    data.release_dates?.results?.find((r) => r.iso_3166_1 === "BR")
      ?.release_dates?.[0]?.certification ||
    data.content_ratings?.results?.find((r) => r.iso_3166_1 === "BR")?.rating ||
    null;

  return {
    ...base,
    runtimeSeconds: minutes ? minutes * 60 : null,
    genres: data.genres?.map((g) => g.name) ?? [],
    director:
      data.credits?.crew?.find((c) => c.job === "Director")?.name ?? null,
    cast: data.credits?.cast?.slice(0, 8).map((c) => c.name) ?? [],
    country: data.production_countries?.[0]?.iso_3166_1 ?? null,
    brazilianRating: brazilianRating || null,
  };
}

/** IDs de títulos semelhantes, segundo o grafo de recomendação do TMDB. */
export async function getTmdbRecommendations(
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<number[]> {
  const path =
    mediaType === "tv"
      ? `/tv/${tmdbId}/recommendations`
      : `/movie/${tmdbId}/recommendations`;

  const data = await tmdbFetch<{ results: RawResult[] }>(path);
  return data.results.map((item) => item.id);
}

/** Busca os títulos em alta na semana no TMDB (Trending) */
export async function getTrendingTmdb(type: "all" | "movie" | "tv" = "all"): Promise<TmdbSearchResult[]> {
  if (!isTmdbConfigured()) return [];
  try {
    const data = await tmdbFetch<{ results: RawResult[] }>(`/trending/${type}/week`, {
      language: "pt-BR",
    });
    return data.results.map((item) => normalize(item, type === "tv" ? "tv" : "movie"));
  } catch {
    return [];
  }
}

// ==========================================================
// NOVIDADES — as listas que alimentam os destaques da home
// ==========================================================

/**
 * Toda chamada de descoberta segue o mesmo contrato: uma requisição só,
 * cacheada, e `[]` em qualquer falha. A home nunca quebra por causa do TMDB —
 * a trilha correspondente simplesmente não aparece.
 */
async function discoverList(
  path: string,
  params: Record<string, string>,
  fallbackType: "movie" | "tv",
): Promise<TmdbSearchResult[]> {
  if (!isTmdbConfigured()) return [];
  try {
    const data = await tmdbFetch<{ results: RawResult[] }>(path, params);
    return (data.results ?? []).map((item) => normalize(item, fallbackType));
  } catch {
    return [];
  }
}

/** Em cartaz nos cinemas do Brasil — a base de "Lançamentos". */
export function getTmdbNowPlaying() {
  return discoverList("/movie/now_playing", { region: "BR", page: "1" }, "movie");
}

/** Estreias anunciadas. Vira "Chegando na sua lista" quando a M3U já tem. */
export function getTmdbUpcoming() {
  return discoverList("/movie/upcoming", { region: "BR", page: "1" }, "movie");
}

/** Busca trailer / clipe no YouTube no TMDB para o feed de cortes (Reels) */
export async function getTmdbVideoKey(
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<string | null> {
  try {
    const data = await tmdbFetch<{
      results: Array<{ key: string; site: string; type: string }>;
    }>(`/${mediaType}/${tmdbId}/videos`);
    const trailer = data.results?.find(
      (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser" || v.type === "Clip"),
    );
    return trailer?.key ?? data.results?.[0]?.key ?? null;
  } catch {
    return null;
  }
}

/** Populares do momento, por tipo. */
export function getTmdbPopular(type: "movie" | "tv") {
  return discoverList(
    type === "tv" ? "/tv/popular" : "/movie/popular",
    { region: "BR", page: "1" },
    type,
  );
}

/** Séries que vão ao ar hoje — bom sinal de "novo episódio". */
export function getTmdbAiringToday() {
  return discoverList("/tv/airing_today", { page: "1" }, "tv");
}

/** Recomendações e semelhantes com base em um título visto pelo usuário */
export async function getTmdbSimilarAndRecommended(
  tmdbId: number,
  type: "movie" | "tv",
): Promise<TmdbSearchResult[]> {
  const [recs, similar] = await Promise.all([
    discoverList(`/${type}/${tmdbId}/recommendations`, { page: "1" }, type),
    discoverList(`/${type}/${tmdbId}/similar`, { page: "1" }, type),
  ]);
  const combined = [...recs, ...similar];
  const seen = new Set<number>();
  return combined.filter((item) => {
    if (seen.has(item.tmdbId)) return false;
    seen.add(item.tmdbId);
    return true;
  });
}

/** Aclamados: nota alta com volume mínimo de votos. */
export function getTmdbTopRated(type: "movie" | "tv") {
  return discoverList(
    type === "tv" ? "/tv/top_rated" : "/movie/top_rated",
    { region: "BR", page: "1" },
    type,
  );
}

/**
 * Animação com classificação livre. Gênero 16 = Animation no TMDB;
 * o filtro de certificação evita animação adulta na área infantil.
 */
export function getTmdbFamilyAnimation() {
  return discoverList(
    "/discover/movie",
    {
      with_genres: "16,10751",
      sort_by: "popularity.desc",
      "vote_count.gte": "80",
      certification_country: "BR",
      "certification.lte": "12",
      include_adult: "false",
      page: "1",
    },
    "movie",
  );
}

/** Desenhos e séries infantis populares. Gênero 10762 = Kids. */
export function getTmdbKidsShows() {
  return discoverList(
    "/discover/tv",
    {
      with_genres: "10762,16",
      sort_by: "popularity.desc",
      "vote_count.gte": "40",
      include_adult: "false",
      page: "1",
    },
    "tv",
  );
}

import { prisma } from "@/lib/prisma";
import { cleanMediaTitle, dedupeChannels, mapWithConcurrency } from "@/lib/utils";

/** Requisições simultâneas ao TMDB. Acima disso a API começa a devolver 429. */
const ENRICH_CONCURRENCY = 6;

/**
 * Quantas buscas NOVAS uma renderização pode disparar.
 *
 * Não é mais um teto de quantos itens ganham capa — é um teto de quanto se
 * gasta de rede numa renderização. Quem já foi resolvido antes vem do banco de
 * graça, então na segunda visita a página inteira aparece com arte; só o que
 * nunca foi visto entra nesta cota, e o resto é resolvido nas próximas.
 */
const MAX_BUSCAS_NOVAS = 24;

export type EnrichedChannel<T> = T & {
  posterUrl?: string | null;
  tmdbPosterUrl?: string | null;
  /** Arte horizontal, quando o TMDB tem — usada nos destaques. */
  backdropUrl?: string | null;
  tmdbRating?: number;
  year?: number | null;
  overview?: string;
};

type CanalCru = {
  id: string;
  name: string;
  logoUrl?: string | null;
  tmdbPosterUrl?: string | null;
  tmdbBackdropUrl?: string | null;
  tmdbRating?: number | null;
  tmdbYear?: number | null;
  tmdbOverview?: string | null;
  tmdbSyncedAt?: Date | null;
};

/** Aplica ao item o que já está gravado, sem tocar na rede. */
function doBanco<T extends CanalCru>(ch: T): EnrichedChannel<T> {
  const arte = ch.tmdbPosterUrl || ch.logoUrl || null;
  return {
    ...ch,
    logoUrl: arte,
    posterUrl: arte,
    tmdbPosterUrl: arte,
    backdropUrl: ch.tmdbBackdropUrl ?? null,
    tmdbRating: ch.tmdbRating ?? 0,
    year: ch.tmdbYear ?? null,
    overview: ch.tmdbOverview ?? "",
  };
}

/**
 * Grava o que o TMDB respondeu, para nunca mais perguntar.
 *
 * Falha de escrita é ignorada de propósito: a página já tem a arte em mãos e
 * não pode quebrar porque o banco recusou um UPDATE. O pior caso é consultar
 * de novo na próxima vez.
 */
async function gravarNoCanal(
  id: string,
  dados: {
    tmdbId?: number | null;
    tmdbMediaType?: string | null;
    tmdbPosterUrl?: string | null;
    tmdbBackdropUrl?: string | null;
    tmdbRating?: number | null;
    tmdbYear?: number | null;
    tmdbOverview?: string | null;
  },
) {
  try {
    await prisma.m3uChannel.update({
      where: { id },
      data: { ...dados, tmdbSyncedAt: new Date() },
    });
  } catch {}
}

export async function enrichChannelsWithTmdb<T extends CanalCru>(
  rawChannels: T[],
  limit = MAX_BUSCAS_NOVAS,
): Promise<EnrichedChannel<T>[]> {
  const channels = dedupeChannels(rawChannels);

  if (!isTmdbConfigured()) {
    return channels.map((c) => doBanco(c));
  }

  // Quem já foi consultado alguma vez sai daqui sem tocar na rede — inclusive
  // quem foi consultado e não deu em nada (tmdbSyncedAt preenchido, poster
  // nulo). Sem essa segunda parte, título que o TMDB não conhece seria
  // reconsultado em toda renderização e consumiria a cota para sempre.
  const pendentes = channels.filter((c) => !c.tmdbSyncedAt);
  const cota = new Set(pendentes.slice(0, limit).map((c) => c.id));

  return mapWithConcurrency(channels, ENRICH_CONCURRENCY, async (ch) => {
    if (!cota.has(ch.id)) return doBanco(ch);

    try {
      const results = await searchTmdb(cleanMediaTitle(ch.name));
      const first = results[0];

      if (!first) {
        // Marca como consultado sem resultado: é o que impede o retrabalho.
        // `gravarNoCanal` já carimba o tmdbSyncedAt.
        await gravarNoCanal(ch.id, {});
        return doBanco(ch);
      }

      const poster = tmdbImage(first.posterPath, "w342");
      const backdrop = tmdbImage(first.backdropPath, "w1280");

      await gravarNoCanal(ch.id, {
        tmdbId: first.tmdbId,
        tmdbMediaType: first.mediaType,
        tmdbPosterUrl: poster,
        tmdbBackdropUrl: backdrop,
        tmdbRating: first.rating || 0,
        tmdbYear: first.releaseYear,
        tmdbOverview: first.overview,
      });

      const arte = poster || ch.logoUrl || null;
      return {
        ...ch,
        logoUrl: arte,
        posterUrl: arte,
        tmdbPosterUrl: arte,
        backdropUrl: backdrop,
        tmdbRating: first.rating || 0,
        year: first.releaseYear,
        overview: first.overview,
      };
    } catch {
      // Rede fora do ar não vira marca de "consultado": tem que tentar de novo.
      return doBanco(ch);
    }
  });
}



