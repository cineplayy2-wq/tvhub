"use client";

import Link from "next/link";
import { Play } from "lucide-react";

import { Artwork } from "./artwork";
import { FavoriteButton } from "./favorite-button";
import { cleanMediaTitle, cleanSeriesTitle, cn } from "@/lib/utils";

export type TileItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  quality?: string | null;
  isFavorite?: boolean;
  group?: { name: string; slug: string; category: string | null } | null;
};

/**
 * Card de canal ao vivo ou item de grade.
 */
export function TileCard({
  channel,
  live = true,
  className,
}: {
  channel: TileItem;
  live?: boolean;
  className?: string;
}) {
  const isSeries = channel.group?.category === "series";
  const name = isSeries ? cleanSeriesTitle(channel.name) : cleanMediaTitle(channel.name);
  const href = isSeries
    ? `/tv/serie/${encodeURIComponent(name)}`
    : `/tv/assistir/${channel.id}`;

  return (
    <div className={cn("group w-full", className)}>
      <Link href={href} prefetch className="block">
        <div className="card-edge relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-b from-surface-elevated to-surface transition-shadow duration-300 group-hover:ring-primary/50 group-hover:shadow-card">
          <Artwork src={channel.logoUrl} alt={name} seed={channel.id} fit="contain" />

          <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all duration-300 group-hover:bg-background/50 group-hover:opacity-100">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
            </span>
          </div>

          {live && !isSeries && (
            <span className="chip-over-art absolute left-2 top-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                Ao vivo
              </span>
            </span>
          )}

          {channel.quality && (
            <span className="chip-over-art absolute right-2 top-2 text-[10px] font-bold uppercase tracking-wide text-muted">
              {channel.quality}
            </span>
          )}
        </div>
      </Link>

      <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <Link href={href} prefetch>
            <p className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
              {name}
            </p>
          </Link>
          {channel.group?.name && (
            <p className="truncate text-[11px] text-muted-foreground">
              {channel.group.name.replace(/^[^\p{L}\p{N}]+/u, "")}
            </p>
          )}
        </div>

        {channel.isFavorite != null && (
          <FavoriteButton channelId={channel.id} isFavorite={channel.isFavorite} />
        )}
      </div>
    </div>
  );
}
