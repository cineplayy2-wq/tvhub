import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Search, Sparkles } from "lucide-react";

import { cleanGroupLabel, FilterChips } from "@/components/iptv/filter-chips";
import { PosterCard } from "@/components/iptv/poster-card";
import { TileCard } from "@/components/iptv/tile-card";
import { Rail } from "@/components/iptv/rail";
import { GUTTER, SectionHeader } from "@/components/iptv/section";
import { ShowcaseHero, type HeroSlide } from "@/components/iptv/showcase-hero";
import { EmptyPlaylist } from "@/components/iptv/playlist-state";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { getNovelasList, getPlaylistChannels, getViewablePlaylist } from "@/lib/queries/iptv";
import { enrichChannelsWithTmdb } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novelas e Doramas — Hubflix" };

export default async function NovelasPage({
  searchParams,
}: {
  searchParams: { q?: string; sub?: string; page?: string };
}) {
  const user = await requireUser();
  const activeProfile = await getActiveProfile(user.id).catch(() => null);
  if (activeProfile?.isKids) {
    redirect("/tv/kids");
  }
  const playlist = await getViewablePlaylist(user.id);

  if (!playlist) notFound();
  if (!playlist.hasChannels) return <EmptyPlaylist status={playlist.syncStatus} />;
  if (playlist.lockedCategories.includes("series")) notFound();

  const playlistId = playlist.id;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const isBrowsing = !searchParams.q && !searchParams.sub && page === 1;

  // Busca grupos relacionados a novelas e doramas
  const novelaGroups = playlist.groups.filter(
    (g) =>
      !g.isHidden &&
      (g.category === "series" || g.category === "novelas" || /novela|dorama|k-drama|turca/i.test(g.name)) &&
      g._count.channels > 0,
  );

  const selectedSubGroup = novelaGroups.find((g) => g.slug === searchParams.sub);

  // Busca lista de novelas VOD (Capítulo a capítulo) e canais ao vivo separadamente
  const [rawNovelas, liveNovelaChannels] = await Promise.all([
    getNovelasList(playlistId, 150, "vod"),
    getNovelasList(playlistId, 24, "live"),
  ]);
  
  // Filtragem por grupo ou busca
  let filteredList = rawNovelas;
  if (selectedSubGroup) {
    filteredList = filteredList.filter((item) => item.group?.slug === selectedSubGroup.slug);
  }
  if (searchParams.q) {
    const qLower = searchParams.q.toLowerCase();
    filteredList = filteredList.filter((item) => item.name.toLowerCase().includes(qLower));
  }

  const enrichedAll = await enrichChannelsWithTmdb(filteredList, 36);

  // Destaques para Hero de Novelas
  const heroSlides: HeroSlide[] = enrichedAll
    .filter((item) => item.backdropUrl)
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      name: item.name,
      href: `/tv/assistir/${item.id}`,
      backdropUrl: item.backdropUrl ?? null,
      posterUrl: item.posterUrl ?? item.logoUrl ?? null,
      overview: item.overview ?? "Acompanhe todos os capítulos desta superprodução.",
      rating: item.tmdbRating ?? 0,
      year: item.year ?? null,
      label: "Em alta nas Novelas",
      isSeries: true,
      isFavorite: item.isFavorite,
    }));

  // Trilhas por categoria temática
  const doramas = enrichedAll.filter((i) => /dorama|k-drama|corean/i.test(i.name + (i.group?.name || "")));
  const nacionais = enrichedAll.filter((i) => /globo|sbt|record|nacional|br/i.test(i.name + (i.group?.name || "")));
  const turcas = enrichedAll.filter((i) => /turca|turqu/i.test(i.name + (i.group?.name || "")));
  const emExibicao = enrichedAll.slice(0, 16);

  const chips = [
    {
      id: "all",
      label: "Todas as Novelas",
      count: rawNovelas.length,
      href: "/tv/novelas",
      active: !searchParams.sub,
    },
    ...novelaGroups.slice(0, 8).map((group) => ({
      id: group.id,
      label: cleanGroupLabel(group.name),
      count: group._count.channels,
      href: `/tv/novelas?sub=${group.slug}`,
      active: searchParams.sub === group.slug,
    })),
  ];

  return (
    <div className="min-h-screen pb-24 pt-16">
      {/* Cabeçalho da seção */}
      <div className={`${GUTTER} py-8`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              <BookOpen className="h-3.5 w-3.5" />
              Capítulo a capítulo
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Novelas e Doramas
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {rawNovelas.length.toLocaleString("pt-BR")} títulos disponíveis na sua lista
            </p>
          </div>

          <form action="/tv/novelas" method="get" className="w-full md:w-80">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                type="text"
                defaultValue={searchParams.q}
                placeholder="Buscar novela ou dorama…"
                className="w-full rounded-xl border border-white/[0.08] bg-surface py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </form>
        </div>

        {/* Hero de Novelas */}
        {isBrowsing && heroSlides.length > 0 && (
          <div className="mt-6 overflow-hidden md:rounded-2xl">
            <ShowcaseHero slides={heroSlides} size="compact" />
          </div>
        )}

        {/* Filtros em cápsula */}
        <FilterChips chips={chips} className="mt-8" />
      </div>

      {/* Trilhas Temáticas de Novelas */}
      {isBrowsing && (
        <div className="space-y-12 pb-4">
          {liveNovelaChannels.length > 0 && (
            <section>
              <SectionHeader
                title="Canais de Novela 24h & Ao Vivo"
                eyebrow="Transmissão Contínua"
                className={`${GUTTER} mb-4`}
              />
              <Rail itemClassName="w-[188px] md:w-[220px]">
                {liveNovelaChannels.map((channel) => (
                  <TileCard key={channel.id} channel={channel} />
                ))}
              </Rail>
            </section>
          )}

          {emExibicao.length > 0 && (
            <section>
              <SectionHeader
                title="Em Exibição e Em Alta"
                eyebrow="Acompanhando Agora"
                className={`${GUTTER} mb-4`}
              />
              <Rail itemClassName="w-[112px] md:w-[140px]">
                {emExibicao.map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    href={`/tv/assistir/${item.id}`}
                  />
                ))}
              </Rail>
            </section>
          )}

          {doramas.length > 0 && (
            <section>
              <SectionHeader
                title="Doramas & K-Dramas"
                eyebrow="Sucessos Asiáticos"
                className={`${GUTTER} mb-4`}
              />
              <Rail itemClassName="w-[112px] md:w-[140px]">
                {doramas.slice(0, 16).map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    href={`/tv/assistir/${item.id}`}
                  />
                ))}
              </Rail>
            </section>
          )}

          {nacionais.length > 0 && (
            <section>
              <SectionHeader
                title="Novelas Nacionais"
                eyebrow="Grandes Produções Brasileiras"
                className={`${GUTTER} mb-4`}
              />
              <Rail itemClassName="w-[112px] md:w-[140px]">
                {nacionais.slice(0, 16).map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    href={`/tv/assistir/${item.id}`}
                  />
                ))}
              </Rail>
            </section>
          )}

          {turcas.length > 0 && (
            <section>
              <SectionHeader
                title="Novelas Turcas"
                eyebrow="Dramas e Romances"
                className={`${GUTTER} mb-4`}
              />
              <Rail itemClassName="w-[112px] md:w-[140px]">
                {turcas.slice(0, 16).map((item) => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    href={`/tv/assistir/${item.id}`}
                  />
                ))}
              </Rail>
            </section>
          )}
        </div>
      )}

      {/* Grade Completa */}
      <div className={`${GUTTER} mt-10`}>
        <SectionHeader
          title={
            searchParams.q
              ? `Resultados para “${searchParams.q}”`
              : selectedSubGroup
                ? cleanGroupLabel(selectedSubGroup.name)
                : "Todo o acervo de novelas"
          }
          hint={`${enrichedAll.length.toLocaleString("pt-BR")} títulos`}
          className="mb-5"
        />

        {enrichedAll.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-surface/40 px-6 py-20 text-center">
            <p className="text-sm font-semibold text-foreground">Nenhuma novela encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchParams.q
                ? `Nada corresponde a “${searchParams.q}”.`
                : "Selecione outra categoria no filtro."}
            </p>
          </div>
        ) : (
          <div className="defer-paint grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {enrichedAll.map((item) => (
              <PosterCard
                key={item.id}
                item={item}
                href={`/tv/assistir/${item.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
