"use client";

import Link from "next/link";
import { Play } from "lucide-react";

import { Artwork } from "./artwork";
import { cleanMediaTitle, cn } from "@/lib/utils";

export type KidsCardData = {
  id: string;
  name: string;
  streamUrl?: string;
  logoUrl: string | null;
  posterUrl?: string | null;
  quality?: string | null;
  isFavorite?: boolean;
  tmdbRating?: number | null;
  group: {
    name: string;
    slug: string;
    category: string | null;
  } | null;
};

/**
 * Card da área infantil.
 *
 * Diferente do card adulto de propósito: cantos bem mais arredondados, área
 * de toque maior e o nome sempre visível em texto grande — criança não passa
 * o mouse para revelar informação, e muitas ainda estão aprendendo a ler, então
 * a arte precisa ocupar quase todo o card.
 */
export function KidsCard({
  channel,
  live = false,
  className,
}: {
  channel: KidsCardData;
  live?: boolean;
  className?: string;
}) {
  const name = cleanMediaTitle(channel.name);
  const art = channel.posterUrl ?? channel.logoUrl;

  return (
    <Link
      href={`/tv/assistir/${channel.id}`}
      className={cn("group block w-full transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97]", className)}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[1.75rem] bg-surface ring-2 ring-white/10 shadow-lg transition-all duration-300 group-hover:ring-4 group-hover:ring-pink-400 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.4)]">
        <Artwork src={art} alt={name} seed={channel.id} sizes="(max-width: 768px) 150px, 190px" />

        <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all duration-300 group-hover:bg-background/40 group-hover:opacity-100">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-primary-active text-white shadow-2xl transition-transform duration-200 group-hover:scale-110">
            <Play className="ml-1 h-7 w-7" fill="currentColor" />
          </span>
        </div>

        {live && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-xl">
            <span className="h-2 w-2 animate-ping rounded-full bg-white" />
            Ao vivo
          </span>
        )}
      </div>

      <p className="mt-3 line-clamp-2 px-1 text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-pink-300">
        {name}
      </p>
    </Link>
  );
}

/**
 * Bolha de personagem/estúdio.
 */
export function FranchiseBubble({
  label,
  artwork,
  href,
  active = false,
}: {
  label: string;
  artwork: string | null;
  href: string;
  active?: boolean;
}) {
  return (
    <Link href={href} className="group flex w-full flex-col items-center gap-2.5 transition-transform duration-300 hover:scale-110 active:scale-95">
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-full bg-surface shadow-xl transition-all duration-300",
          "ring-4",
          active
            ? "ring-pink-400 shadow-[0_0_25px_rgba(236,72,153,0.5)]"
            : "ring-white/20 group-hover:ring-purple-400 group-hover:shadow-[0_0_25px_rgba(168,85,247,0.4)]",
        )}
      >
        <Artwork
          src={artwork}
          alt={label}
          seed={`franchise-${label}`}
          sizes="(max-width: 768px) 80px, 110px"
        />
        <div className="absolute inset-0 bg-background/0 transition-colors duration-200 group-hover:bg-background/20" />
      </div>

      <p
        className={cn(
          "text-center text-xs font-bold transition-colors line-clamp-1",
          active
            ? "text-pink-300 font-extrabold"
            : "text-muted-foreground group-hover:text-white",
        )}
      >
        {label}
      </p>
    </Link>
  );
}
