"use client";

import { useRef } from "react";
import Link from "next/link";
import { Play, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { ContinueWatchingItem } from "@/lib/iptv/watch-progress-service";

export function ContinueWatchingCarousel({ items }: { items: ContinueWatchingItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="relative my-8">
      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <Play className="h-4 w-4 fill-current ml-0.5" />
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
            CONTINUAR ASSISTINDO
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scroll("left")}
            className="hidden rounded-full border border-white/10 bg-black/40 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white backdrop-blur-md md:block"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            className="hidden rounded-full border border-white/10 bg-black/40 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white backdrop-blur-md md:block"
            aria-label="Próximo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Row */}
      <div
        ref={scrollRef}
        className="scrollbar-none flex gap-4 overflow-x-auto px-6 md:px-12 pb-4 pt-1"
      >
        {items.map((item) => (
          <Link
            key={item.channelId}
            href={`/tv/assistir/${item.channelId}`}
            className="group relative flex shrink-0 flex-col w-[200px] md:w-[240px] overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/80 hover:shadow-2xl"
          >
            {/* Image / Thumbnail Container */}
            <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
              {item.logoUrl ? (
                <img
                  src={item.logoUrl}
                  alt={item.cleanName}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 p-3 text-center text-xs font-bold text-white/90">
                  {item.cleanName}
                </div>
              )}

              {/* Play Overlay Button */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                </div>
              </div>

              {/* Progress Bar at bottom of thumbnail */}
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${item.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Title & Info */}
            <div className="p-3">
              <h3 className="line-clamp-1 text-xs font-bold text-white transition-colors group-hover:text-accent">
                {item.cleanName}
              </h3>
              <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-white/60">
                <RotateCcw className="h-3 w-3 text-accent" />
                Parou em {item.progressPercent}%
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
