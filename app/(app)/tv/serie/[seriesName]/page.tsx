import Link from "next/link";
import { Play, Star } from "lucide-react";

import { Artwork } from "@/components/iptv/artwork";
import { GUTTER } from "@/components/iptv/section";
import { EmptyPlaylist } from "@/components/iptv/playlist-state";
import { requireUser } from "@/lib/auth/session";
import { getSeriesEpisodes, getViewablePlaylist } from "@/lib/queries/iptv";
import { getTmdbDetails, isTmdbConfigured, searchTmdb, tmdbImage } from "@/lib/tmdb/client";
import { cleanMediaTitle, cleanSeriesTitle } from "@/lib/utils";
import { SeasonTabs } from "./season-tabs";

export const dynamic = "force-dynamic";

type Episode = Awaited<ReturnType<typeof getSeriesEpisodes>>[number] & {
  episodeNum: number;
};

export default async function SeriesPage({
  params,
}: {
  params: { seriesName: string };
}) {
  try {
    const user = await requireUser();
    const playlist = await getViewablePlaylist(user.id);

    if (!playlist || !playlist.hasChannels) {
      return (
        <div className="min-h-screen pb-24 pt-20">
          <div className={`${GUTTER}`}>
            <EmptyPlaylist status={playlist?.syncStatus ?? "IDLE"} />
          </div>
        </div>
      );
    }

    const seriesName = decodeURIComponent(params.seriesName);
    const episodes = await getSeriesEpisodes(playlist.id, seriesName);

    if (episodes.length === 0) {
      return (
        <div className="min-h-screen pb-24 pt-20">
          <div className={`${GUTTER}`}>
            <div className="rounded-3xl border border-white/[0.08] bg-surface/50 p-12 text-center">
              <h2 className="text-2xl font-bold text-foreground">Série não encontrada</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Não encontramos episódios disponíveis para “{cleanSeriesTitle(seriesName)}” na sua lista IPTV.
              </p>
              <Link
                href="/tv/series"
                className="mt-6 inline-flex items-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-105"
              >
                Voltar para Séries
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // "Nome S02E05" é o padrão das listas; o que não casa vira temporada 1.
    const seasonsMap = new Map<number, Episode[]>();

    for (const episode of episodes) {
      const match = episode.name.match(/(?:S|T)(\d+)\s*(?:E|X)(\d+)/i) || episode.name.match(/EP?\s*\.?\s*(\d+)/i);
      const season = match && match[2] ? Number.parseInt(match[1], 10) : 1;
      const number = match ? Number.parseInt(match[2] || match[1], 10) : 1;

      const bucket = seasonsMap.get(season) ?? [];
      bucket.push({ ...episode, episodeNum: number });
      seasonsMap.set(season, bucket);
    }

    for (const bucket of seasonsMap.values()) {
      bucket.sort((a, b) => a.episodeNum - b.episodeNum);
    }

    const seasons = [...seasonsMap.keys()].sort((a, b) => a - b);
    const seasonsData: Record<number, Episode[]> = {};
    for (const [season, bucket] of seasonsMap) seasonsData[season] = bucket;

    const cleanName = cleanSeriesTitle(seriesName);

    let tmdb = null;
    let backdropUrl = episodes[0].logoUrl;
    let posterUrl = episodes[0].logoUrl;

    if (isTmdbConfigured()) {
      try {
        const results = await searchTmdb(cleanName);
        if (results.length > 0) {
          tmdb = await getTmdbDetails(results[0].tmdbId, results[0].mediaType);
          backdropUrl = tmdbImage(tmdb.backdropPath, "w1280") ?? backdropUrl;
          posterUrl = tmdbImage(tmdb.posterPath, "w342") ?? posterUrl;
        }
      } catch {
        // Sem TMDB a página segue com a arte da própria lista
      }
    }

    const firstEpisode = seasonsData[seasons[0]]?.[0];

    return (
      <div className="min-h-screen pb-24">
        <div className="relative isolate h-[62vh] min-h-[420px] w-full overflow-hidden">
          <Artwork src={backdropUrl} alt={cleanName} seed={seriesName} role="backdrop" eager />
          <div className="scrim-hero absolute inset-0" />
          <div className="film-grain absolute inset-0" />

          <div className={`${GUTTER} relative flex h-full items-end pb-10`}>
            <div className="flex items-end gap-6">
              <div className="card-edge hidden aspect-[2/3] w-[150px] shrink-0 overflow-hidden rounded-xl bg-surface md:block">
                <Artwork src={posterUrl} alt={cleanName} seed={`${seriesName}-poster`} sizes="150px" />
              </div>

              <div className="max-w-2xl">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                  Série
                </p>

                <h1 className="text-balance text-3xl font-bold leading-[1.05] tracking-tightest text-foreground md:text-5xl">
                  {tmdb?.name || cleanName}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                  {tmdb && tmdb.rating > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-accent">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {tmdb.rating.toFixed(1)}
                    </span>
                  )}
                  {tmdb?.releaseYear && <span className="tabular-nums">{tmdb.releaseYear}</span>}
                  <span className="tabular-nums">
                    {seasons.length} {seasons.length === 1 ? "temporada" : "temporadas"}
                  </span>
                  <span className="tabular-nums">{episodes.length} episódios</span>
                  {tmdb?.genres?.length ? <span>{tmdb.genres.slice(0, 3).join(" · ")}</span> : null}
                </div>

                {tmdb?.overview && (
                  <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted">
                    {tmdb.overview}
                  </p>
                )}

                {firstEpisode && (
                  <Link
                    href={`/tv/assistir/${firstEpisode.id}`}
                    className="mt-7 flex w-fit items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                  >
                    <Play className="h-4 w-4" fill="currentColor" />
                    Assistir T{seasons[0]} · E{firstEpisode.episodeNum || 1}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`${GUTTER} mt-10`}>
          <SeasonTabs seasons={seasons} seasonsData={seasonsData} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("[SeriesPage Error]", error);
    return (
      <div className="min-h-screen pb-24 pt-20">
        <div className={`${GUTTER}`}>
          <div className="rounded-3xl border border-white/[0.08] bg-surface/50 p-12 text-center">
            <h2 className="text-2xl font-bold text-foreground">Séries</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Não foi possível carregar esta série no momento. Tente novamente mais tarde.
            </p>
            <Link
              href="/tv/series"
              className="mt-6 inline-flex items-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white"
            >
              Voltar para Séries
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
