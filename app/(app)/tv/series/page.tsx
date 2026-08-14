import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, Tv } from "lucide-react";

import { ArtworkBackfill } from "@/components/iptv/artwork-backfill";
import { DismissableRecommendationsRail } from "@/components/iptv/dismissable-recommendations-rail";
import { cleanGroupLabel, FilterChips } from "@/components/iptv/filter-chips";
import { FilterBar } from "@/components/iptv/filter-bar";
import { PosterCard } from "@/components/iptv/poster-card";
import { Rail } from "@/components/iptv/rail";
import { GUTTER, SectionHeader } from "@/components/iptv/section";
import { ShowcaseHero, type HeroSlide } from "@/components/iptv/showcase-hero";
import { EmptyPlaylist } from "@/components/iptv/playlist-state";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { ContinueWatchingRail } from "@/components/iptv/continue-watching-rail";
import { getContinueWatchingList } from "@/lib/iptv/watch-progress-service";
import { getDismissedKeys, semDispensados } from "@/lib/queries/dismissed";
import {
  FILTER_GROUPS,
  findFilterOption,
  getFilterCounts,
} from "@/lib/queries/filters";
import {
  cachedRow,
  matchTmdbInPlaylist,
  showcaseHref,
  type ShowcaseItem,
} from "@/lib/queries/discover";
import { getNovelasList, getSeriesList, getViewablePlaylist } from "@/lib/queries/iptv";
import {
  enrichChannelsWithTmdb,
  getTmdbAiringToday,
  getTmdbPopular,
  getTmdbTopRated,
  getTrendingTmdb,
} from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 42;

export default async function SeriesHubPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; sub?: string; f?: string };
}) {
  const user = await requireUser();
  const [playlist, activeProfile] = await Promise.all([
    getViewablePlaylist(user.id),
    getActiveProfile(user.id).catch(() => null),
  ]);
  const dismissed = await getDismissedKeys(activeProfile?.id);

  if (!playlist) notFound();
  if (!playlist.hasChannels) return <EmptyPlaylist status={playlist.syncStatus} />;
  if (playlist.lockedCategories.includes("series")) notFound();

  const playlistId = playlist.id;
  const profileId = activeProfile?.id ?? null;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const activeFilters = (searchParams.f ?? "").split(",").filter(Boolean);
  const isBrowsing =
    !searchParams.q && !searchParams.sub && activeFilters.length === 0 && page === 1;

  const filterCounts = await getFilterCounts(playlistId, "series");

  const subGroups = playlist.groups
    .filter((group) => group.category === "series" && group._count.channels > 0)
    .sort((a, b) => b._count.channels - a._count.channels);

  const selectedSubGroup = subGroups.find((group) => group.slug === searchParams.sub);

  const [allSeries, novelas, airing, popular, trending, acclaimed, continueWatching] = await Promise.all([
    getSeriesList(playlistId, selectedSubGroup?.id),
    isBrowsing ? getNovelasList(playlistId, 18) : [],
    isBrowsing
      ? cachedRow(`${playlistId}:s-airing`, async () =>
          matchTmdbInPlaylist(playlistId, await getTmdbAiringToday(), {
            limit: 18,
            preferType: "tv",
          }),
        )
      : ([] as ShowcaseItem[]),
    isBrowsing
      ? cachedRow(`${playlistId}:s-popular`, async () =>
          matchTmdbInPlaylist(playlistId, await getTmdbPopular("tv"), {
            limit: 18,
            preferType: "tv",
          }),
        )
      : ([] as ShowcaseItem[]),
    isBrowsing
      ? cachedRow(`${playlistId}:s-trending`, async () =>
          matchTmdbInPlaylist(playlistId, await getTrendingTmdb("tv"), {
            limit: 18,
            preferType: "tv",
          }),
        )
      : ([] as ShowcaseItem[]),
    isBrowsing
      ? cachedRow(`${playlistId}:s-acclaimed`, async () =>
          matchTmdbInPlaylist(playlistId, await getTmdbTopRated("tv"), {
            limit: 18,
            preferType: "tv",
          }),
        )
      : ([] as ShowcaseItem[]),
    profileId && isBrowsing
      ? getContinueWatchingList(playlistId, profileId, 12, "series")
      : Promise.resolve([]),
  ]);

  // O catálogo de séries é agrupado por título, então o filtro é aplicado
  // sobre o nome do grupo de cada série já agrupada.
  const filterTerms = activeFilters
    .map((id) => findFilterOption(id)?.terms ?? [])
    .filter((terms) => terms.length > 0);

  const query = searchParams.q?.toLowerCase().trim();
  let filtered = query
    ? allSeries.filter((series) => series.name.toLowerCase().includes(query))
    : allSeries;

  // Grupos diferentes restringem (AND); opções do mesmo grupo somam (OR)
  for (const terms of filterTerms) {
    filtered = filtered.filter((series) => {
      const groupName = (series.group?.name ?? "").toLowerCase();
      return terms.some((term) => groupName.includes(term));
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const grid = await enrichChannelsWithTmdb(pageItems, 18);

  const slides = heroFrom([
    ...trending.slice(0, 3).map((item) => ({ item, label: "Em alta esta semana" })),
    ...airing.slice(0, 3).map((item) => ({ item, label: "Novo episódio hoje" })),
  ]);

  const chips = [
    {
      id: "all",
      label: "Todas as séries",
      count: allSeries.length,
      href: "/tv/series",
      active: !searchParams.sub,
    },
    ...subGroups.map((group) => ({
      id: group.id,
      label: cleanGroupLabel(group.name),
      count: group._count.channels,
      href: `/tv/series?sub=${group.slug}`,
      active: searchParams.sub === group.slug,
    })),
  ];

  return (
    <div className="min-h-screen pb-24 pt-16">
      <ArtworkBackfill />
      <div className={`${GUTTER} py-8`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Tv className="h-3.5 w-3.5" />
              Maratona
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Séries, animes e doramas
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {filtered.length.toLocaleString("pt-BR")} títulos organizados por temporada
            </p>
          </div>

          <form action="/tv/series" method="get" className="w-full md:w-80">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                type="text"
                defaultValue={searchParams.q}
                placeholder="Buscar série…"
                className="w-full rounded-xl border border-white/[0.08] bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </form>
        </div>

        {slides.length > 0 && (
          <div className="mt-6 overflow-hidden md:rounded-2xl">
            <ShowcaseHero slides={slides} size="compact" />
          </div>
        )}

        <FilterChips chips={chips} className="mt-8" />

        {/* Filtros do protótipo, com contagem real do acervo */}
        <div className="-mx-5 mt-2">
          <FilterBar groups={FILTER_GROUPS} counts={filterCounts} />
        </div>
      </div>

      {/* CONTINUAR ASSISTINDO SÉRIES (VOD SOMENTE SÉRIES) */}
      {continueWatching.length > 0 && (
        <ContinueWatchingRail
          items={continueWatching}
          title="Continuar Assistindo Séries"
          subtitle="Continue seus episódios de onde parou"
        />
      )}

      {isBrowsing && (
        <div className="space-y-12 pb-4">
          <Row title="Novos episódios hoje" eyebrow="No ar agora" items={airing} dismissed={dismissed} />
          <Row title="Séries do momento" eyebrow="Populares" items={popular} dismissed={dismissed} />
          {novelas.length > 0 && (
            <section>
              <SectionHeader
                title="Novelas e doramas"
                eyebrow="Capítulo a capítulo"
                className={`${GUTTER} mb-4`}
              />
              <Rail itemClassName="w-[112px] md:w-[140px]">
                {novelas.map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    href={`/tv/serie/${encodeURIComponent(item.name)}`}
                  />
                ))}
              </Rail>
            </section>
          )}
          <Row title="Aclamadas pela crítica" eyebrow="Nota alta" items={acclaimed} dismissed={dismissed} />
        </div>
      )}

      <div className={`${GUTTER} mt-12`}>
        <SectionHeader
          title={
            searchParams.q
              ? `Resultados para “${searchParams.q}”`
              : selectedSubGroup
                ? cleanGroupLabel(selectedSubGroup.name)
                : "Todo o acervo"
          }
          hint={`${filtered.length.toLocaleString("pt-BR")} séries`}
          className="mb-5"
        />

        {grid.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-surface/40 px-6 py-20 text-center">
            <p className="text-sm font-semibold text-foreground">Nenhuma série encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchParams.q
                ? `Nada corresponde a “${searchParams.q}”.`
                : "Nenhuma série disponível na sua lista."}
            </p>
          </div>
        ) : (
          <div className="defer-paint grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {grid.map((series) => (
              <PosterCard
                key={series.id}
                item={series}
                href={`/tv/serie/${encodeURIComponent(series.name)}`}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            query={searchParams.q}
            sub={searchParams.sub}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Trilha de vitrine com "não me mostre mais isto".
 *
 * Recebe o conjunto de dispensadas já resolvido pela página: filtrar por
 * trilha custaria uma consulta por seção para ler a mesma listinha.
 *
 * Dispensar mexe só nas sugestões. O título continua na grade paginada logo
 * abaixo, na busca e no gênero — é a mesma página, dá para conferir na hora.
 */
function Row({
  title,
  eyebrow,
  items,
  dismissed,
}: {
  title: string;
  eyebrow: string;
  items: ShowcaseItem[];
  dismissed: Set<string>;
}) {
  const visiveis = semDispensados(items, dismissed);
  if (visiveis.length === 0) return null;

  return <DismissableRecommendationsRail title={title} eyebrow={eyebrow} items={visiveis} />;
}

function Pagination({
  page,
  totalPages,
  query,
  sub,
}: {
  page: number;
  totalPages: number;
  query?: string;
  sub?: string;
}) {
  const href = (nextPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sub) params.set("sub", sub);
    params.set("page", String(nextPage));
    return `/tv/series?${params.toString()}`;
  };

  return (
    <div className="mt-12 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link
          href={href(page - 1)}
          className="rounded-xl border border-white/[0.08] bg-surface px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Anterior
        </Link>
      )}
      <span className="px-3 text-sm tabular-nums text-muted-foreground">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={href(page + 1)}
          className="rounded-xl border border-white/[0.08] bg-surface px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Próxima
        </Link>
      )}
    </div>
  );
}

function heroFrom(pool: Array<{ item: ShowcaseItem; label: string }>): HeroSlide[] {
  const seen = new Set<string>();
  const slides: HeroSlide[] = [];

  for (const { item, label } of pool) {
    if (slides.length >= 4) break;
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
      isSeries: true,
    });
  }

  return slides;
}
