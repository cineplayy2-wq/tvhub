import Link from "next/link";
import { notFound } from "next/navigation";
import { Film, Search } from "lucide-react";

import { cleanGroupLabel, FilterChips } from "@/components/iptv/filter-chips";
import { FilterBar } from "@/components/iptv/filter-bar";
import { PosterCard } from "@/components/iptv/poster-card";
import { Rail } from "@/components/iptv/rail";
import { GUTTER, SectionHeader } from "@/components/iptv/section";
import { ShowcaseHero, type HeroSlide } from "@/components/iptv/showcase-hero";
import { EmptyPlaylist } from "@/components/iptv/playlist-state";
import { requireUser } from "@/lib/auth/session";
import { FILTER_GROUPS, filterWhere, getFilterCounts } from "@/lib/queries/filters";
import {
  cachedRow,
  matchTmdbInPlaylist,
  showcaseHref,
  type ShowcaseItem,
} from "@/lib/queries/discover";
import { getPlaylistChannels, getViewablePlaylist } from "@/lib/queries/iptv";
import {
  getTmdbNowPlaying,
  getTmdbPopular,
  getTmdbTopRated,
  getTrendingTmdb,
  enrichChannelsWithTmdb,
} from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

export default async function MoviesHubPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; sub?: string; f?: string };
}) {
  const user = await requireUser();
  const playlist = await getViewablePlaylist(user.id);

  if (!playlist) notFound();
  if (!playlist.hasChannels) return <EmptyPlaylist status={playlist.syncStatus} />;

  const playlistId = playlist.id;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const activeFilters = (searchParams.f ?? "").split(",").filter(Boolean);
  const isBrowsing =
    !searchParams.q && !searchParams.sub && activeFilters.length === 0 && page === 1;

  const filterCounts = await getFilterCounts(playlistId, "movies");

  const subGroups = playlist.groups
    .filter((group) => group.category === "movies" && group._count.channels > 0)
    .sort((a, b) => b._count.channels - a._count.channels);

  const selectedSubGroup = subGroups.find((group) => group.slug === searchParams.sub);

  const [result, releases, trending, acclaimed, popular] = await Promise.all([
    getPlaylistChannels({
      playlistId,
      category: "movies",
      groupId: selectedSubGroup?.id,
      search: searchParams.q,
      page,
      pageSize: 42,
    }),
    isBrowsing
      ? cachedRow(`${playlistId}:m-releases`, async () =>
          matchTmdbInPlaylist(playlistId, await getTmdbNowPlaying(), {
            limit: 18,
            preferType: "movie",
          }),
        )
      : ([] as ShowcaseItem[]),
    isBrowsing
      ? cachedRow(`${playlistId}:m-trending`, async () =>
          matchTmdbInPlaylist(playlistId, await getTrendingTmdb("movie"), {
            limit: 18,
            preferType: "movie",
          }),
        )
      : ([] as ShowcaseItem[]),
    isBrowsing
      ? cachedRow(`${playlistId}:m-acclaimed`, async () =>
          matchTmdbInPlaylist(playlistId, await getTmdbTopRated("movie"), {
            limit: 18,
            preferType: "movie",
          }),
        )
      : ([] as ShowcaseItem[]),
    isBrowsing
      ? cachedRow(`${playlistId}:m-popular`, async () =>
          matchTmdbInPlaylist(playlistId, await getTmdbPopular("movie"), {
            limit: 18,
            preferType: "movie",
          }),
        )
      : ([] as ShowcaseItem[]),
  ]);

  // A grade paginada ainda passa pelo TMDB para ganhar pôster e nota; só as
  // primeiras posições, que é o que aparece antes do primeiro scroll.
  const grid = await enrichChannelsWithTmdb(result.items, 18);

  const slides = heroFrom([
    ...releases.slice(0, 3).map((item) => ({ item, label: "Nos cinemas agora" })),
    ...trending.slice(0, 3).map((item) => ({ item, label: "Em alta" })),
  ]);

  const chips = [
    {
      id: "all",
      label: "Todos os filmes",
      count: playlist.groups
        .filter((group) => group.category === "movies")
        .reduce((total, group) => total + group._count.channels, 0),
      href: "/tv/movies",
      active: !searchParams.sub,
    },
    ...subGroups.map((group) => ({
      id: group.id,
      label: cleanGroupLabel(group.name),
      count: group._count.channels,
      href: `/tv/movies?sub=${group.slug}`,
      active: searchParams.sub === group.slug,
    })),
  ];

  return (
    <div className="min-h-screen pb-24 pt-16">
      <div className={`${GUTTER} py-8`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Film className="h-3.5 w-3.5" />
              Cinema
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Filmes
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {result.total.toLocaleString("pt-BR")} títulos
              {selectedSubGroup ? ` em ${cleanGroupLabel(selectedSubGroup.name)}` : ""}
            </p>
          </div>

          <form action="/tv/movies" method="get" className="w-full md:w-80">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                type="text"
                defaultValue={searchParams.q}
                placeholder="Buscar filme…"
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

      {isBrowsing && (
        <div className="space-y-12 pb-4">
          <Row title="Lançamentos" eyebrow="Novidades na sua lista" items={releases} badge="Novo" />
          <Row title="Em alta esta semana" eyebrow="Mais buscados" items={trending} />
          <Row title="Aclamados pela crítica" eyebrow="Nota alta" items={acclaimed} />
          <Row title="Populares agora" eyebrow="O que todo mundo assiste" items={popular} />
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
          hint={`${result.total.toLocaleString("pt-BR")} filmes`}
          className="mb-5"
        />

        {grid.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-surface/40 px-6 py-20 text-center">
            <p className="text-sm font-semibold text-foreground">Nenhum filme encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchParams.q
                ? `Nada corresponde a “${searchParams.q}”.`
                : "Tente outra categoria."}
            </p>
          </div>
        ) : (
          <div className="defer-paint grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {grid.map((movie) => (
              <PosterCard
                key={movie.id}
                item={movie}
                href={`/tv/assistir/${movie.id}`}
              />
            ))}
          </div>
        )}

        {result.totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={result.totalPages}
            query={searchParams.q}
            sub={searchParams.sub}
          />
        )}
      </div>
    </div>
  );
}

function Row({
  title,
  eyebrow,
  items,
  badge,
}: {
  title: string;
  eyebrow: string;
  items: ShowcaseItem[];
  badge?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <SectionHeader title={title} eyebrow={eyebrow} className={`${GUTTER} mb-4`} />
      <Rail itemClassName="w-[112px] md:w-[140px]">
        {items.map((item) => (
          <PosterCard key={item.id} item={item} href={showcaseHref(item)} badge={badge} />
        ))}
      </Rail>
    </section>
  );
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
    return `/tv/movies?${params.toString()}`;
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
      meta: item.quality ?? undefined,
      isFavorite: item.isFavorite,
      isSeries: item.isSeries,
    });
  }

  return slides;
}
