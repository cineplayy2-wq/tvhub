import Link from "next/link";
import { notFound } from "next/navigation";
import { Radio, Search, Trophy } from "lucide-react";

import { cleanGroupLabel, FilterChips } from "@/components/iptv/filter-chips";
import { Rail } from "@/components/iptv/rail";
import { GUTTER, SectionHeader } from "@/components/iptv/section";
import { TileCard } from "@/components/iptv/tile-card";
import { ShowcaseHero, type HeroSlide } from "@/components/iptv/showcase-hero";
import { prisma } from "@/lib/prisma";
import { EmptyPlaylist } from "@/components/iptv/playlist-state";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { getPlaylistChannels, getViewablePlaylist } from "@/lib/queries/iptv";
import { dedupeChannels } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Esportes Ao Vivo — Hubflix" };

const COMPETITIONS: Array<{ key: string; title: string; eyebrow: string; terms: string[] }> = [
  {
    key: "futebol",
    title: "Futebol Ao Vivo",
    eyebrow: "Brasileirão, Libertadores e Champions",
    terms: ["premiere", "sportv", "brasileir", "champions", "libertadores", "copa", "futebol"],
  },
  {
    key: "espn",
    title: "ESPN, TNT e Fox",
    eyebrow: "Canais Esportivos 24h",
    terms: ["espn", "tnt sports", "fox sports", "disney+ premium", "sportv"],
  },
  {
    key: "luta",
    title: "Lutas e MMA",
    eyebrow: "UFC, Combate e Boxe",
    terms: ["combate", "ufc", "boxe", "mma"],
  },
  {
    key: "streamers",
    title: "CazéTV & Transmissões Digitais",
    eyebrow: "Streamers e Sinal Livre",
    terms: ["caze", "cazé", "goat", "bandsports", "nsports"],
  },
  {
    key: "eua",
    title: "NBA, NFL e Automobilismo",
    eyebrow: "Esporte Americano e F1",
    terms: ["nba", "nfl", "mlb", "f1", "formula 1", "league pass"],
  },
];

const CHANNEL_SELECT = {
  id: true,
  name: true,
  streamUrl: true,
  logoUrl: true,
  quality: true,
  isFavorite: true,
  relevanceScore: true,
  group: { select: { name: true, slug: true, category: true } },
};

export default async function SportsHubPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; sub?: string };
}) {
  const user = await requireUser();
  const [playlist, profile] = await Promise.all([
    getViewablePlaylist(user.id),
    getActiveProfile(user.id),
  ]);

  if (!playlist) notFound();
  if (!playlist.hasChannels) return <EmptyPlaylist status={playlist.syncStatus} />;
  if (playlist.lockedCategories.includes("sports")) notFound();

  const playlistId = playlist.id;
  const profileId = profile?.id ?? null;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const isBrowsing = !searchParams.q && !searchParams.sub && page === 1;

  const subGroups = playlist.groups
    .filter((group) => group.category === "sports" && group._count.channels > 0)
    .sort((a, b) => b._count.channels - a._count.channels);

  const selectedSubGroup = subGroups.find((group) => group.slug === searchParams.sub);

  const [result, rails] = await Promise.all([
    getPlaylistChannels({
      playlistId,
      category: "sports",
      groupId: selectedSubGroup?.id,
      search: searchParams.q,
      page,
      pageSize: 42,
      lockedCategories: playlist.lockedCategories,
      profileId,
    }),
    isBrowsing
      ? Promise.all(
          COMPETITIONS.map(async (competition) => ({
            ...competition,
            channels: dedupeChannels(
              await prisma.m3uChannel.findMany({
                where: {
                  playlistId,
                  isActive: true,
                  group: { isHidden: false, category: { not: "adult" } },
                  OR: competition.terms.flatMap((term) => [
                    { name: { contains: term, mode: "insensitive" as const } },
                    { group: { name: { contains: term, mode: "insensitive" as const } } },
                  ]),
                },
                take: 36,
                orderBy: { relevanceScore: "desc" },
                select: CHANNEL_SELECT,
              }),
            ).slice(0, 16),
          })),
        )
      : [],
  ]);

  // Slides de Hero para Esportes
  const heroSlides: HeroSlide[] = result.items.slice(0, 4).map((ch) => ({
    id: ch.id,
    name: ch.name,
    href: `/tv/assistir/${ch.id}`,
    backdropUrl: ch.logoUrl,
    posterUrl: ch.logoUrl,
    overview: "Transmissão esportiva ao vivo em alta definição.",
    rating: 9.5,
    year: new Date().getFullYear(),
    label: "Destaque Esportivo Ao Vivo",
    meta: ch.quality ?? "FHD",
    isFavorite: ch.isFavorite,
    streamUrl: ch.streamUrl,
  }));

  const chips = [
    {
      id: "all",
      label: "Todos os Esportes",
      count: subGroups.reduce((total, group) => total + group._count.channels, 0),
      href: "/tv/sports",
      active: !searchParams.sub,
    },
    ...subGroups.map((group) => ({
      id: group.id,
      label: cleanGroupLabel(group.name),
      count: group._count.channels,
      href: `/tv/sports?sub=${group.slug}`,
      active: searchParams.sub === group.slug,
    })),
  ];

  return (
    <div className="min-h-screen pb-24 pt-16">
      {/* Cabeçalho */}
      <div className={`${GUTTER} py-8`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Trophy className="h-3.5 w-3.5" />
              Sinal Ao Vivo
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Esportes Ao Vivo
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {result.total.toLocaleString("pt-BR")} canais e transmissões esportivas na sua lista
            </p>
          </div>

          <form action="/tv/sports" method="get" className="w-full md:w-80">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                type="text"
                defaultValue={searchParams.q}
                placeholder="Buscar time, canal ou jogo…"
                className="w-full rounded-xl border border-white/[0.08] bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </form>
        </div>

        {/* Hero de Esportes */}
        {isBrowsing && heroSlides.length > 0 && (
          <div className="mt-6 overflow-hidden md:rounded-2xl">
            <ShowcaseHero slides={heroSlides} size="compact" />
          </div>
        )}

        {/* Filtros em Cápsulas */}
        <FilterChips chips={chips} className="mt-8" />
      </div>

      {/* Trilhas de Esportes */}
      {isBrowsing && (
        <div className="space-y-12">
          {rails
            .filter((rail) => rail.channels.length > 0)
            .map((rail) => (
              <section key={rail.key}>
                <SectionHeader
                  title={rail.title}
                  eyebrow={rail.eyebrow}
                  className={`${GUTTER} mb-4`}
                />
                <Rail itemClassName="w-[188px] md:w-[220px]">
                  {rail.channels.map((channel) => (
                    <TileCard key={channel.id} channel={channel} live />
                  ))}
                </Rail>
              </section>
            ))}
        </div>
      )}

      {/* Toda a Grade Esportiva */}
      <div className={`${GUTTER} mt-12`}>
        <SectionHeader
          title={
            searchParams.q
              ? `Resultados para “${searchParams.q}”`
              : selectedSubGroup
                ? cleanGroupLabel(selectedSubGroup.name)
                : "Toda a grade esportiva"
          }
          hint={`${result.total.toLocaleString("pt-BR")} canais`}
          className="mb-5"
        />

        {result.items.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-surface/40 px-6 py-20 text-center">
            <p className="text-sm font-semibold text-foreground">Nenhum canal esportivo encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchParams.q ? `Nada corresponde a “${searchParams.q}”.` : "Tente selecionar outro filtro."}
            </p>
          </div>
        ) : (
          <div className="defer-paint grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {result.items.map((channel) => (
              <TileCard key={channel.id} channel={channel} live />
            ))}
          </div>
        )}

        {result.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            {page > 1 && (
              <PageLink page={page - 1} query={searchParams.q} sub={searchParams.sub}>
                Anterior
              </PageLink>
            )}
            <span className="px-3 text-sm tabular-nums text-muted-foreground">
              {page} / {result.totalPages}
            </span>
            {page < result.totalPages && (
              <PageLink page={page + 1} query={searchParams.q} sub={searchParams.sub}>
                Próxima
              </PageLink>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PageLink({
  page,
  query,
  sub,
  children,
}: {
  page: number;
  query?: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (sub) params.set("sub", sub);
  params.set("page", String(page));

  return (
    <Link
      href={`/tv/sports?${params.toString()}`}
      className="rounded-xl border border-white/[0.08] bg-surface px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}
