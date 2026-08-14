"use client";

import Link from "next/link";
import { Play } from "lucide-react";

import { Artwork } from "./artwork";
import { MediaKindTag } from "./media-kind-tag";
import { isSeriesItem } from "@/lib/iptv/media-kind";
import { cleanMediaTitle } from "@/lib/utils";
import type { PosterItem } from "./poster-card";

/**
 * Card numerado do Top 10.
 *
 * O número é vazado (só contorno), não um bloco branco gigante: marca a
 * posição sem roubar a leitura do pôster, que é o que a pessoa procura.
 *
 * O `min-w` no numeral existe por causa do "1": em fonte condensada o glifo é
 * estreito e, sem largura mínima, o pôster cobria quase toda a primeira
 * posição — justamente a que mais importa.
 */
export function RankCard({
  item,
  rank,
  href,
}: {
  item: PosterItem;
  rank: number;
  href: string;
}) {
  const name = cleanMediaTitle(item.name);
  const art = item.posterUrl ?? item.tmdbPosterUrl ?? item.logoUrl;
  const isSeries =
    item.isSeries ??
    isSeriesItem({
      streamUrl: item.streamUrl,
      name: item.name,
      category: item.group?.category,
    });

  return (
    <Link href={href} className="group flex flex-col">
      <div className="flex items-end">
        {/* O numeral é branco esmaecendo para cinza, não âmbar: o amarelo
            competia com a arte do pôster e não existia em lugar nenhum da
            marca. Em branco ele marca a posição e sai da frente. */}
        <span
          aria-hidden
          className="pointer-events-none min-w-[3.25rem] select-none text-center font-display text-[7.5rem] font-black leading-[0.7] tracking-tighter text-transparent bg-clip-text bg-gradient-to-t from-white/45 via-white/80 to-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] md:min-w-[4rem] md:text-[9.5rem] transition-transform duration-300 group-hover:scale-105"
        >
          {rank}
        </span>

        <div className="card-edge relative -ml-4 aspect-[2/3] w-[104px] shrink-0 overflow-hidden rounded-xl bg-surface transition-all duration-300 group-hover:ring-2 group-hover:ring-accent/70 group-hover:shadow-card md:-ml-6 md:w-[130px]">
          <Artwork src={art} alt={name} seed={item.id} sizes="(max-width: 768px) 104px, 130px" />

          {/* Badge TOP N na quina do pôster */}
          <MediaKindTag isSeries={isSeries} />

          <div className="absolute left-1.5 top-1.5 rounded-md bg-primary/90 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-primary-foreground shadow-md backdrop-blur-md">
            #{rank} TOP
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all duration-300 group-hover:bg-background/45 group-hover:opacity-100">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
            </span>
          </div>
        </div>
      </div>

      <p className="mt-2 w-[104px] self-end truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-accent md:w-[130px]">
        {name}
      </p>
    </Link>
  );
}
