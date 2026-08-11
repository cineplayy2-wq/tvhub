import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Radio, Star, Calendar } from "lucide-react";

import { QualityBadge } from "@/components/iptv/quality-badge";
import { SectionHeader } from "@/components/iptv/section";
import { FavoriteButton } from "@/components/iptv/favorite-button";
import { TileCard } from "@/components/iptv/tile-card";
import { IptvPlayer } from "@/components/iptv/iptv-player";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { getChannelById, getPlaylistChannels } from "@/lib/queries/iptv";
import { isTmdbConfigured, searchTmdb, getTmdbDetails, tmdbImage, type TmdbDetails } from "@/lib/tmdb/client";
import { prisma } from "@/lib/prisma";
import { cleanMediaTitle, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

function cleanNameForTmdb(name: string): string {
  return name
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/\b(4K|FHD|HD|SD|DUBLADO|LEGENDADO|DUB|LEG|NATIONAL|COMPLETE|S\d+E\d+)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function WatchChannelPage({
  params,
}: {
  params: { channelId: string };
}) {
  const user = await requireUser();
  const activeProfile = await getActiveProfile(user.id);
  let channel = await getChannelById(params.channelId);

  if (!channel) {
    const userPlaylist = await prisma.m3uPlaylist.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (userPlaylist) {
      const fallbackChannel = await prisma.m3uChannel.findFirst({
        where: { playlistId: userPlaylist.id, isActive: true },
        include: {
          group: { select: { id: true, name: true, slug: true, category: true } },
          playlist: { select: { id: true, userId: true } },
        },
        orderBy: { relevanceScore: "desc" },
      });
      if (fallbackChannel) {
        channel = fallbackChannel;
      }
    }
  }

  if (!channel || channel.playlist.userId !== user.id) {
    notFound();
  }

  // Posição de progresso salva para o perfil ativo
  let initialPosition = 0;
  if (activeProfile?.id) {
    try {
      const cleanTitleKey = slugify(cleanMediaTitle(channel.name));
      const saved = await prisma.watchProgress.findFirst({
        where: { profileId: activeProfile.id, itemKey: cleanTitleKey },
        select: { positionSeconds: true, completed: true },
      });
      if (saved && !saved.completed && saved.positionSeconds > 10) {
        initialPosition = saved.positionSeconds;
      }
    } catch {}
  }

  // Fetch TMDB details if movie/series
  let tmdbDetails: TmdbDetails | null = null;
  const isVod =
    channel.group?.category === "movies" ||
    channel.group?.category === "series" ||
    /\.(mp4|mkv|avi|webm)/i.test(channel.streamUrl) ||
    channel.streamUrl.includes("/movie/") ||
    channel.streamUrl.includes("/series/");

  const isLive = !isVod;

  if (isVod && isTmdbConfigured()) {
    try {
      const cleanName = cleanNameForTmdb(channel.name);
      const searchResults = await searchTmdb(cleanName);
      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];
        tmdbDetails = await getTmdbDetails(bestMatch.tmdbId, bestMatch.mediaType);
      }
    } catch {
      // TMDB fallback in silence
    }
  }

  // Fetch related channels from same group
  const relatedChannels = channel.group
    ? await getPlaylistChannels({
        playlistId: channel.playlist.id,
        groupId: channel.group.id,
        page: 1,
        pageSize: 12,
      })
    : null;

  const related = relatedChannels?.items.filter((ch) => ch.id !== channel.id).slice(0, 12) ?? [];

  const backdropUrl = tmdbImage(tmdbDetails?.backdropPath ?? null, "w1280");
  const posterUrl = tmdbImage(tmdbDetails?.posterPath ?? null, "w342") || channel.logoUrl;

  return (
    <div className="min-h-screen bg-black text-foreground">
      {/* Back button */}
      <div className="absolute left-4 top-4 z-40">
        <Link
          href={channel.group ? `/tv/${channel.group.slug}` : "/tv"}
          className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-black/90 hover:text-white shadow-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>

      {/* Player */}
      <div className="relative aspect-video w-full bg-black shadow-2xl">
        <IptvPlayer
          streamUrl={channel.streamUrl}
          channelName={tmdbDetails?.name || channel.name}
          channelId={channel.id}
          isLive={isLive}
          alternativeStreams={channel.backupStreamUrl ? [channel.backupStreamUrl] : []}
          initialPosition={initialPosition}
        />
      </div>

      {/* Channel & TMDB Metadata */}
      <div className="relative bg-background px-4 py-6 md:px-8">
        {/* Optional Backdrop Glow */}
        {backdropUrl && (
          <div
            className="absolute inset-0 z-0 opacity-15 blur-3xl pointer-events-none"
            style={{
              backgroundImage: `url(${backdropUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={channel.name}
                  className="h-20 w-16 md:h-28 md:w-20 rounded-xl object-cover shadow-lg border border-border/50 shrink-0"
                />
              ) : (
                <div className="flex h-20 w-16 md:h-28 md:w-20 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-border/50 shrink-0">
                  <Radio className="h-8 w-8 text-primary/60" strokeWidth={1.5} />
                </div>
              )}
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-foreground">
                  {tmdbDetails?.name || channel.name}
                </h1>

                {/* Subtitle / TMDB Meta badges */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {channel.group && (
                    <Link
                      href={`/tv/${channel.group.slug}`}
                      className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-foreground hover:text-primary transition-colors border border-border/50"
                    >
                      {channel.group.name}
                    </Link>
                  )}

                  <QualityBadge quality={channel.quality} />

                  {channel.group?.category === "live" && (
                    <span className="flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-0.5 font-bold uppercase tracking-wider text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      AO VIVO
                    </span>
                  )}

                  {tmdbDetails?.releaseYear && (
                    <span className="flex items-center gap-1 rounded-md bg-surface px-2.5 py-1 text-xs border border-border/40">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {tmdbDetails.releaseYear}
                    </span>
                  )}

                  {tmdbDetails?.rating ? (
                    <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {tmdbDetails.rating.toFixed(1)} TMDB
                    </span>
                  ) : null}
                </div>

                {/* Genres */}
                {tmdbDetails?.genres && tmdbDetails.genres.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tmdbDetails.genres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary border border-primary/20"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <FavoriteButton
              channelId={channel.id}
              isFavorite={channel.isFavorite}
              className="rounded-full border border-border bg-surface-elevated p-3 hover:bg-surface"
            />
          </div>

          {/* Sinopse / TMDB Overview */}
          {tmdbDetails?.overview ? (
            <div className="mt-6 rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur-md">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Sinopse do Conteúdo
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                {tmdbDetails.overview}
              </p>
              {tmdbDetails.cast && tmdbDetails.cast.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <span className="text-xs font-bold text-muted-foreground">Elenco: </span>
                  <span className="text-xs text-foreground/80">{tmdbDetails.cast.join(", ")}</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Related channels */}
          {related.length > 0 && (
            <div className="mt-10">
              <SectionHeader
                title={channel.group ? `Mais em ${channel.group.name}` : "Recomendados"}
                className="mb-5"
              />
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {related.map((item) => (
                  <TileCard
                    key={item.id}
                    channel={item}
                    live={item.group?.category === "live"}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
