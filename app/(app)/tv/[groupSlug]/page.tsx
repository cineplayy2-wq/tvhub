import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";

import { cleanGroupLabel, FilterChips } from "@/components/iptv/filter-chips";
import { PosterCard } from "@/components/iptv/poster-card";
import { GUTTER, SectionHeader } from "@/components/iptv/section";
import { TileCard } from "@/components/iptv/tile-card";
import { EmptyPlaylist } from "@/components/iptv/playlist-state";
import { requireUser } from "@/lib/auth/session";
import { CATEGORY_LABELS } from "@/lib/iptv/category-detector";
import {
  getGroupBySlug,
  getPlaylistChannels,
  getSeriesList,
  getViewablePlaylist,
} from "@/lib/queries/iptv";
import { enrichChannelsWithTmdb } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

/**
 * Página genérica de grupo/categoria.
 *
 * Cobre o que não tem página própria (notícias, música, religioso, e cada
 * grupo bruto da lista). Usa exatamente os mesmos cards e cabeçalho das
 * seções principais — nenhuma rota deve parecer de outro produto.
 */
export default async function GroupPage({
  params,
  searchParams,
}: {
  params: { groupSlug: string };
  searchParams: { q?: string; page?: string; sub?: string };
}) {
  const user = await requireUser();
  const playlist = await getViewablePlaylist(user.id);

  if (!playlist) notFound();
  if (!playlist.hasChannels) return <EmptyPlaylist status={playlist.syncStatus} />;

  const isCategory = Object.keys(CATEGORY_LABELS).includes(params.groupSlug);
  const page = Math.max(1, Number(searchParams.page) || 1);

  let title: string;
  let groupId: string | undefined;
  let groupCategory: string | undefined;

  if (isCategory) {
    title = CATEGORY_LABELS[params.groupSlug] ?? params.groupSlug;
    const selected = searchParams.sub
      ? playlist.groups.find((group) => group.slug === searchParams.sub)
      : undefined;
    groupId = selected?.id;
  } else {
    const group = await getGroupBySlug(playlist.id, params.groupSlug);
    if (!group) notFound();
    title = cleanGroupLabel(group.name);
    groupId = group.id;
    groupCategory = group.category ?? undefined;
  }

  const isSeriesView =
    (params.groupSlug === "series" || groupCategory === "series") && !searchParams.q;

  const subGroups = isCategory
    ? playlist.groups
        .filter((group) => group.category === params.groupSlug && group._count.channels > 0)
        .sort((a, b) => b._count.channels - a._count.channels)
    : [];

  let items: Array<Record<string, any>> = [];
  let total = 0;
  let totalPages = 1;

  if (isSeriesView) {
    const seriesList = await getSeriesList(playlist.id, groupId);
    items = await enrichChannelsWithTmdb(seriesList.slice(0, 42), 18);
    total = seriesList.length;
  } else {
    const result = await getPlaylistChannels({
      playlistId: playlist.id,
      category: isCategory && !groupId ? params.groupSlug : undefined,
      groupId,
      search: searchParams.q,
      page,
      pageSize: 42,
    });
    items = result.items;
    total = result.total;
    totalPages = result.totalPages;
  }

  const isVodCategory =
    params.groupSlug === "movies" || groupCategory === "movies" || isSeriesView;

  const chips = [
    {
      id: "all",
      label: `Todos em ${title}`,
      count: subGroups.reduce((sum, group) => sum + group._count.channels, 0),
      href: `/tv/${params.groupSlug}`,
      active: !searchParams.sub,
    },
    ...subGroups.map((group) => ({
      id: group.id,
      label: cleanGroupLabel(group.name),
      count: group._count.channels,
      href: `/tv/${params.groupSlug}?sub=${group.slug}`,
      active: searchParams.sub === group.slug,
    })),
  ];

  const href = (nextPage: number) => {
    const query = new URLSearchParams();
    if (searchParams.q) query.set("q", searchParams.q);
    if (searchParams.sub) query.set("sub", searchParams.sub);
    query.set("page", String(nextPage));
    return `/tv/${params.groupSlug}?${query.toString()}`;
  };

  return (
    <div className={`${GUTTER} min-h-screen pb-24 pt-24`}>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {total.toLocaleString("pt-BR")} {total === 1 ? "item" : "itens"}
          </p>
        </div>

        <form action={`/tv/${params.groupSlug}`} method="get" className="w-full md:w-80">
          {searchParams.sub && <input type="hidden" name="sub" value={searchParams.sub} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              type="text"
              defaultValue={searchParams.q}
              placeholder={`Buscar em ${title}…`}
              className="w-full rounded-xl border border-white/[0.08] bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </form>
      </div>

      <FilterChips chips={chips} className="mt-8" />

      <div className="mt-10">
        {searchParams.q && (
          <SectionHeader
            title={`Resultados para “${searchParams.q}”`}
            hint={`${total.toLocaleString("pt-BR")} itens`}
            className="mb-5"
          />
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-surface/40 px-6 py-20 text-center">
            <p className="text-sm font-semibold text-foreground">Nada por aqui</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchParams.q
                ? `Nenhum resultado para “${searchParams.q}”.`
                : "Nenhum conteúdo nesta seleção."}
            </p>
          </div>
        ) : isVodCategory ? (
          <div className="defer-paint grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {items.map((item) => (
              <PosterCard
                key={item.id}
                item={item as any}
                href={
                  isSeriesView
                    ? `/tv/serie/${encodeURIComponent(item.name)}`
                    : `/tv/assistir/${item.id}`
                }
              />
            ))}
          </div>
        ) : (
          <div className="defer-paint grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((item) => (
              <TileCard key={item.id} channel={item as any} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
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
        )}
      </div>
    </div>
  );
}
