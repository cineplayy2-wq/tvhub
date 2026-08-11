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
      className={cn("group block w-full", className)}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-3xl bg-surface ring-1 ring-inset ring-white/10 transition-all duration-300 group-hover:ring-2 group-hover:ring-indigo-300/70 group-active:scale-[0.97]">
        <Artwork src={art} alt={name} seed={channel.id} sizes="(max-width: 768px) 136px, 164px" />

        <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all duration-300 group-hover:bg-background/40 group-hover:opacity-100">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl">
            <Play className="ml-1 h-6 w-6" fill="currentColor" />
          </span>
        </div>

        {live && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Ao vivo
          </span>
        )}
      </div>

      <p className="mt-2.5 line-clamp-2 px-1 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-indigo-200">
        {name}
      </p>
    </Link>
  );
}

/**
 * Bolha de personagem/estúdio.
 *
 * É o atalho principal da área infantil: redondo, grande e com a arte do
 * personagem. Funciona antes da alfabetização — o rótulo abaixo é para o
 * adulto que está por perto.
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
    <Link href={href} className="group flex w-full flex-col items-center gap-2.5">
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-full bg-surface transition-all duration-300",
          "ring-2 ring-inset",
          active
            ? "ring-indigo-300"
            : "ring-white/10 group-hover:ring-indigo-300/70 group-active:scale-95",
        )}
      >
        <Artwork src={artwork} alt={label} seed={label} />
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
      </div>

      <span
        className={cn(
          "line-clamp-2 text-center text-[13px] font-semibold leading-tight transition-colors",
          active ? "text-indigo-200" : "text-muted group-hover:text-foreground",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
