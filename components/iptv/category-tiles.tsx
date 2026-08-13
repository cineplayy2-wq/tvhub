"use client";

import Link from "next/link";
import {
  Baby,
  Clapperboard,
  Film,
  Landmark,
  Music4,
  Newspaper,
  Radio,
  Sparkles,
  Trophy,
  Tv,
  type LucideIcon,
} from "lucide-react";

import { Rail } from "./rail";
import { CATEGORY_LABELS } from "@/lib/iptv/category-detector";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  live: Radio,
  sports: Trophy,
  news: Newspaper,
  kids: Baby,
  movies: Film,
  series: Tv,
  documentaries: Clapperboard,
  music: Music4,
  entertainment: Sparkles,
  religious: Landmark,
};

/**
 * Navegação por categoria.
 *
 * Antes era uma fileira de pílulas de texto — funcional e completamente
 * invisível. Aqui cada categoria mostra os logos dos canais que ela contém:
 * a pessoa reconhece "esportes" pela marca do canal antes de ler a palavra,
 * e a página deixa de parecer um menu para parecer um catálogo.
 */
export function CategoryTiles({
  items,
  active,
}: {
  items: Array<{ category: string; count: number; logos: string[] }>;
  active: string | null;
}) {
  if (items.length === 0) return null;

  return (
    <Rail itemClassName="w-[152px] md:w-[176px]">
      {[{ category: "", count: 0, logos: [] }, ...items].map((item) => {
        const isAll = item.category === "";
        const isActive = isAll ? !active : active === item.category;
        const Icon = ICONS[item.category] ?? Radio;
        const label = isAll
          ? "Todos"
          : CATEGORY_LABELS[item.category] ?? item.category;

        return (
          <Link
            key={item.category || "all"}
            href={isAll ? "/tv/live" : `/tv/live?cat=${item.category}`}
            className={cn(
              "group relative flex h-[104px] flex-col justify-between overflow-hidden rounded-xl p-3 transition-all duration-300",
              "card-edge bg-surface hover:bg-surface-hover",
              isActive && "ring-primary/70 bg-surface-hover",
            )}
          >
            {/* Mosaico de logos ao fundo, bem discreto: dá cor e contexto
                sem competir com o rótulo, que é o que precisa ser clicado. */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-2 opacity-[0.16] transition-opacity duration-300 group-hover:opacity-25">
              {item.logos.slice(0, 4).map((logo, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${logo}-${index}`}
                  src={logo}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="h-full w-full object-contain p-2"
                />
              ))}
            </div>

            <span
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/[0.06] text-accent",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>

            <span className="relative">
              <span className="block truncate text-sm font-semibold text-foreground">
                {label}
              </span>
              {!isAll && (
                <span className="block text-[11px] tabular-nums text-muted-foreground">
                  {item.count.toLocaleString("pt-BR")} canais
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </Rail>
  );
}
