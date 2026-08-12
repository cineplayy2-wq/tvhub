import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";

import { AppHeader } from "@/components/catalog/app-header";
import { BackButton } from "@/components/iptv/back-button";
import { AgeBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { WatchlistButton } from "@/components/catalog/watchlist-button";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { getTitleDetail, isInWatchlist } from "@/lib/queries/browse";
import { cn, formatDuration } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Título",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TitleDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireUser();
  const profile = await requireProfile(user.id);

  const title = await getTitleDetail(params.slug, profile.maxAgeRating);
  // 404 também quando a classificação bloqueia: distinguir "não existe" de
  // "existe mas você não pode" já entrega a existência do título.
  if (!title) notFound();

  const inWatchlist = await isInWatchlist(profile.id, title.id);

  const isSeries = title.type === "SERIES";
  const playableEpisode = title.episodes.find((e) => e.videoStatus === "READY");
  const canPlay = isSeries
    ? Boolean(playableEpisode)
    : title.videoStatus === "READY";

  // Licença e pendências ficam nas tags; só as licenças interessam ao usuário
  const licenses = title.tags.filter((tag) => !tag.startsWith("PENDENTE:"));

  return (
    <div className="min-h-screen pb-20">
      <AppHeader profile={profile} isAdmin={user.role === "ADMIN"} />

      <div className="absolute left-5 top-24 z-30 sm:left-10">
        <BackButton fallbackHref="/inicio" />
      </div>

      <div className="relative h-[52vh] min-h-[20rem] w-full">
        {title.backdropUrl ? (
          <Image
            src={title.backdropUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-surface-elevated to-background" />
        )}
        <div aria-hidden className="absolute inset-0 hero-scrim" />
      </div>

      <div className="relative z-10 -mt-32 px-5 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-8 lg:flex-row">
            {title.posterUrl && (
              <div className="relative hidden h-72 w-48 shrink-0 overflow-hidden rounded-lg border border-border shadow-card lg:block">
                <Image
                  src={title.posterUrl}
                  alt=""
                  fill
                  sizes="192px"
                  className="object-cover"
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="font-display text-display-sm uppercase leading-[0.92] tracking-tightest text-foreground">
                {title.name}
              </h1>

              {title.originalName && title.originalName !== title.name && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {title.originalName}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
                <AgeBadge rating={title.ageRating} />
                {title.releaseYear && <span>{title.releaseYear}</span>}
                {title.durationSeconds && (
                  <span>{formatDuration(title.durationSeconds)}</span>
                )}
                {isSeries && <span>{title.episodes.length} episódios</span>}
                {title.genres.map((genre) => (
                  <span key={genre.slug} className="text-muted-foreground">
                    {genre.name}
                  </span>
                ))}
              </div>

              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                {title.synopsis}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {canPlay ? (
                  <Link
                    href={
                      isSeries && playableEpisode
                        ? `/assistir/${title.slug}?ep=${playableEpisode.id}`
                        : `/assistir/${title.slug}`
                    }
                    className={cn(
                      buttonVariants({ variant: "primary", size: "lg" }),
                    )}
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden />
                    Assistir
                  </Link>
                ) : (
                  // Botão desabilitado com motivo é melhor que botão que
                  // leva a um player vazio
                  <span
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "lg" }),
                      "cursor-not-allowed opacity-60",
                    )}
                  >
                    Vídeo indisponível
                  </span>
                )}

                <WatchlistButton titleId={title.id} initialInList={inWatchlist} />
              </div>

              <dl className="mt-8 space-y-2 border-t border-border pt-6 text-sm">
                {title.director && (
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-muted-foreground">Direção</dt>
                    <dd className="text-muted">{title.director}</dd>
                  </div>
                )}
                {title.cast.length > 0 && (
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-muted-foreground">Elenco</dt>
                    <dd className="text-muted">{title.cast.join(", ")}</dd>
                  </div>
                )}
                {licenses.length > 0 && (
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-muted-foreground">Licença</dt>
                    <dd className="text-muted-foreground">
                      {licenses.join(" · ")}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {isSeries && title.episodes.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-4 text-lg font-medium tracking-display text-foreground">
                Episódios
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {title.episodes.map((episode) => {
                  const ready = episode.videoStatus === "READY";
                  return (
                    <li key={episode.id}>
                      <Link
                        href={
                          ready
                            ? `/assistir/${title.slug}?ep=${episode.id}`
                            : `/titulo/${title.slug}`
                        }
                        aria-disabled={!ready}
                        className={cn(
                          "flex items-center gap-4 px-4 py-4 transition-colors",
                          ready
                            ? "hover:bg-surface-hover"
                            : "pointer-events-none opacity-50",
                        )}
                      >
                        <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
                          T{episode.season}:E{episode.number}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {episode.name}
                          </span>
                          {episode.synopsis && (
                            <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                              {episode.synopsis}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {episode.durationSeconds
                            ? formatDuration(episode.durationSeconds)
                            : ready
                              ? ""
                              : "Indisponível"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
