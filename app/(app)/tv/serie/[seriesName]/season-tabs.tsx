"use client";

import { useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";

import { Artwork } from "@/components/iptv/artwork";
import { cn } from "@/lib/utils";

type Episode = {
  id: string;
  name: string;
  logoUrl: string | null;
  episodeNum: number;
};

/**
 * Temporadas e episódios.
 *
 * A lista é vertical e o número do episódio fica à esquerda em fonte tabular:
 * é assim que se percorre uma temporada com 24 episódios sem se perder. O
 * título do episódio já vem sem o "S02E05" repetido, que é redundante ao lado
 * do rótulo da temporada.
 */
export function SeasonTabs({
  seasons,
  seasonsData,
}: {
  seasons: number[];
  seasonsData: Record<number, Episode[]>;
}) {
  const [activeSeason, setActiveSeason] = useState(seasons[0] ?? 1);
  const episodes = seasonsData[activeSeason] ?? [];

  return (
    <div className="w-full">
      {seasons.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {seasons.map((season) => (
            <button
              key={season}
              type="button"
              onClick={() => setActiveSeason(season)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                activeSeason === season
                  ? "bg-primary text-primary-foreground"
                  : "border border-white/[0.08] bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              Temporada {season}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {episodes.map((episode, index) => (
          <Link
            key={episode.id}
            href={`/tv/assistir/${episode.id}`}
            className="group flex items-center gap-4 py-4 transition-colors hover:bg-surface/40"
          >
            <span className="w-8 shrink-0 text-center text-lg font-semibold tabular-nums text-muted-foreground transition-colors group-hover:text-primary">
              {episode.episodeNum || index + 1}
            </span>

            <div className="card-edge relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-surface md:w-44">
              <Artwork src={episode.logoUrl} alt={episode.name} seed={episode.id} sizes="(max-width: 768px) 128px, 176px" />
              <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all duration-300 group-hover:bg-background/45 group-hover:opacity-100">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1 pr-2">
              <h3 className="truncate text-[15px] font-medium text-foreground">
                {episodeTitle(episode.name)}
              </h3>
              <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">
                T{String(activeSeason).padStart(2, "0")} · E
                {String(episode.episodeNum || index + 1).padStart(2, "0")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function episodeTitle(rawName: string) {
  return (
    rawName
      .replace(/\[.*?\]|\(.*?\)/g, "")
      .replace(/\s*S\d+\s*E\d+\s*/i, " ")
      .replace(/\s+/g, " ")
      .trim() || rawName
  );
}
