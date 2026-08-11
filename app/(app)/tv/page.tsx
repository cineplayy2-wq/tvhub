import { Suspense } from "react";

import { PosterCard } from "@/components/iptv/poster-card";
import { Rail } from "@/components/iptv/rail";
import { RankCard } from "@/components/iptv/rank-card";
import { GUTTER, SectionHeader } from "@/components/iptv/section";
import { ShowcaseHero, type HeroSlide } from "@/components/iptv/showcase-hero";
import { FilterBar } from "@/components/iptv/filter-bar";
import { EmptyPlaylist, SyncBanner } from "@/components/iptv/playlist-state";
import { HeroSkeleton, RailSkeleton } from "@/components/iptv/skeletons";
import { TileCard } from "@/components/iptv/tile-card";
import { ContinueWatchingRail } from "@/components/iptv/continue-watching-rail";
import { getAiPickedCurations } from "@/lib/ai/smart-recommender";
import { getActiveProfile, getCurrentUser, requireUser } from "@/lib/auth/session";
import { FILTER_GROUPS, getFilterCounts } from "@/lib/queries/filters";
import { getContinueWatchingList } from "@/lib/iptv/watch-progress-service";
import {
  cachedRow,
  matchTmdbInPlaylist,
  showcaseHref,
  type ShowcaseItem,
} from "@/lib/queries/discover";
import {
  getChannelsByCategory,
  getPlaylistChannels,
  getViewablePlaylist,
} from "@/lib/queries/iptv";
import {
  enrichChannelsWithTmdb,
  getTmdbNowPlaying,
  getTmdbPopular,
  getTmdbTopRated,
  getTrendingTmdb,
} from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

export default async function TvPage() {
  try {
    const user = await requireUser();
    const playlist = await getViewablePlaylist(user.id);
    const activeProfile = await getActiveProfile(user.id).catch(() => null);

    if (!playlist) return <EmptyPlaylist />;
    if (!playlist.hasChannels) return <EmptyPlaylist status={playlist.syncStatus} />;

    const playlistId = playlist.id;
    const filterCounts = await getFilterCounts(playlistId, "movies");

    return (
      <div className="pb-32">
        <SyncBanner isSyncing={playlist.isSyncing} isStale={playlist.isSyncStale} />

        {/* Filtros logo abaixo do cabeçalho, sobre a arte do hero — é a
            posição do protótipo. Ficam fixos junto com a barra do topo. */}
        <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+58px)] z-40 md:hidden">
          <FilterBar groups={FILTER_GROUPS} counts={filterCounts} />
        </div>

        {/* No desktop há largura sobrando: o filtro fica grudado no topo do
            conteúdo, sempre visível, em vez de escondido atrás de um toque. */}
        <div className="sticky top-0 z-40 hidden bg-background/90 py-3 supports-[backdrop-filter]:bg-background/70 supports-[backdrop-filter]:backdrop-blur-xl md:block">
          <FilterBar groups={FILTER_GROUPS} counts={filterCounts} />
        </div>

        <Suspense fallback={<HeroSkeleton />}>
          <HeroSection playlistId={playlistId} />
        </Suspense>

        {/* CONTINUAR ASSISTINDO (PROGRESSO % E CONTAGEM DE VEZES ASSISTIDO) */}
        {activeProfile && (
          <Suspense fallback={null}>
            <ContinueWatchingSection playlistId={playlistId} profileId={activeProfile.id} />
          </Suspense>
        )}

        <div className="space-y-12 md:space-y-14">
          <Suspense fallback={null}>
            <FavoritesRail playlistId={playlistId} />
          </Suspense>

          <Suspense fallback={<RailSkeleton />}>
            <ReleasesRail playlistId={playlistId} />
          </Suspense>

          <Suspense fallback={<RailSkeleton />}>
            <TopMoviesRail playlistId={playlistId} />
          </Suspense>

          <Suspense fallback={<RailSkeleton />}>
            <SeriesRails playlistId={playlistId} />
          </Suspense>

          <Suspense fallback={null}>
            <AiPicksRail playlistId={playlistId} />
          </Suspense>

          <Suspense fallback={<RailSkeleton />}>
            <AcclaimedRail playlistId={playlistId} />
          </Suspense>

          <Suspense fallback={<RailSkeleton />}>
            <KidsRail playlistId={playlistId} />
          </Suspense>
        </div>
      </div>
    );
  } catch (err) {
    console.error("[TvPage Error]", err);
    return <EmptyPlaylist status="READY" />;
  }
}

// ==========================================================
// BLOCOS
// ==========================================================

async function ContinueWatchingSection({
  playlistId,
  profileId,
}: {
  playlistId: string;
  profileId: string;
}) {
  try {
    const items = await getContinueWatchingList(playlistId, profileId, 12);
    if (!items || items.length === 0) return null;
    return <ContinueWatchingRail items={items} />;
  } catch {
    return null;
  }
}

async function HeroSection({ playlistId }: { playlistId: string }) {
  const [trending, releases] = await Promise.all([
    trendingRow(playlistId),
    releasesRow(playlistId),
  ]);

  const slides = buildHeroSlides({ trending, releases });
  if (slides.length > 0) return <ShowcaseHero slides={slides} />;

  const fallback = await heroFallback(playlistId);
  if (fallback.length === 0) return <div className="h-16" />;

  return <ShowcaseHero slides={fallback} />;
}

async function heroFallback(playlistId: string): Promise<HeroSlide[]> {
  const movies = await getChannelsByCategory(playlistId, "movies", 8);
  if (movies.length === 0) return [];

  const enriched = await enrichChannelsWithTmdb(movies, 5);

  return enriched.slice(0, 4).map((item) => ({
    id: item.id,
    name: item.name,
    href: `/tv/assistir/${item.id}`,
    backdropUrl: item.backdropUrl ?? null,
    posterUrl: item.posterUrl ?? item.logoUrl ?? null,
    overview: item.overview ?? "",
    rating: item.tmdbRating ?? 0,
    year: item.year ?? null,
    label: "Em destaque na sua lista",
    meta: item.quality ?? undefined,
    isFavorite: item.isFavorite,
    isSeries: false,
  }));
}

async function FavoritesRail({ playlistId }: { playlistId: string }) {
  const favorites = await getPlaylistChannels({
    playlistId,
    favoritesOnly: true,
    page: 1,
    pageSize: 18,
  });

  if (favorites.items.length === 0) return null;

  return (
    <Section title="Seus Favoritos" eyebrow="Favoritos" href="/tv/busca?favoritos=true">
      <Rail itemClassName="w-[164px] md:w-[188px]">
        {favorites.items.map((channel) => (
          <TileCard
            key={channel.id}
            channel={channel}
            live={channel.group?.category === "live"}
          />
        ))}
      </Rail>
    </Section>
  );
}

async function ReleasesRail({ playlistId }: { playlistId: string }) {
  const releases = await releasesRow(playlistId);

  if (releases.length > 0) {
    return (
      <Section
        title="Novidades que já estão na sua lista"
        eyebrow="Lançamentos"
        hint="Em cartaz nos cinemas e disponível agora"
        href="/tv/movies"
      >
        <PosterRail items={releases} badge="Novo" />
      </Section>
    );
  }

  const movies = await getChannelsByCategory(playlistId, "movies", 18);
  if (movies.length === 0) return null;
  const enriched = await enrichChannelsWithTmdb(movies, 12);

  return (
    <Section title="Filmes" eyebrow="Do seu acervo" href="/tv/movies">
      <Rail itemClassName="w-[112px] md:w-[140px]">
        {enriched.map((item) => (
          <PosterCard key={item.id} item={item} href={`/tv/assistir/${item.id}`} />
        ))}
      </Rail>
    </Section>
  );
}


async function TopMoviesRail({ playlistId }: { playlistId: string }) {
  const trending = await trendingRow(playlistId);
  const top = trending.filter((item) => !item.isSeries).slice(0, 10);
  if (top.length === 0) return null;

  return (
    <Section title="Top 10 filmes da semana" eyebrow="Em alta no Brasil" href="/tv/movies">
      <Rail>
        {top.map((item, index) => (
          <RankCard key={item.id} item={item} rank={index + 1} href={showcaseHref(item)} />
        ))}
      </Rail>
    </Section>
  );
}

async function SeriesRails({ playlistId }: { playlistId: string }) {
  const hotSeries = await cachedRow(`${playlistId}:hot-series`, async () =>
    matchTmdbInPlaylist(playlistId, await getTmdbPopular("tv"), {
      limit: 18,
      preferType: "tv",
    }),
  );

  if (hotSeries.length === 0) {
    const series = await getChannelsByCategory(playlistId, "series", 18);
    if (series.length === 0) return null;
    const enriched = await enrichChannelsWithTmdb(series, 12);

    return (
      <Section title="Séries" eyebrow="Do seu acervo" href="/tv/series">
        <Rail itemClassName="w-[112px] md:w-[140px]">
          {enriched.map((item) => (
            <PosterCard key={item.id} item={item} href={`/tv/assistir/${item.id}`} />
          ))}
        </Rail>
      </Section>
    );
  }

  return (
    <>
      <Section title="Séries do momento" eyebrow="Populares agora" href="/tv/series">
        <PosterRail items={hotSeries} />
      </Section>

      <Section title="Top 10 séries da semana" eyebrow="Mais assistidas" href="/tv/series">
        <Rail>
          {hotSeries.slice(0, 10).map((item, index) => (
            <RankCard key={item.id} item={item} rank={index + 1} href={showcaseHref(item)} />
          ))}
        </Rail>
      </Section>
    </>
  );
}


async function AiPicksRail({ playlistId }: { playlistId: string }) {
  const picks = await getAiPickedCurations(playlistId);
  if (picks.length === 0) return null;

  return (
    <Section
      title="Escolhidos para você"
      eyebrow="Seleção CineAI"
      hint="Curadoria automática a partir da sua lista"
    >
      <Rail itemClassName="w-[112px] md:w-[140px]">
        {picks.map((item) => (
          <PosterCard
            key={item.id}
            item={item}
            href={`/tv/assistir/${item.id}`}
            badge={item.aiBadge?.replace(/[^\p{L}\p{N}\s]/gu, "").trim().slice(0, 18)}
          />
        ))}
      </Rail>
    </Section>
  );
}

async function AcclaimedRail({ playlistId }: { playlistId: string }) {
  const acclaimed = await cachedRow(`${playlistId}:acclaimed`, async () =>
    matchTmdbInPlaylist(playlistId, await getTmdbTopRated("movie"), {
      limit: 18,
      preferType: "movie",
    }),
  );

  if (acclaimed.length === 0) return null;

  return (
    <Section title="Aclamados pela crítica" eyebrow="Nota alta" href="/tv/movies">
      <PosterRail items={acclaimed} />
    </Section>
  );
}

async function KidsRail({ playlistId }: { playlistId: string }) {
  const channels = await getChannelsByCategory(playlistId, "kids", 18);
  if (channels.length === 0) return null;

  return (
    <Section title="Para as crianças" eyebrow="Infantil" href="/tv/kids">
      <Rail itemClassName="w-[112px] md:w-[140px]">
        {channels.map((channel) => (
          <PosterCard key={channel.id} item={channel} href={`/tv/assistir/${channel.id}`} />
        ))}
      </Rail>
    </Section>
  );
}

// ==========================================================
// TRILHAS COMPARTILHADAS
// ==========================================================

function trendingRow(playlistId: string) {
  return cachedRow(`${playlistId}:trending`, async () =>
    matchTmdbInPlaylist(playlistId, await getTrendingTmdb("all"), { limit: 18 }),
  );
}

function releasesRow(playlistId: string) {
  return cachedRow(`${playlistId}:releases`, async () =>
    matchTmdbInPlaylist(playlistId, await getTmdbNowPlaying(), {
      limit: 18,
      preferType: "movie",
    }),
  );
}

// ==========================================================
// APRESENTAÇÃO
// ==========================================================

function Section({
  title,
  eyebrow,
  hint,
  href,
  children,
}: {
  title: string;
  eyebrow?: string;
  hint?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader
        title={title}
        eyebrow={eyebrow}
        hint={hint}
        href={href}
        className={`${GUTTER} mb-4`}
      />
      {children}
    </section>
  );
}

function PosterRail({ items, badge }: { items: ShowcaseItem[]; badge?: string }) {
  return (
    <Rail itemClassName="w-[112px] md:w-[140px]">
      {items.map((item) => (
        <PosterCard key={item.id} item={item} href={showcaseHref(item)} badge={badge} />
      ))}
    </Rail>
  );
}

function buildHeroSlides({
  trending,
  releases,
}: {
  trending: ShowcaseItem[];
  releases: ShowcaseItem[];
}): HeroSlide[] {
  const pool: Array<{ item: ShowcaseItem; label: string }> = [
    ...trending.slice(0, 4).map((item) => ({ item, label: "Em alta esta semana" })),
    ...releases.slice(0, 3).map((item) => ({ item, label: "Lançamento" })),
  ];

  const seen = new Set<string>();
  const slides: HeroSlide[] = [];

  for (const { item, label } of pool) {
    if (slides.length >= 5) break;
    if (!item.backdropUrl || seen.has(item.id)) continue;
    seen.add(item.id);

    slides.push({
      id: item.id,
      name: item.name,
      href: showcaseHref(item),
      backdropUrl: item.backdropUrl,
      posterUrl: item.posterUrl,
      overview: item.overview,
      rating: item.rating,
      year: item.year,
      label,
      meta: item.quality ?? undefined,
      isFavorite: item.isFavorite,
      isSeries: item.isSeries,
    });
  }

  return slides;
}

function capitalize(value: string | null | undefined) {
  if (!value) return null;
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
