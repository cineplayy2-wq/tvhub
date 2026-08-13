import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ArtworkBackfill } from "@/components/iptv/artwork-backfill";
import { DismissableRecommendationsRail } from "@/components/iptv/dismissable-recommendations-rail";
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
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { FILTER_GROUPS, getFilterCounts } from "@/lib/queries/filters";
import { getContinueWatchingList } from "@/lib/iptv/watch-progress-service";
import { isSeriesItem } from "@/lib/iptv/media-kind";
import { getDismissedKeys, semDispensados } from "@/lib/queries/dismissed";
import {
  cachedRow,
  getPersonalizedRecommendations,
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
  getTmdbFamilyAnimation,
  getTmdbNowPlaying,
  getTmdbTopRated,
  getTrendingTmdb,
} from "@/lib/tmdb/client";
import { dedupeChannels } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TvPage() {
  try {
    const user = await requireUser();
    const playlist = await getViewablePlaylist(user.id);
    const activeProfile = await getActiveProfile(user.id).catch(() => null);

    if (activeProfile?.isKids) {
      redirect("/tv/kids");
    }

    if (!playlist) return <EmptyPlaylist />;
    if (!playlist.hasChannels) return <EmptyPlaylist status={playlist.syncStatus} />;

    const playlistId = playlist.id;
    const [filterCounts, dismissed] = await Promise.all([
      getFilterCounts(playlistId, "movies"),
      getDismissedKeys(activeProfile?.id),
    ]);

    return (
      <div className="pb-32">
        <SyncBanner isSyncing={playlist.isSyncing} isStale={playlist.isSyncStale} />
        <ArtworkBackfill />

        {/* Filtros logo abaixo do cabeçalho */}
        <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+58px)] z-40 md:hidden">
          <FilterBar groups={FILTER_GROUPS} counts={filterCounts} />
        </div>

        <div className="sticky top-0 z-40 hidden bg-background/90 py-3 supports-[backdrop-filter]:bg-background/70 supports-[backdrop-filter]:backdrop-blur-xl md:block">
          <FilterBar groups={FILTER_GROUPS} counts={filterCounts} />
        </div>

        <Suspense fallback={<HeroSkeleton />}>
          <HeroSection playlistId={playlistId} />
        </Suspense>

        {/* CONTINUAR ASSISTINDO (EXCLUSIVAMENTE FILMES E SÉRIES VOD) */}
        {activeProfile && (
          <Suspense fallback={null}>
            <ContinueWatchingSection playlistId={playlistId} profileId={activeProfile.id} />
          </Suspense>
        )}

        <div className="space-y-12 md:space-y-14">
          <Suspense fallback={null}>
            <FavoritesRail playlistId={playlistId} />
          </Suspense>

          {/* 1. TOP 10 FILMES DA SEMANA */}
          <Suspense fallback={<RailSkeleton />}>
            <TopMoviesRail playlistId={playlistId} />
          </Suspense>

          {/* 2. RECOMENDADOS PARA VOCÊ (FILMES) COM BOTÃO DISPENSAR (X) */}
          {activeProfile && (
            <Suspense fallback={null}>
              <RecommendedMoviesRail playlistId={playlistId} profileId={activeProfile.id} dismissed={dismissed} />
            </Suspense>
          )}

          {/* 3. TOP 10 SÉRIES DA SEMANA */}
          <Suspense fallback={<RailSkeleton />}>
            <TopSeriesRail playlistId={playlistId} />
          </Suspense>

          {/* 4. RECOMENDADAS PARA VOCÊ (SÉRIES) COM BOTÃO DISPENSAR (X) */}
          {activeProfile && (
            <Suspense fallback={null}>
              <RecommendedSeriesRail playlistId={playlistId} profileId={activeProfile.id} dismissed={dismissed} />
            </Suspense>
          )}

          {/* A trilha "Escolhidos para você / Seleção Cine" saiu daqui.
              Ela era montada a partir dos canais de maior relevanceScore da
              lista, e relevância alta é justamente o que canal ao vivo tem:
              nome curto e marca de qualidade. O resultado era uma faixa de
              canais no meio da aba de filmes e séries. */}

          {/* 5. NOTA ALTA EM FILMES */}
          <Suspense fallback={<RailSkeleton />}>
            <AcclaimedMoviesRail playlistId={playlistId} dismissed={dismissed} />
          </Suspense>

          {/* 6. NOTA ALTA EM SÉRIES */}
          <Suspense fallback={<RailSkeleton />}>
            <AcclaimedSeriesRail playlistId={playlistId} dismissed={dismissed} />
          </Suspense>

          {/* 7. FILMES EM FAMÍLIA */}
          <Suspense fallback={null}>
            <FamilyRail playlistId={playlistId} dismissed={dismissed} />
          </Suspense>

          {/* 8. GÊNEROS DINÂMICOS & LANÇAMENTOS DO ACERVO */}
          <Suspense fallback={<RailSkeleton />}>
            <GenreRail dismissed={dismissed} playlistId={playlistId} genre="acao" title="Ação e Aventura" />
          </Suspense>

          <Suspense fallback={<RailSkeleton />}>
            <GenreRail dismissed={dismissed} playlistId={playlistId} genre="comedia" title="Comédias para Rir" />
          </Suspense>

          <Suspense fallback={<RailSkeleton />}>
            <GenreRail dismissed={dismissed} playlistId={playlistId} genre="terror" title="Terror e Sobrenatural" />
          </Suspense>

          <Suspense fallback={<RailSkeleton />}>
            <GenreRail dismissed={dismissed} playlistId={playlistId} genre="suspense" title="Suspense e Mistério" />
          </Suspense>

          <Suspense fallback={<RailSkeleton />}>
            <ReleasesRail playlistId={playlistId} dismissed={dismissed} />
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
// COMPONENTES DE SEÇÃO
// ==========================================================

/**
 * O que toda trilha de sugestão precisa saber.
 *
 * `dismissed` é resolvido UMA vez na página e desce pronto. Se cada trilha
 * consultasse por conta própria, seriam dez idas ao banco por renderização
 * para ler a mesma listinha.
 */
type RailProps = { playlistId: string; dismissed: Set<string> };

async function ContinueWatchingSection({
  playlistId,
  profileId,
}: {
  playlistId: string;
  profileId: string;
}) {
  try {
    const items = await getContinueWatchingList(playlistId, profileId, 12, "vod");
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

async function RecommendedMoviesRail({
  playlistId,
  profileId,
  dismissed,
}: RailProps & { profileId: string }) {
  const recs = semDispensados(
    await getPersonalizedRecommendations(playlistId, profileId, "movie", 20),
    dismissed,
  );
  if (recs.length === 0) return null;

  return (
    <DismissableRecommendationsRail
      title="Recomendados para você"
      eyebrow="Principais para você · Filmes"
      hint="Sugestões baseadas no que você assiste"
      items={recs}
    />
  );
}

async function TopSeriesRail({ playlistId }: { playlistId: string }) {
  const topSeries = await cachedRow(`${playlistId}:top-series`, async () =>
    matchTmdbInPlaylist(playlistId, await getTrendingTmdb("tv"), {
      limit: 10,
      preferType: "tv",
    }),
  );

  if (topSeries.length === 0) {
    const series = await getChannelsByCategory(playlistId, "series", 10);
    if (series.length === 0) return null;
    const enriched = await enrichChannelsWithTmdb(series, 10);

    return (
      <Section title="Top 10 séries da semana" eyebrow="Mais assistidas" href="/tv/series">
        <Rail>
          {enriched.slice(0, 10).map((item, index) => (
            <RankCard key={item.id} item={item} rank={index + 1} href={`/tv/assistir/${item.id}`} />
          ))}
        </Rail>
      </Section>
    );
  }

  return (
    <Section title="Top 10 séries da semana" eyebrow="Mais assistidas" href="/tv/series">
      <Rail>
        {topSeries.map((item, index) => (
          <RankCard key={item.id} item={item} rank={index + 1} href={showcaseHref(item)} />
        ))}
      </Rail>
    </Section>
  );
}

async function RecommendedSeriesRail({
  playlistId,
  profileId,
  dismissed,
}: RailProps & { profileId: string }) {
  const recs = semDispensados(
    await getPersonalizedRecommendations(playlistId, profileId, "tv", 20),
    dismissed,
  );
  if (recs.length === 0) return null;

  return (
    <DismissableRecommendationsRail
      title="Séries recomendadas para você"
      eyebrow="Principais para você · Séries"
      hint="Baseado nas suas séries favoritas"
      items={recs}
    />
  );
}

async function AcclaimedMoviesRail({ playlistId, dismissed }: RailProps) {
  const acclaimed = await cachedRow(`${playlistId}:acclaimed-movies`, async () =>
    matchTmdbInPlaylist(playlistId, await getTmdbTopRated("movie"), {
      limit: 18,
      preferType: "movie",
    }),
  );

  const itens = semDispensados(acclaimed, dismissed);
  if (itens.length === 0) return null;

  return (
    <DismissableRecommendationsRail
      title="Nota alta em filmes"
      eyebrow="Aclamados pela crítica"
      href="/tv/movies"
      items={itens}
    />
  );
}

async function AcclaimedSeriesRail({ playlistId, dismissed }: RailProps) {
  const acclaimed = await cachedRow(`${playlistId}:acclaimed-series`, async () =>
    matchTmdbInPlaylist(playlistId, await getTmdbTopRated("tv"), {
      limit: 18,
      preferType: "tv",
    }),
  );

  const itens = semDispensados(acclaimed, dismissed);
  if (itens.length === 0) return null;

  return (
    <DismissableRecommendationsRail
      title="Nota alta em séries"
      eyebrow="Sucessos da crítica"
      href="/tv/series"
      items={itens}
    />
  );
}

async function FamilyRail({ playlistId, dismissed }: RailProps) {
  const family = await cachedRow(`${playlistId}:family-movies`, async () =>
    matchTmdbInPlaylist(playlistId, await getTmdbFamilyAnimation(), {
      limit: 18,
      preferType: "movie",
    }),
  );

  const itens = semDispensados(family, dismissed);
  if (itens.length === 0) return null;

  return (
    <DismissableRecommendationsRail
      title="Para curtir em família"
      eyebrow="Família"
      href="/tv/movies"
      items={itens}
    />
  );
}

async function GenreRail({
  playlistId,
  genre,
  title,
  dismissed,
}: RailProps & { genre: string; title: string }) {
  const items = await cachedRow(`${playlistId}:genre:${genre}`, async () => {
    const channels = await prisma.m3uChannel.findMany({
      where: {
        playlistId,
        isActive: true,
        group: {
          isHidden: false,
          category: { in: ["movies", "series"] },
          name: { contains: genre, mode: "insensitive" },
        },
      },
      take: 24,
      orderBy: { relevanceScore: "desc" },
      select: {
        id: true,
        name: true,
        streamUrl: true,
        logoUrl: true,
        quality: true,
        isFavorite: true,
        relevanceScore: true,
        tmdbPosterUrl: true,
        tmdbBackdropUrl: true,
        tmdbRating: true,
        tmdbYear: true,
        tmdbOverview: true,
        tmdbSyncedAt: true,
        group: { select: { name: true, slug: true, category: true } },
      },
    });

    const deduped = dedupeChannels(channels).slice(0, 16);

    // Esta trilha era a única que montava o item à mão, com
    // `posterUrl: c.logoUrl`. VOD de M3U quase nunca traz tvg-logo, então o
    // gênero inteiro saía sem capa — comédia era o caso mais visível. Passar
    // pelo enriquecimento resolve a arte e, agora que ela fica gravada no
    // canal, a trilha só paga rede na primeira montagem do cache.
    const enriched = await enrichChannelsWithTmdb(deduped, 16);

    return enriched.map((c) => ({
      ...c,
      tmdbId: 0,
      posterUrl: c.posterUrl ?? c.logoUrl,
      backdropUrl: c.backdropUrl ?? null,
      overview: c.overview ?? "",
      rating: c.tmdbRating ?? 0,
      year: c.year ?? null,
      mediaType: (c.group?.category === "series" ? "tv" : "movie") as "tv" | "movie",
      isSeries: isSeriesItem({
        streamUrl: c.streamUrl,
        name: c.name,
        category: c.group?.category,
      }),
    }));
  });

  const visiveis = semDispensados(items, dismissed);
  if (visiveis.length === 0) return null;

  return (
    <DismissableRecommendationsRail
      title={title}
      eyebrow="Gênero"
      href="/tv/movies"
      items={visiveis}
    />
  );
}

async function ReleasesRail({ playlistId, dismissed }: RailProps) {
  const releases = await releasesRow(playlistId);

  const itens = semDispensados(releases, dismissed);
  if (itens.length === 0) return null;

  return (
    <DismissableRecommendationsRail
      title="Lançamentos do acervo"
      eyebrow="Lançamentos"
      hint="Títulos recém-adicionados"
      href="/tv/movies"
      items={itens}
    />
  );
}

// ==========================================================
// TRILHAS COMPARTILHADAS & HELPERS
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
      isFavorite: item.isFavorite,
      isSeries: item.isSeries,
    });
  }

  return slides;
}
