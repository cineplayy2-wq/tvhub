"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

import { observeResize } from "@/lib/playback/observe";
import { cn } from "@/lib/utils";

export type PillItem = {
  label: string;
  href: string;
  active: boolean;
};

/**
 * Sub-navegação em pílulas, conforme o protótipo.
 *
 * Mesmo princípio da barra de abas: um realce que desliza, não vários que
 * acendem. Aqui o blob é sólido e o texto ativo inverte para escuro — é o
 * contraste mais forte da tela, porque esta linha é o filtro primário de
 * tudo que aparece abaixo.
 */
export function PillNav({ items, className }: { items: PillItem[]; className?: string }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = Math.max(0, items.findIndex((item) => item.active));

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const move = () => {
      const item = list.children[activeIndex + 1] as HTMLElement | undefined;
      if (!item) return;
      setBlob({ left: item.offsetLeft, width: item.offsetWidth });
      // Mantém a pílula ativa visível quando a linha rola
      item.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    move();
    return observeResize(list, move);
  }, [activeIndex, items.length]);

  if (items.length === 0) return null;

  return (
    <div className={cn("scrollbar-none overflow-x-auto", className)}>
      <div ref={listRef} className="relative flex w-max gap-2 py-2">
        <span
          aria-hidden
          className="absolute top-2 h-[38px] rounded-full bg-primary shadow-[0_4px_16px_-6px_rgba(108,29,255,.8)] transition-[transform,width] duration-500 ease-smooth"
          style={
            blob
              ? { transform: `translateX(${blob.left}px)`, width: blob.width }
              : { opacity: 0 }
          }
        />

        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "relative z-10 flex h-[38px] shrink-0 items-center whitespace-nowrap rounded-full px-4",
              "text-sm font-semibold tracking-[-0.01em] transition-colors duration-300",
              item.active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
