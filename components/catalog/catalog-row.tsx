"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { TitleCard } from "@/components/catalog/title-card";
import { cn } from "@/lib/utils";
import type { TitleCard as TitleCardData, TitleCardWithProgress } from "@/types";

/**
 * Trilha horizontal.
 *
 * Rolagem nativa (scroll-snap) em vez de transform controlado por JS: o dedo
 * no celular e o trackpad no desktop já funcionam de graça, e o teclado
 * também. Os botões só empurram a mesma rolagem — não são o mecanismo.
 */
export function CatalogRow({
  title,
  items,
}: {
  title: string;
  items: (TitleCardData | TitleCardWithProgress)[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  if (items.length === 0) return null;

  function updateEdges() {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 8);
    // -8 de folga: arredondamento subpixel impede o valor exato
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }

  function scrollBy(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    // 85% da largura visível: sempre sobra um card do lote anterior à vista,
    // o que dá continuidade em vez de sensação de página trocada
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <section className="group/row relative">
      <h2 className="mb-3 px-5 text-base font-medium tracking-display text-foreground sm:px-10">
        {title}
      </h2>

      <div className="relative">
        <div
          ref={trackRef}
          onScroll={updateEdges}
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:px-10"
        >
          {items.map((item) => (
            <TitleCard
              key={item.id}
              item={item}
              className="w-[38vw] max-w-[190px] snap-start sm:w-[190px]"
            />
          ))}
        </div>

        {/* Setas: aparecem no hover e somem nas pontas. Em touch, não aparecem
            porque hover não existe — e lá a rolagem por dedo já resolve. */}
        {[-1, 1].map((direction) => {
          const isLeft = direction === -1;
          const hidden = isLeft ? atStart : atEnd;

          return (
            <button
              key={direction}
              type="button"
              onClick={() => scrollBy(direction as 1 | -1)}
              aria-label={isLeft ? "Anterior" : "Próximo"}
              tabIndex={-1}
              className={cn(
                "absolute top-0 z-10 hidden h-[calc(100%-0.5rem)] w-10 items-center justify-center",
                "bg-background/70 text-foreground backdrop-blur-sm transition-opacity duration-200",
                "opacity-0 group-hover/row:opacity-100 hover:bg-background/90 sm:flex",
                isLeft ? "left-0" : "right-0",
                hidden && "pointer-events-none !opacity-0",
              )}
            >
              {isLeft ? (
                <ChevronLeft className="h-5 w-5" aria-hidden />
              ) : (
                <ChevronRight className="h-5 w-5" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
