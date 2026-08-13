"use client";

import Link from "next/link";
import { Play, Star } from "lucide-react";

import { Artwork } from "./artwork";
import { MediaKindTag } from "./media-kind-tag";
import { isSeriesItem } from "@/lib/iptv/media-kind";
import { cleanMediaTitle, cleanSeriesTitle, cn } from "@/lib/utils";

export type PosterItem = {
  id: string;
  name: string;
  logoUrl?: string | null;
  posterUrl?: string | null;
  tmdbPosterUrl?: string | null;
  quality?: string | null;
  rating?: number | null;
  tmdbRating?: number | null;
  year?: number | null;
  episodeCount?: number;
  /** Já resolvido pela consulta (ShowcaseItem traz pronto); vence o palpite. */
  isSeries?: boolean;
  streamUrl?: string | null;
  group?: { name: string; slug: string; category: string | null } | null;
};

/**
 * Card de filme ou série.
 *
 * Se for série, exibe o título limpo da obra (sem S01E01) e abre a página
 * de episódios (/tv/serie/[seriesName]), permitindo escolher a temporada.
 */
export function PosterCard({
  item,
  href,
  badge,
  priority = false,
  className,
}: {
  item: PosterItem;
  href: string;
  badge?: string;
  priority?: boolean;
  className?: string;
}) {
  const isSeries =
    item.isSeries ??
    (item.episodeCount != null ||
      isSeriesItem({
        streamUrl: item.streamUrl,
        name: item.name,
        category: item.group?.category,
      }));
  const name = isSeries ? cleanSeriesTitle(item.name) : cleanMediaTitle(item.name);
  const art = item.posterUrl ?? item.tmdbPosterUrl ?? item.logoUrl;
  const rating = item.rating ?? item.tmdbRating ?? 0;

  const targetHref = isSeries && href.includes("/tv/assistir/")
    ? `/tv/serie/${encodeURIComponent(name)}`
    : href;

  return (
    <Link href={targetHref} prefetch className={cn("group block w-full", className)}>
      <div className="card-edge relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface transition-shadow duration-300 group-hover:ring-primary/50 group-hover:shadow-card">
        <Artwork
          src={art}
          alt={name}
          seed={item.id}
          eager={priority}
          sizes="(max-width: 768px) 132px, 152px"
        />

        <div className="absolute inset-0 bg-background/0 transition-colors duration-300 group-hover:bg-background/45" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
          </span>
        </div>

        {badge && (
          <span className="absolute left-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
            {badge}
          </span>
        )}



        {item.episodeCount != null && item.episodeCount > 0 && (
          <span className="chip-over-art absolute right-2 top-2 text-[10px] font-semibold tabular-nums text-foreground">
            {item.episodeCount} ep
          </span>
        )}

        <MediaKindTag isSeries={isSeries} />
      </div>

      <div className="mt-2 px-0.5">
        <p className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-accent">
          {name}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {item.year ? <span className="tabular-nums">{item.year}</span> : null}
          {rating > 0 ? (
            <span className="flex items-center gap-0.5 tabular-nums">
              <Star className="h-3 w-3 fill-primary text-accent" />
              {rating.toFixed(1)}
            </span>
          ) : null}
          {!item.year && !rating && item.group?.name ? (
            <span className="truncate">{item.group.name}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
