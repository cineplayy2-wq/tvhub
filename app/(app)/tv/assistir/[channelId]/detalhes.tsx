import Link from "next/link";
import { Calendar, Radio, Star } from "lucide-react";

import { FavoriteButton } from "@/components/iptv/favorite-button";
import { SectionHeader } from "@/components/iptv/section";
import { TileCard } from "@/components/iptv/tile-card";
import { getPlaylistChannels } from "@/lib/queries/iptv";
import {
  getTmdbDetails,
  isTmdbConfigured,
  searchTmdb,
  tmdbImage,
  type TmdbDetails,
} from "@/lib/tmdb/client";

/**
 * Ficha do conteúdo: capa, sinopse, elenco e o que tem no mesmo grupo.
 *
 * Vive fora da página de propósito, atrás de um Suspense. Antes tudo isto era
 * resolvido ANTES de renderizar qualquer coisa — inclusive duas chamadas
 * sequenciais ao TMDB pela internet. O assinante clicava no canal e ficava
 * olhando tela preta esperando metadado que ele nem tinha pedido: o vídeo só
 * existia na página depois que a busca externa voltava.
 *
 * Agora o player entra na primeira leva do HTML e isto chega quando ficar
 * pronto, sem segurar a reprodução.
 */

function limparNomeParaTmdb(nome: string): string {
  return nome
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/\b(4K|FHD|HD|SD|DUBLADO|LEGENDADO|DUB|LEG|NATIONAL|COMPLETE|S\d+E\d+)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Grupo = { id: string; name: string; slug: string; category: string | null } | null;

export async function DetalhesDoConteudo({
  channelId,
  playlistId,
  nome,
  logoUrl,
  quality,
  isFavorite,
  group,
  isVod,
}: {
  channelId: string;
  playlistId: string;
  nome: string;
  logoUrl: string | null;
  quality: string | null;
  isFavorite: boolean;
  group: Grupo;
  isVod: boolean;
}) {
  // As duas buscas são independentes: vão juntas em vez de uma esperar a outra.
  const [tmdbDetails, relacionados] = await Promise.all([
    (async (): Promise<TmdbDetails | null> => {
      if (!isVod || !isTmdbConfigured()) return null;
      try {
        const achados = await searchTmdb(limparNomeParaTmdb(nome));
        if (achados.length === 0) return null;
        return await getTmdbDetails(achados[0].tmdbId, achados[0].mediaType);
      } catch {
        return null;
      }
    })(),
    group
      ? getPlaylistChannels({ playlistId, groupId: group.id, page: 1, pageSize: 12 })
      : Promise.resolve(null),
  ]);

  const related = relacionados?.items.filter((ch) => ch.id !== channelId).slice(0, 12) ?? [];
  const backdropUrl = tmdbImage(tmdbDetails?.backdropPath ?? null, "w1280");
  const posterUrl = tmdbImage(tmdbDetails?.posterPath ?? null, "w342") || logoUrl;

  return (
    <>
      {backdropUrl && (
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-15 blur-3xl"
          style={{
            backgroundImage: `url(${backdropUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="flex items-start gap-4">
            {posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrl}
                alt={nome}
                className="h-20 w-16 shrink-0 rounded-xl border border-border/50 object-cover shadow-lg md:h-28 md:w-20"
              />
            ) : (
              <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-gradient-to-br from-primary/20 to-primary/5 md:h-28 md:w-20">
                <Radio className="h-8 w-8 text-accent/60" strokeWidth={1.5} />
              </div>
            )}

            <div>
              <h1 className="text-xl font-extrabold text-foreground md:text-2xl">
                {tmdbDetails?.name || nome}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {group && (
                  <Link
                    href={`/tv/${group.slug}`}
                    className="rounded-md border border-border/50 bg-surface-elevated px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:text-accent"
                  >
                    {group.name}
                  </Link>
                )}


                {group?.category === "live" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-0.5 font-bold uppercase tracking-wider text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    AO VIVO
                  </span>
                )}

                {tmdbDetails?.releaseYear && (
                  <span className="flex items-center gap-1 rounded-md border border-border/40 bg-surface px-2.5 py-1 text-xs">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {tmdbDetails.releaseYear}
                  </span>
                )}

                {tmdbDetails?.rating ? (
                  <span className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {tmdbDetails.rating.toFixed(1)} TMDB
                  </span>
                ) : null}
              </div>

              {tmdbDetails?.genres && tmdbDetails.genres.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tmdbDetails.genres.map((genero) => (
                    <span
                      key={genero}
                      className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-accent"
                    >
                      {genero}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <FavoriteButton
            channelId={channelId}
            isFavorite={isFavorite}
            className="rounded-full border border-border bg-surface-elevated p-3 hover:bg-surface"
          />
        </div>

        {tmdbDetails?.overview ? (
          <div className="mt-6 rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Sinopse do Conteúdo
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              {tmdbDetails.overview}
            </p>
            {tmdbDetails.cast && tmdbDetails.cast.length > 0 && (
              <div className="mt-4 border-t border-border/40 pt-4">
                <span className="text-xs font-bold text-muted-foreground">Elenco: </span>
                <span className="text-xs text-foreground/80">{tmdbDetails.cast.join(", ")}</span>
              </div>
            )}
          </div>
        ) : null}

        {related.length > 0 && (
          <div className="mt-10">
            <SectionHeader
              title={group ? `Mais em ${group.name}` : "Recomendados"}
              className="mb-5"
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {related.map((item) => (
                <TileCard key={item.id} channel={item} live={item.group?.category === "live"} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Espaço reservado enquanto a ficha carrega — o vídeo já está tocando acima. */
export function DetalhesEsqueleto({ nome }: { nome: string }) {
  return (
    <div className="relative z-10 mx-auto max-w-7xl">
      <div className="flex items-start gap-4">
        <div className="h-20 w-16 shrink-0 animate-pulse rounded-xl bg-surface md:h-28 md:w-20" />
        <div>
          <h1 className="text-xl font-extrabold text-foreground md:text-2xl">{nome}</h1>
          <div className="mt-3 h-4 w-40 animate-pulse rounded bg-surface" />
        </div>
      </div>
    </div>
  );
}
