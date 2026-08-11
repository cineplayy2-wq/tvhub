import Link from "next/link";
import { notFound } from "next/navigation";
import { Play, Sparkles } from "lucide-react";

import { Artwork } from "@/components/iptv/artwork";
import { EmptyPlaylist } from "@/components/iptv/playlist-state";
import { PosterCard } from "@/components/iptv/poster-card";
import { Rail } from "@/components/iptv/rail";
import { GUTTER, SectionHeader } from "@/components/iptv/section";
import { getAiPickedCurations } from "@/lib/ai/smart-recommender";
import { requireUser } from "@/lib/auth/session";
import { cachedRow, matchTmdbInPlaylist, showcaseHref } from "@/lib/queries/discover";
import { getViewablePlaylist } from "@/lib/queries/iptv";
import { getTmdbTopRated, getTrendingTmdb } from "@/lib/tmdb/client";
import { cleanMediaTitle } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dicas" };

/**
 * Aba Dicas, do protótipo.
 *
 * O propósito declarado do produto é a pessoa saber o que assistir sem perder
 * tempo procurando. Esta aba é a resposta direta a isso: poucas escolhas, cada
 * uma com o MOTIVO à vista. Uma recomendação sem justificativa é só mais um
 * card na pilha; com justificativa, vira decisão.
 */
export default async function DicasPage() {
  const user = await requireUser();
  const playlist = await getViewablePlaylist(user.id);

  if (!playlist) notFound();
  if (!playlist.hasChannels) return <EmptyPlaylist status={playlist.syncStatus} />;

  const playlistId = playlist.id;

  const [picks, trending, acclaimed] = await Promise.all([
    getAiPickedCurations(playlistId),
    cachedRow(`${playlistId}:trending`, async () =>
      matchTmdbInPlaylist(playlistId, await getTrendingTmdb("all"), { limit: 18 }),
    ),
    cachedRow(`${playlistId}:acclaimed`, async () =>
      matchTmdbInPlaylist(playlistId, await getTmdbTopRated("movie"), {
        limit: 18,
        preferType: "movie",
      }),
    ),
  ]);

  const destaque = trending[0] ?? acclaimed[0] ?? null;

  return (
    <div className="min-h-screen pb-32 pt-16">
      <div className={`${GUTTER} py-8`}>
        <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          Escolhido para você
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Não sabe o que assistir?
        </h1>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          Poucas opções, cada uma com o motivo. Escolha uma e pronto.
        </p>
      </div>

      {/* A aposta da casa: uma escolha só, grande, com justificativa */}
      {destaque && (
        <div className={`${GUTTER} mb-12`}>
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-inset ring-white/10">
            <div className="absolute inset-0">
              <Artwork
                src={destaque.backdropUrl ?? destaque.posterUrl}
                alt={destaque.name}
                seed={destaque.id}
                role="backdrop"
                eager
              />
            </div>
            <div className="scrim-hero absolute inset-0" />

            <div className="relative flex min-h-[320px] flex-col justify-end p-6 md:min-h-[400px] md:p-10">
              <span className="mb-3 w-fit rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                A aposta de hoje
              </span>

              <h2 className="max-w-xl text-2xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
                {cleanMediaTitle(destaque.name)}
              </h2>

              <p className="mt-2 text-[13px] font-medium text-accent">
                Está em alta esta semana e já está na sua lista
                {destaque.rating > 0 ? ` · nota ${destaque.rating.toFixed(1)}` : ""}
              </p>

              {destaque.overview && (
                <p className="mt-3 line-clamp-2 max-w-lg text-sm leading-relaxed text-muted">
                  {destaque.overview}
                </p>
              )}

              <Link
                href={showcaseHref(destaque)}
                className="mt-6 flex w-fit items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <Play className="h-4 w-4" fill="currentColor" />
                Assistir agora
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-12">
        {picks.length > 0 && (
          <section>
            <SectionHeader
              title="Escolhidos pela IA"
              eyebrow="Seleção CineAI"
              hint="Calculado a partir do que existe na sua lista"
              className={`${GUTTER} mb-4`}
            />
            <Rail itemClassName="w-[112px] md:w-[140px]">
              {picks.map((item) => (
                <PosterCard
                  key={item.id}
                  item={item}
                  href={`/tv/assistir/${item.id}`}
                  badge={item.aiBadge?.replace(/[^\p{L}\p{N}\s]/gu, "").trim().slice(0, 18)}
                />
              ))}
            </Rail>
          </section>
        )}

        {trending.length > 0 && (
          <section>
            <SectionHeader
              title="Todo mundo está vendo"
              eyebrow="Em alta esta semana"
              hint="Dificilmente você erra por aqui"
              className={`${GUTTER} mb-4`}
            />
            <Rail itemClassName="w-[112px] md:w-[140px]">
              {trending.map((item) => (
                <PosterCard key={item.id} item={item} href={showcaseHref(item)} />
              ))}
            </Rail>
          </section>
        )}

        {acclaimed.length > 0 && (
          <section>
            <SectionHeader
              title="Se quiser algo bom de verdade"
              eyebrow="Nota alta"
              hint="Aclamados pela crítica que estão na sua lista"
              className={`${GUTTER} mb-4`}
            />
            <Rail itemClassName="w-[112px] md:w-[140px]">
              {acclaimed.map((item) => (
                <PosterCard key={item.id} item={item} href={showcaseHref(item)} />
              ))}
            </Rail>
          </section>
        )}
      </div>
    </div>
  );
}
