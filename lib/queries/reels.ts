import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { cleanMediaTitle, dedupeChannels } from "@/lib/utils";
import {
  getTmdbVideoKey,
  isTmdbConfigured,
  searchTmdb,
  tmdbImage,
} from "@/lib/tmdb/client";

export type ReelItem = {
  id: string;
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  backdropUrl: string | null;
  posterUrl: string | null;
  overview: string | null;
  rating: number;
  year: number | null;
  videoKey: string | null;
  quality: string | null;
  isSeries: boolean;
  groupName: string | null;
};

/**
 * Retorna cortes infinitos paginados de filmes e séries para a aba Dicas.
 * Não limita a 50: suporta paginação infinita para rolagem contínua sem travar.
 */
export async function getDailyReelsFeed(
  playlistId?: string,
  page = 1,
  pageSize = 15,
): Promise<{ items: ReelItem[]; hasMore: boolean }> {
  const skip = (page - 1) * pageSize;
  const take = pageSize * 2; // Busca um lote maior para dedup

  let rawChannels: Array<{
    id: string;
    name: string;
    streamUrl: string;
    logoUrl: string | null;
    quality: string | null;
    group: { name: string; category: string | null } | null;
  }> = [];

  const whereCondition = {
    ...(playlistId ? { playlistId } : {}),
    isActive: true,
    group: {
      isHidden: false,
      category: { not: "adult" },
      NOT: [
        { name: { contains: "xxx", mode: "insensitive" as const } },
        { name: { contains: "+18", mode: "insensitive" as const } },
        { name: { contains: "adult", mode: "insensitive" as const } },
      ],
    },
    OR: [
      { streamUrl: { contains: "/movie/" } },
      { streamUrl: { contains: "/series/" } },
      { group: { category: "movies" } },
      { group: { category: "series" } },
    ],
  };

  rawChannels = await prisma.m3uChannel.findMany({
    where: whereCondition,
    skip,
    take,
    orderBy: [{ relevanceScore: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      streamUrl: true,
      logoUrl: true,
      quality: true,
      group: { select: { name: true, category: true } },
    },
  });

  const deduped = dedupeChannels(rawChannels).slice(0, pageSize);
  if (deduped.length === 0) return { items: [], hasMore: false };

  // Enriquece com TMDB usando cache no Redis para velocidade instantânea
  const enriched = await Promise.all(
    deduped.map(async (item) => {
      const cleanName = cleanMediaTitle(item.name);
      const cacheKey = `reel:meta:${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            id: item.id,
            name: parsed.name || cleanName,
            streamUrl: item.streamUrl,
            logoUrl: item.logoUrl,
            backdropUrl: parsed.backdropUrl || item.logoUrl,
            posterUrl: parsed.posterUrl || item.logoUrl,
            overview: parsed.overview || "Assista a este destaque imperdível agora mesmo.",
            rating: parsed.rating || 0,
            year: parsed.year || null,
            videoKey: parsed.videoKey || null,
            quality: item.quality ?? "FHD",
            isSeries: parsed.isSeries ?? (item.streamUrl.includes("/series/") || item.group?.category === "series"),
            groupName: item.group?.name ?? null,
          };
        }
      } catch {}

      if (isTmdbConfigured()) {
        try {
          const results = await searchTmdb(cleanName);
          if (results.length > 0) {
            const first = results[0];
            const videoKey = await getTmdbVideoKey(first.tmdbId, first.mediaType).catch(() => null);
            const meta = {
              name: first.name || cleanName,
              backdropUrl: tmdbImage(first.backdropPath, "w1280") || item.logoUrl,
              posterUrl: tmdbImage(first.posterPath, "w500") || item.logoUrl,
              overview: first.overview || "Assista a este destaque imperdível agora mesmo.",
              rating: first.rating || 0,
              year: first.releaseYear,
              videoKey,
              isSeries: first.mediaType === "tv" || item.streamUrl.includes("/series/"),
            };

            // Guarda em cache por 7 dias
            void redis.set(cacheKey, JSON.stringify(meta), "EX", 7 * 24 * 60 * 60).catch(() => {});

            return {
              id: item.id,
              ...meta,
              streamUrl: item.streamUrl,
              logoUrl: item.logoUrl,
              quality: item.quality ?? "FHD",
              groupName: item.group?.name ?? null,
            };
          }
        } catch {}
      }

      return {
        id: item.id,
        name: cleanName,
        streamUrl: item.streamUrl,
        logoUrl: item.logoUrl,
        backdropUrl: item.logoUrl,
        posterUrl: item.logoUrl,
        overview: "Corte selecionado do catálogo.",
        rating: 0,
        year: null,
        videoKey: null,
        quality: item.quality ?? "HD",
        isSeries: item.streamUrl.includes("/series/") || item.group?.category === "series",
        groupName: item.group?.name ?? null,
      };
    }),
  );

  return {
    items: enriched,
    hasMore: rawChannels.length >= pageSize,
  };
}
