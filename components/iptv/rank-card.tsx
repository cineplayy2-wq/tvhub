"use client";

import Link from "next/link";
import { Play } from "lucide-react";

import { Artwork } from "./artwork";
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

  return (
    <Link href={href} className="group flex flex-col">
      <div className="flex items-end">
        <span
          aria-hidden
          className="rank-numeral pointer-events-none min-w-[2.75rem] select-none text-center font-display text-[7rem] leading-[0.72] tracking-tightest md:min-w-[3.5rem] md:text-[9rem]"
        >
          {rank}
        </span>

        <div className="card-edge relative -ml-4 aspect-[2/3] w-[104px] shrink-0 overflow-hidden rounded-xl bg-surface transition-shadow duration-300 group-hover:ring-primary/50 group-hover:shadow-card md:-ml-6 md:w-[130px]">
          <Artwork src={art} alt={name} seed={item.id} sizes="(max-width: 768px) 104px, 130px" />

          <div className="absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-all duration-300 group-hover:bg-background/45 group-hover:opacity-100">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
            </span>
          </div>
        </div>
      </div>

      <p className="mt-2 w-[104px] self-end truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary md:w-[130px]">
        {name}
      </p>
    </Link>
  );
}
