"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { observeResize } from "@/lib/playback/observe";
import { cn } from "@/lib/utils";

/**
 * Barra de navegação flutuante, conforme o protótipo.
 *
 * O realce é um "blob" único que desliza até a aba ativa, em vez de um fundo
 * por botão que acende e apaga. Isso dá continuidade ao movimento: o olho
 * segue um objeto que se move, não cinco que piscam.
 *
 * A posição é medida no DOM (não calculada por índice) porque os rótulos têm
 * larguras diferentes — "Filmes e séries" contra "Dicas" — e qualquer conta
 * fixa erraria o alinhamento.
 */

type Tab = {
  href: string;
  label: string;
  /** Prefixos de rota que mantêm esta aba acesa. */
  match: string[];
  icon: React.ReactNode;
};

const TABS: Tab[] = [
  {
    href: "/tv",
    label: "Filmes\ne séries",
    match: ["/tv", "/tv/movies", "/tv/series", "/tv/serie", "/tv/kids"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="M10 9.5l5 2.5-5 2.5z" />
      </svg>
    ),
  },
  {
    href: "/tv/live",
    label: "Canais",
    match: ["/tv/live"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="2.5" y="6.5" width="19" height="13" rx="3" />
        <path d="M8 3l4 3.5L16 3" />
      </svg>
    ),
  },
  {
    href: "/tv/sports",
    label: "Esportes",
    match: ["/tv/sports"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v6m0 6v6M4 8l5 3m6 2 5 3M4 16l5-3m6-2 5-3" />
      </svg>
    ),
  },
  {
    href: "/tv/novelas",
    label: "Novelas",
    match: ["/tv/novelas"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 5h7a3 3 0 0 1 3 3v11a2.5 2.5 0 0 0-2.5-2.5H4zM20 5h-3a3 3 0 0 0-3 3v11a2.5 2.5 0 0 1 2.5-2.5H20z" />
      </svg>
    ),
  },
  {
    href: "/tv/dicas",
    label: "Dicas",
    match: ["/tv/dicas"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3.2l2.1 5.1 5.4.4-4.1 3.6 1.3 5.3L12 14.8l-4.7 2.8 1.3-5.3-4.1-3.6 5.4-.4z" />
      </svg>
    ),
  },
];

function activeIndex(pathname: string) {
  // O mais específico ganha: /tv/live não pode acender a aba /tv
  let best = 0;
  let bestLength = -1;

  TABS.forEach((tab, index) => {
    for (const prefix of tab.match) {
      const hit = prefix === "/tv" ? pathname === "/tv" : pathname.startsWith(prefix);
      if (hit && prefix.length > bestLength) {
        best = index;
        bestLength = prefix.length;
      }
    }
  });

  return best;
}

export function TabBar() {
  const pathname = usePathname();
  const active = activeIndex(pathname);

  const listRef = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const move = () => {
      const item = list.children[active + 1] as HTMLElement | undefined; // +1: o blob é o primeiro filho
      if (!item) return;
      setBlob({ left: item.offsetLeft, width: item.offsetWidth });
    };

    move();
    return observeResize(list, move);
  }, [active]);

  // No player a barra sai de cena: o vídeo ocupa a tela inteira
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(pathname.includes("/assistir/")), [pathname]);
  if (hidden) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "fixed left-1/2 z-40 h-16 w-[min(372px,calc(100%-26px))] -translate-x-1/2",
        "bottom-[calc(env(safe-area-inset-bottom)+18px)]",
        "rounded-full border border-white/[0.08] bg-surface/90 px-1.5 shadow-card",
        "supports-[backdrop-filter]:bg-surface/70 supports-[backdrop-filter]:backdrop-blur-xl",
        "md:hidden",
      )}
    >
      <div ref={listRef} className="relative flex h-full items-center">
        <span
          aria-hidden
          className="absolute top-2 h-12 rounded-full bg-primary/25 ring-1 ring-inset ring-primary/40 transition-[transform,width] duration-500 ease-smooth"
          style={
            blob
              ? { transform: `translateX(${blob.left}px)`, width: blob.width }
              : { opacity: 0 }
          }
        />

        {TABS.map((tab, index) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={index === active ? "page" : undefined}
            className={cn(
              "relative z-10 flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-[3px]",
              "text-[9.5px] font-semibold leading-tight transition-colors duration-300",
              index === active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="[&_svg]:h-5 [&_svg]:w-5 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
              {tab.icon}
            </span>
            <span className="whitespace-pre text-center">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
