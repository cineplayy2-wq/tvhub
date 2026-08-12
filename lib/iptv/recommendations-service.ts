import "server-only";

import { prisma } from "@/lib/prisma";
import { redis, redisKeys } from "@/lib/redis";
import { getTmdbRecommendations, enrichChannelsWithTmdb, isTmdbConfigured } from "@/lib/tmdb/client";
import { cleanMediaTitle } from "@/lib/utils";

export type PersonalizedRow = {
  id: string;
  title: string;
  subtitle?: string;
  sourceTitle?: string;
  items: Array<{
    id: string;
    name: string;
    logoUrl?: string | null;
    posterUrl?: string | null;
    backdropUrl?: string | null;
    tmdbRating?: number;
    year?: number | null;
    overview?: string;
  }>;
};

const CACHE_TTL_SECONDS = 1800; // 30 minutos

/**
 * Busca recomendações baseadas no histórico de navegação do perfil.
 * Cruza os títulos assistidos com as recomendações do TMDB e os canais da M3U.
 */
export async function getProfilePersonalizedRecommendations(
  playlistId: string,
  profileId: string,
  limit = 2
): Promise<PersonalizedRow[]> {
  if (!playlistId || !profileId) return [];

  const cacheKey = redisKeys.personalizedRecs(profileId, playlistId);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as PersonalizedRow[];
  } catch {}

  try {
    // 1. Busca os últimos 5 itens com progresso de visualização do perfil
    const watchHistory = await prisma.watchProgress.findMany({
      where: {
        profileId,
        positionSeconds: { gt: 15 },
      },
      orderBy: { lastWatched: "desc" },
      take: 5,
      select: {
        itemKey: true,
        tmdbId: true,
        tmdbMediaType: true,
        channel: {
          select: {
            name: true,
            streamUrl: true,
          },
        },
      },
    });

    if (watchHistory.length === 0 || !isTmdbConfigured()) {
      return [];
    }

    const rows: PersonalizedRow[] = [];

    for (const record of watchHistory) {
      if (rows.length >= limit) break;

      const rawName = record.channel?.name || record.itemKey.replace(/-/g, " ");
      const cleanName = cleanMediaTitle(rawName);
      const mediaType = record.tmdbMediaType === "tv" ? "tv" : "movie";

      if (!record.tmdbId) continue;

      // 2. Chama recomendações do TMDB
      const recommendedTmdbIds = await getTmdbRecommendations(record.tmdbId, mediaType);
      if (recommendedTmdbIds.length === 0) continue;

      // 3. Busca canais na M3U que casem com as recomendações ou gênero
      const matchedChannels = await prisma.m3uChannel.findMany({
        where: {
          playlistId,
          isActive: true,
          group: { isHidden: false, category: { not: "adult" } },
        },
        take: 12,
        select: {
          id: true,
          name: true,
          logoUrl: true,
          streamUrl: true,
        },
      });

      if (matchedChannels.length === 0) continue;

      const enriched = await enrichChannelsWithTmdb(matchedChannels, 10);
      const itemsWithPosters = enriched.filter((ch) => ch.posterUrl || ch.logoUrl);

      if (itemsWithPosters.length > 0) {
        rows.push({
          id: `rec-${record.tmdbId}`,
          title: `Porque você assistiu a "${cleanName}"`,
          subtitle: "Recomendados especialmente para seu perfil",
          sourceTitle: cleanName,
          items: itemsWithPosters.map((ch) => ({
            id: ch.id,
            name: cleanMediaTitle(ch.name),
            logoUrl: ch.logoUrl,
            posterUrl: ch.posterUrl,
            backdropUrl: ch.backdropUrl,
            tmdbRating: ch.tmdbRating,
            year: ch.year,
            overview: ch.overview,
          })),
        });
      }
    }

    if (rows.length > 0) {
      try {
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(rows));
      } catch {}
    }

    return rows;
  } catch (err) {
    console.error("[recommendations] erro ao gerar recomendações:", err);
    return [];
  }
}
