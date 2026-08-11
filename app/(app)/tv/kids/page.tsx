import Link from "next/link";
import { Play, Search, Sparkles, Star } from "lucide-react";

import { Artwork } from "@/components/iptv/artwork";
import { FranchiseBubble, KidsCard } from "@/components/iptv/kids-card";
import { Rail } from "@/components/iptv/rail";
import { GUTTER } from "@/components/iptv/section";
import { EmptyPlaylist } from "@/components/iptv/playlist-state";
import { requireUser } from "@/lib/auth/session";
import {
  FRANCHISES,
  getFranchiseChannels,
  getKidsCatalog,
  getKidsLiveChannels,
  getKidsMovies,
  getKidsSeries,
  type Franchise,
  type KidsChannel,
} from "@/lib/queries/kids";
import { getViewablePlaylist } from "@/lib/queries/iptv";
import { cachedRow, matchTmdbInPlaylist, type ShowcaseItem } from "@/lib/queries/discover";
import {
  enrichChannelsWithTmdb,
  getTmdbFamilyAnimation,
  getTmdbKidsShows,
} from "@/lib/tmdb/client";
import { cleanMediaTitle } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function KidsHubPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; franquia?: string };
}) {
  try {
    const user = await requireUser();
    const playlist = await getViewablePlaylist(user.id);

    if (!playlist || !playlist.hasChannels) {
      return (
        <div className="kids-canvas min-h-screen pb-28 pt-20">
          <div className={`${GUTTER}`}>
            <EmptyPlaylist status={playlist?.syncStatus ?? "IDLE"} />
          </div>
        </div>
      );
    }

    const playlistId = playlist.id;
    const page = Math.max(1, Number(searchParams.page) || 1);
    const activeFranchise = FRANCHISES.find((item) => item.key === searchParams.franquia);
    const isBrowsing = !searchParams.q && !activeFranchise && page === 1;

    let franchises: Array<{ franchise: Franchise; channels: KidsChannel[] }> = [];
    let liveChannels: KidsChannel[] = [];
    let movies: KidsChannel[] = [];
    let series: KidsChannel[] = [];
    let animations: ShowcaseItem[] = [];
    let shows: ShowcaseItem[] = [];
    let catalog: Awaited<ReturnType<typeof getKidsCatalog>> | null = null;

    try {
      [franchises, liveChannels, movies, series, animations, shows, catalog] =
        await Promise.all([
          Promise.all(
            FRANCHISES.map(async (franchise) => ({
              franchise,
              channels: await getFranchiseChannels(playlistId, franchise, 18).catch(() => []),
            })),
          ),
          isBrowsing ? getKidsLiveChannels(playlistId, 18).catch(() => []) : [],
          isBrowsing ? getKidsMovies(playlistId, 18).catch(() => []) : [],
          isBrowsing ? getKidsSeries(playlistId, 18).catch(() => []) : [],
          isBrowsing
            ? cachedRow(`${playlistId}:k-animation`, async () =>
                matchTmdbInPlaylist(playlistId, await getTmdbFamilyAnimation().catch(() => []), {
                  limit: 18,
                  preferType: "movie",
                }),
              ).catch(() => [])
            : ([] as ShowcaseItem[]),
          isBrowsing
            ? cachedRow(`${playlistId}:k-shows`, async () =>
                matchTmdbInPlaylist(playlistId, await getTmdbKidsShows().catch(() => []), {
                  limit: 18,
                  preferType: "tv",
                }),
              ).catch(() => [])
            : ([] as ShowcaseItem[]),
          !isBrowsing && !activeFranchise
            ? getKidsCatalog(playlistId, { search: searchParams.q, page }).catch(() => null)
            : null,
        ]);
    } catch (err) {
      console.warn("[Kids queries warning]", err);
    }

    const available = franchises.filter((entry) => entry.channels.length >= 1);

    const spotlight = animations[0] ?? null;
    const fallbackSpotlight = spotlight ? null : movies[0] ?? liveChannels[0] ?? null;

    let enrichedMovies: KidsChannel[] = movies;
    let enrichedSeries: KidsChannel[] = series;

    try {
      [enrichedMovies, enrichedSeries] = await Promise.all([
        enrichChannelsWithTmdb(movies, 14).catch(() => movies),
        enrichChannelsWithTmdb(series, 14).catch(() => series),
      ]);
    } catch {}

    const franchiseChannels = activeFranchise
      ? franchises.find((entry) => entry.franchise.key === activeFranchise.key)?.channels ?? []
      : [];

    return (
      <div className="kids-canvas min-h-screen pb-28 pt-16">
        {/* Cabeçalho */}
        <div className={`${GUTTER} pt-8`}>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
                <Sparkles className="h-3.5 w-3.5" />
                Modo criança
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                Oi! O que vamos assistir?
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Desenhos, filmes e canais escolhidos só para a criançada — sem nada
                que não seja para elas.
              </p>
            </div>

            <form action="/tv/kids" method="get" className="w-full md:w-80">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  type="text"
                  defaultValue={searchParams.q}
                  placeholder="Procurar desenho…"
                  className="w-full rounded-2xl border border-white/10 bg-surface py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-300/20"
                />
              </div>
            </form>
          </div>
        </div>

        {/* Atalhos por personagem */}
        {available.length > 0 && (
          <div className="mt-8">
            <Rail itemClassName="w-[96px] md:w-[116px]">
              {available.map((entry) => (
                <FranchiseBubble
                  key={entry.franchise.key}
                  label={entry.franchise.label}
                  artwork={entry.channels.find((channel) => channel.logoUrl)?.logoUrl ?? null}
                  href={
                    activeFranchise?.key === entry.franchise.key
                      ? "/tv/kids"
                      : `/tv/kids?franquia=${entry.franchise.key}`
                  }
                  active={activeFranchise?.key === entry.franchise.key}
                />
              ))}
            </Rail>
          </div>
        )}

        {/* Destaque */}
        {isBrowsing && (spotlight || fallbackSpotlight) && (
          <div className={`${GUTTER} mt-10`}>
            <KidsSpotlight item={spotlight} fallback={fallbackSpotlight} />
          </div>
        )}

        {/* Prateleira de uma franquia selecionada */}
        {activeFranchise && (
          <div className={`${GUTTER} mt-10`}>
            <KidsSectionTitle
              title={activeFranchise.label}
              hint={`${franchiseChannels.length} títulos`}
              back
            />
            {franchiseChannels.length === 0 ? (
              <KidsEmpty />
            ) : (
              <div className="defer-paint grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {franchiseChannels.map((channel) => (
                  <KidsCard key={channel.id} channel={channel} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Busca / grade completa */}
        {catalog && (
          <div className={`${GUTTER} mt-10`}>
            <KidsSectionTitle
              title={searchParams.q ? `Achamos isto para “${searchParams.q}”` : "Tudo do Kids"}
              hint={`${catalog.total.toLocaleString("pt-BR")} títulos`}
              back={Boolean(searchParams.q)}
            />
            {catalog.items.length === 0 ? (
              <KidsEmpty />
            ) : (
              <>
                <div className="defer-paint grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {catalog.items.map((channel) => (
                    <KidsCard key={channel.id} channel={channel} />
                  ))}
                </div>

                {catalog.totalPages > 1 && (
                  <div className="mt-12 flex items-center justify-center gap-2">
                    {page > 1 && (
                      <KidsPageLink page={page - 1} query={searchParams.q}>
                        Anterior
                      </KidsPageLink>
                    )}
                    <span className="px-3 text-sm tabular-nums text-muted-foreground">
                      {page} / {catalog.totalPages}
                    </span>
                    {page < catalog.totalPages && (
                      <KidsPageLink page={page + 1} query={searchParams.q}>
                        Próxima
                      </KidsPageLink>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Vitrine */}
        {isBrowsing && (
          <div className="mt-14 space-y-12">
            {liveChannels.length > 0 && (
              <KidsRail
                title="Passando agora"
                hint="Canais de desenho 24 horas"
                channels={liveChannels}
                live
              />
            )}

            {shows.length > 0 && (
              <KidsRail
                title="Séries que todo mundo assiste"
                hint="As mais populares do momento"
                channels={shows.map(toKidsCard)}
              />
            )}

            {enrichedMovies.length > 0 && (
              <KidsRail
                title="Filmes para a sessão da tarde"
                hint="Animações completas"
                channels={enrichedMovies}
              />
            )}

            {animations.length > 1 && (
              <KidsRail
                title="Novidades da criançada"
                hint="Animações em alta que estão na sua lista"
                channels={animations.slice(1).map(toKidsCard)}
              />
            )}

            {enrichedSeries.length > 0 && (
              <KidsRail
                title="Episódios para maratonar"
                hint="Desenhos com temporadas completas"
                channels={enrichedSeries}
              />
            )}

            {available.map((entry) => (
              <KidsRail
                key={entry.franchise.key}
                title={entry.franchise.label}
                channels={entry.channels}
                href={`/tv/kids?franquia=${entry.franchise.key}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[KidsHubPage Error]", error);
    return (
      <div className="kids-canvas min-h-screen pb-28 pt-20">
        <div className={`${GUTTER}`}>
          <div className="rounded-3xl border border-white/[0.08] bg-surface/50 p-12 text-center">
            <h2 className="text-2xl font-bold text-foreground">Modo Infantil</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Carregando o catálogo infantil... Adicione sua lista IPTV nas configurações para exibir desenhos e canais 24h.
            </p>
          </div>
        </div>
      </div>
    );
  }
}

/** Converte um item casado com o TMDB para o formato do card infantil. */
function toKidsCard(item: ShowcaseItem) {
  return {
    id: item.id,
    name: item.name,
    logoUrl: item.logoUrl,
    posterUrl: item.posterUrl,
    quality: item.quality,
    isFavorite: item.isFavorite,
    group: item.group,
  };
}

function KidsSpotlight({
  item,
  fallback,
}: {
  item: ShowcaseItem | null;
  fallback: KidsChannel | null;
}) {
  const art = item?.backdropUrl ?? item?.posterUrl ?? fallback?.logoUrl ?? null;
  const name = cleanMediaTitle(item?.name ?? fallback?.name ?? "");
  const id = item?.id ?? fallback?.id;
  if (!id) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl ring-1 ring-inset ring-white/10">
      <div className="absolute inset-0">
        <Artwork src={art} alt={name} seed={id} role="backdrop" eager />
      </div>
      <div className="scrim-hero absolute inset-0" />

      <div className="relative flex min-h-[300px] flex-col justify-end p-6 md:min-h-[380px] md:p-10">
        <span className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-indigo-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-950">
          <Sparkles className="h-3.5 w-3.5" />
          Destaque de hoje
        </span>

        <h2 className="max-w-xl text-2xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
          {name}
        </h2>

        {item && item.rating > 0 && (
          <span className="mt-2 flex items-center gap-1 text-sm font-semibold text-indigo-200">
            <Star className="h-4 w-4 fill-current" />
            {item.rating.toFixed(1)}
          </span>
        )}

        {item?.overview && (
          <p className="mt-3 line-clamp-2 max-w-lg text-sm leading-relaxed text-muted">
            {item.overview}
          </p>
        )}

        <Link
          href={`/tv/assistir/${id}`}
          className="mt-6 flex w-fit items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-sm font-bold text-slate-900 transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Play className="h-4 w-4" fill="currentColor" />
          Assistir agora
        </Link>
      </div>
    </div>
  );
}

function KidsRail({
  title,
  hint,
  channels,
  href,
  live = false,
}: {
  title: string;
  hint?: string;
  channels: Array<Parameters<typeof KidsCard>[0]["channel"]>;
  href?: string;
  live?: boolean;
}) {
  if (channels.length === 0) return null;

  return (
    <section>
      <div className={`${GUTTER} mb-4 flex items-end justify-between gap-4`}>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
            {title}
          </h2>
          {hint && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{hint}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 rounded-full bg-white/[0.06] px-4 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:bg-white/10 hover:text-foreground"
          >
            Ver tudo
          </Link>
        )}
      </div>

      <Rail itemClassName="w-[136px] md:w-[164px]">
        {channels.map((channel) => (
          <KidsCard key={channel.id} channel={channel} live={live} />
        ))}
      </Rail>
    </section>
  );
}

function KidsSectionTitle({
  title,
  hint,
  back = false,
}: {
  title: string;
  hint?: string;
  back?: boolean;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="truncate text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      {back && (
        <Link
          href="/tv/kids"
          className="shrink-0 rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-white/10 hover:text-foreground"
        >
          Voltar
        </Link>
      )}
    </div>
  );
}

function KidsPageLink({
  page,
  query,
  children,
}: {
  page: number;
  query?: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("page", String(page));

  return (
    <Link
      href={`/tv/kids?${params.toString()}`}
      className="rounded-2xl border border-white/10 bg-surface/70 px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function KidsEmpty() {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-surface/40 px-6 py-20 text-center">
      <p className="text-base font-semibold text-foreground">Não achamos nada por aqui</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Tente outro personagem ou volte para o início do Kids.
      </p>
    </div>
  );
}
