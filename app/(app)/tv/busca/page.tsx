import Link from "next/link";
import { Heart, Search } from "lucide-react";

import { BackButton } from "@/components/iptv/back-button";
import { GUTTER, SectionHeader } from "@/components/iptv/section";
import { TileCard } from "@/components/iptv/tile-card";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { getPlaylistChannels, getViewablePlaylist } from "@/lib/queries/iptv";

export const dynamic = "force-dynamic";

export default async function TvSearchPage({
  searchParams,
}: {
  searchParams: { q?: string; favoritos?: string; page?: string };
}) {
  const user = await requireUser();
  const [playlist, profile] = await Promise.all([
    getViewablePlaylist(user.id),
    getActiveProfile(user.id),
  ]);

  const isFavoritesMode = searchParams.favoritos === "true";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const channels =
    playlist?.hasChannels
      ? await getPlaylistChannels({
          playlistId: playlist.id,
          search: searchParams.q,
          favoritesOnly: isFavoritesMode,
          page,
          pageSize: 42,
          adultUnlocked: playlist.adultUnlocked,
          lockedCategories: playlist.lockedCategories,
          profileId: profile?.id,
        })
      : null;

  const href = (nextPage: number) => {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (isFavoritesMode) params.set("favoritos", "true");
    params.set("page", String(nextPage));
    return `/tv/busca?${params.toString()}`;
  };

  return (
    <div className={`${GUTTER} min-h-screen pb-24 pt-24`}>
      <div className="mb-4">
        <BackButton
          fallbackHref="/tv"
          className="bg-white/5 text-foreground hover:bg-white/10"
        />
      </div>
      <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        {isFavoritesMode ? <Heart className="h-3.5 w-3.5 fill-current" /> : <Search className="h-3.5 w-3.5" />}
        {isFavoritesMode ? "Sua lista" : "Buscar"}
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        {isFavoritesMode ? "Favoritos" : "O que você procura?"}
      </h1>

      {!isFavoritesMode && (
        <form className="mt-6 max-w-xl" action="/tv/busca" method="get">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              type="text"
              defaultValue={searchParams.q}
              placeholder="Nome do canal, filme, série ou categoria…"
              autoFocus
              className="w-full rounded-xl border border-white/[0.08] bg-surface py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </form>
      )}

      <div className="mt-10">
        {!channels ? (
          <EmptyState message="Sua lista IPTV ainda não foi configurada." />
        ) : channels.items.length === 0 ? (
          <EmptyState
            message={
              isFavoritesMode
                ? "Você ainda não marcou nenhum canal como favorito."
                : searchParams.q
                  ? `Nenhum resultado para “${searchParams.q}”.`
                  : "Digite algo para começar."
            }
          />
        ) : (
          <>
            <SectionHeader
              title={
                isFavoritesMode
                  ? "Seus canais favoritos"
                  : `Resultados para “${searchParams.q ?? ""}”`
              }
              hint={`${channels.total.toLocaleString("pt-BR")} itens`}
              className="mb-5"
            />

            <div className="defer-paint grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {channels.items.map((channel) => (
                <TileCard
                  key={channel.id}
                  channel={channel}
                  live={channel.group?.category === "live"}
                />
              ))}
            </div>

            {channels.totalPages > 1 && (
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
                  {page} / {channels.totalPages}
                </span>
                {page < channels.totalPages && (
                  <Link
                    href={href(page + 1)}
                    className="rounded-xl border border-white/[0.08] bg-surface px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Próxima
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface/40 px-6 py-20 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
