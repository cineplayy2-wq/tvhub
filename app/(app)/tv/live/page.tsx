import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Radio, Search } from "lucide-react";

import { CategoryTiles } from "@/components/iptv/category-tiles";
import { Rail } from "@/components/iptv/rail";
import { GUTTER, SectionHeader } from "@/components/iptv/section";
import { TileCard } from "@/components/iptv/tile-card";
import { EmptyPlaylist } from "@/components/iptv/playlist-state";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { detectRegion, regionSearchTerms, STATE_NAMES } from "@/lib/geo";
import { CATEGORY_LABELS } from "@/lib/iptv/category-detector";
import {
  getLiveCategoryOverview,
  getLiveChannelsByCategory,
  getPlaylistChannels,
  getRegionalChannels,
  getStateChannels,
  getViewablePlaylist,
} from "@/lib/queries/iptv";

export const dynamic = "force-dynamic";

/** Trilhas fixas da página, na ordem em que fazem sentido para o assinante. */
const RAILS: Array<{ category: string; title: string; eyebrow: string }> = [
  { category: "sports", title: "Esportes", eyebrow: "Jogos e canais esportivos" },
  { category: "news", title: "Notícias", eyebrow: "Jornalismo 24 horas" },
  { category: "kids", title: "Infantil", eyebrow: "Desenhos ao vivo" },
  { category: "documentaries", title: "Documentários", eyebrow: "Ciência e natureza" },
  { category: "movies", title: "Canais de cinema", eyebrow: "Filmes na grade" },
  { category: "music", title: "Música", eyebrow: "Clipes e shows" },
  { category: "entertainment", title: "Variedades", eyebrow: "Entretenimento" },
];

export default async function LiveChannelsPage({
  searchParams,
}: {
  searchParams: { cat?: string; q?: string; page?: string };
}) {
  const user = await requireUser();
  const [playlist, profile] = await Promise.all([
    getViewablePlaylist(user.id),
    getActiveProfile(user.id),
  ]);

  if (!playlist) notFound();
  if (!playlist.hasChannels) return <EmptyPlaylist status={playlist.syncStatus} />;
  if (playlist.lockedCategories.includes("live")) notFound();

  const playlistId = playlist.id;
  const profileId = profile?.id ?? null;
  const region = await detectRegion();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const isFiltered = Boolean(searchParams.cat || searchParams.q);

  const [overview, stateChannels, openChannels] = await Promise.all([
    getLiveCategoryOverview(playlistId),
    region ? getStateChannels(playlistId, regionSearchTerms(region), 18) : [],
    getRegionalChannels(playlistId, 18),
  ]);

  // Modo filtrado carrega uma grade paginada; modo vitrine carrega as trilhas.
  const filtered = isFiltered
    ? await getPlaylistChannels({
        playlistId,
        category: searchParams.cat,
        search: searchParams.q,
        page,
        pageSize: 42,
        lockedCategories: playlist.lockedCategories,
        profileId,
      })
    : null;

  const rails = isFiltered
    ? []
    : (
        await Promise.all(
          RAILS.filter((rail) => overview.some((entry) => entry.category === rail.category)).map(
            async (rail) => ({
              ...rail,
              channels: await getLiveChannelsByCategory(playlistId, rail.category, 16),
            }),
          ),
        )
      ).filter((rail) => rail.channels.length > 0);

  const stateName = region ? STATE_NAMES[region.state.toUpperCase()]?.[0] : null;

  return (
    <div className="min-h-screen pb-24 pt-16">
      {/* Cabeçalho da seção */}
      <div className={`${GUTTER} border-b border-white/[0.06] py-8`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Radio className="h-3.5 w-3.5" />
              Ao vivo
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Canais
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {playlist._count.channels.toLocaleString("pt-BR")} canais na sua lista
              {region ? ` · sinal de ${region.city ?? region.state}` : ""}
            </p>
          </div>

          <form action="/tv/live" method="get" className="w-full md:w-80">
            {searchParams.cat && <input type="hidden" name="cat" value={searchParams.cat} />}
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                type="text"
                defaultValue={searchParams.q}
                placeholder="Buscar canal…"
                className="w-full rounded-xl border border-white/[0.08] bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Navegação visual de categorias */}
      <div className="pt-8">
        <SectionHeader
          title="Explorar por categoria"
          eyebrow="Categorias"
          className={`${GUTTER} mb-4`}
        />
        <CategoryTiles items={overview} active={searchParams.cat ?? null} />
      </div>

      {filtered ? (
        <FilteredGrid
          filtered={filtered}
          page={page}
          category={searchParams.cat}
          query={searchParams.q}
        />
      ) : (
        <div className="mt-12 space-y-12">
          {stateChannels.length > 0 && region && (
            <section>
              <SectionHeader
                title={`Destaques de ${capitalize(stateName) ?? region.state}`}
                eyebrow="Na sua região"
                hint={
                  region.city
                    ? `Selecionado pela sua localização: ${region.city}, ${region.state}`
                    : undefined
                }
                className={`${GUTTER} mb-4`}
                actions={
                  <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface/60 px-3 py-1 text-[11px] font-medium text-muted-foreground sm:flex">
                    <MapPin className="h-3 w-3 text-primary" />
                    {region.state}
                  </span>
                }
              />
              <Rail itemClassName="w-[188px] md:w-[220px]">
                {stateChannels.map((channel) => (
                  <TileCard key={channel.id} channel={channel} />
                ))}
              </Rail>
            </section>
          )}

          {openChannels.length > 0 && (
            <section>
              <SectionHeader
                title="Canais abertos"
                eyebrow="Sinal aberto"
                className={`${GUTTER} mb-4`}
              />
              <Rail itemClassName="w-[188px] md:w-[220px]">
                {openChannels.map((channel) => (
                  <TileCard key={channel.id} channel={channel} />
                ))}
              </Rail>
            </section>
          )}

          {rails.map((rail) => (
            <section key={rail.category}>
              <SectionHeader
                title={rail.title}
                eyebrow={rail.eyebrow}
                href={`/tv/live?cat=${rail.category}`}
                className={`${GUTTER} mb-4`}
              />
              <Rail itemClassName="w-[188px] md:w-[220px]">
                {rail.channels.map((channel) => (
                  <TileCard key={channel.id} channel={channel} />
                ))}
              </Rail>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilteredGrid({
  filtered,
  page,
  category,
  query,
}: {
  filtered: Awaited<ReturnType<typeof getPlaylistChannels>>;
  page: number;
  category?: string;
  query?: string;
}) {
  const label = category ? CATEGORY_LABELS[category] ?? category : "Resultados";
  const params = (nextPage: number) => {
    const search = new URLSearchParams();
    if (category) search.set("cat", category);
    if (query) search.set("q", query);
    search.set("page", String(nextPage));
    return `/tv/live?${search.toString()}`;
  };

  return (
    <div className={`${GUTTER} mt-10`}>
      <SectionHeader
        title={query ? `Resultados para “${query}”` : label}
        hint={`${filtered.total.toLocaleString("pt-BR")} canais`}
        className="mb-5"
      />

      {filtered.items.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <div className="defer-paint grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.items.map((channel) => (
            <TileCard key={channel.id} channel={channel} />
          ))}
        </div>
      )}

      {filtered.totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={params(page - 1)}
              className="rounded-xl border border-white/[0.08] bg-surface px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Anterior
            </Link>
          )}
          <span className="px-3 text-sm tabular-nums text-muted-foreground">
            {page} / {filtered.totalPages}
          </span>
          {page < filtered.totalPages && (
            <Link
              href={params(page + 1)}
              className="rounded-xl border border-white/[0.08] bg-surface px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Próxima
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface/40 px-6 py-20 text-center">
      <p className="text-sm font-semibold text-foreground">Nenhum canal encontrado</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {query ? `Nada corresponde a “${query}”.` : "Escolha outra categoria."}
      </p>
    </div>
  );
}

function capitalize(value: string | null | undefined) {
  if (!value) return null;
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
