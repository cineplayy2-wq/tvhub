"use client";

import Link from "next/link";
import { Play, RotateCcw, Sparkles } from "lucide-react";

import { Rail } from "@/components/iptv/rail";
import { GUTTER } from "@/components/iptv/section";
import type { ContinueWatchingItem } from "@/lib/iptv/watch-progress-service";

function formatMinutesLeft(positionSeconds: number, durationSeconds: number): string {
  if (!durationSeconds || durationSeconds <= positionSeconds) return "";
  const remainingSeconds = durationSeconds - positionSeconds;
  const minutes = Math.ceil(remainingSeconds / 60);
  if (minutes < 60) return `Faltam ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `Faltam ${hours}h ${remMin}m`;
}

export function ContinueWatchingRail({
  items,
  title = "Continuar Assistindo",
  subtitle = "Continue de onde você parou no seu perfil",
}: {
  items: ContinueWatchingItem[];
  title?: string;
  subtitle?: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <section className="my-8">
      <div className={`${GUTTER} mb-4 flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30">
            <RotateCcw className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl flex items-center gap-2">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <Rail itemClassName="w-[180px] sm:w-[220px] md:w-[260px]">
        {items.map((item) => {
          const isLive = item.category === "live" || !item.durationSeconds || item.durationSeconds <= 0;
          const percent = item.progressPercent;
          const minutesLeft = formatMinutesLeft(item.positionSeconds, item.durationSeconds);

          return (
            <div key={item.channelId} className="group relative flex flex-col space-y-2">
              {/* Card Thumbnail */}
              <Link
                href={`/tv/assistir/${item.channelId}`}
                className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-md transition-all duration-300 group-hover:scale-[1.03] group-hover:border-primary/60 group-hover:shadow-[0_0_25px_rgba(108,29,255,0.4)]"
              >
                {item.logoUrl ? (
                  <img
                    src={item.logoUrl}
                    alt={item.cleanName}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-slate-900 to-black p-4 text-center">
                    <span className="text-sm font-bold text-white line-clamp-2">{item.cleanName}</span>
                  </div>
                )}

                {/* Overlay Play Hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 backdrop-blur-[2px]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform group-hover:scale-110">
                    <Play className="h-6 w-6 ml-0.5" fill="currentColor" />
                  </div>
                </div>

                {/* Badge Ao Vivo ou Badge de Vezes Assistido */}
                {isLive ? (
                  <span className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-full bg-rose-600/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    AO VIVO
                  </span>
                ) : item.watchCount > 1 ? (
                  <span className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-full border border-amber-400/40 bg-black/80 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300 backdrop-blur-md shadow-lg">
                    <Sparkles className="h-3 w-3 text-amber-400 fill-amber-400" />
                    Assistido {item.watchCount}x
                  </span>
                ) : null}

                {/* Barra de Progresso com % (SOMENTE para Filmes e Séries / VOD) */}
                {!isLive && (
                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2.5 pt-6">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white mb-1.5 drop-shadow-sm">
                      <span className="text-primary-light font-extrabold">{percent}% concluído</span>
                      {minutesLeft && <span className="text-white/80">{minutesLeft}</span>}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-violet-500 to-indigo-400 shadow-[0_0_10px_rgba(108,29,255,0.9)] transition-all duration-300"
                        style={{ width: `${Math.max(4, percent)}%` }}
                      />
                    </div>
                  </div>
                )}
              </Link>

              {/* Nome do Conteúdo */}
              <div className="px-0.5">
                <h3 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {item.cleanName}
                </h3>
              </div>
            </div>
          );
        })}
      </Rail>
    </section>
  );
}
