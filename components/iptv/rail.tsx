"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { observeResize } from "@/lib/playback/observe";
import { cn } from "@/lib/utils";

/**
 * Trilha horizontal genérica.
 *
 * Havia três implementações de carrossel na área logada, cada uma com um
 * espaçamento e um botão diferente. Esta é a única: recebe os cards prontos
 * como filhos e cuida só do movimento.
 *
 * As setas aparecem no hover e somem quando a trilha chega ao fim — botão
 * que não faz nada é ruído. No toque não há seta: o dedo já rola.
 */
export function Rail({
  children,
  className,
  itemClassName,
}: {
  children: React.ReactNode;
  className?: string;
  /** Largura de cada item; use o mesmo valor da grade da página. */
  itemClassName?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncEdges = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setAtStart(node.scrollLeft <= 8);
    setAtEnd(node.scrollLeft >= max - 8);
  }, []);

  useEffect(() => {
    syncEdges();
    const node = scrollRef.current;
    if (!node) return;
    return observeResize(node, syncEdges);
  }, [syncEdges]);

  const scroll = (direction: "left" | "right") => {
    const node = scrollRef.current;
    if (!node) return;
    // 85% da largura visível: sempre sobra um card de referência na tela,
    // então o usuário não perde o fio ao avançar.
    const amount = node.clientWidth * 0.85;
    node.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className={cn("group/rail defer-paint relative", className)}>
      <div
        ref={scrollRef}
        onScroll={syncEdges}
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 md:gap-4 md:px-8 lg:px-12"
      >
        {Array.isArray(children)
          ? children.map((child, index) => (
              <div
                key={index}
                className={cn("shrink-0 snap-start", itemClassName)}
              >
                {child}
              </div>
            ))
          : children}
      </div>

      <RailButton
        side="left"
        hidden={atStart}
        onClick={() => scroll("left")}
      />
      <RailButton side="right" hidden={atEnd} onClick={() => scroll("right")} />
    </div>
  );
}

function RailButton({
  side,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  if (hidden) return null;

  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Anterior" : "Próximo"}
      className={cn(
        "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full",
        "border border-white/10 bg-background/90 text-foreground shadow-lg",
        "opacity-0 transition-all duration-200 hover:bg-surface-elevated",
        "group-hover/rail:opacity-100 focus-visible:opacity-100 md:flex",
        side === "left" ? "left-2 lg:left-4" : "right-2 lg:right-4",
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}
