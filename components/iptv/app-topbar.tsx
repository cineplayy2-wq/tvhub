"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Barra superior, conforme o protótipo.
 *
 * Estrutura fixa: marca (só o "H", 34px) + NOME DA CATEGORIA + ícones de ação
 * + busca em círculo destacado. O nome da aba fica no cabeçalho, não em um
 * título dentro da página — foi o que o protótipo definiu e é o que evita
 * repetir a mesma palavra duas vezes na tela.
 *
 * Transparente no topo e opaca ao rolar: sobre o hero a arte precisa aparecer
 * inteira; assim que o conteúdo sobe, a barra ganha fundo para o texto não
 * disputar contraste com o pôster que passa por baixo.
 */

/** Título por rota — precisa casar com as abas da barra inferior. */
const TITLES: Array<{ prefix: string; title: string; exact?: boolean }> = [
  { prefix: "/tv", title: "Filmes e séries", exact: true },
  { prefix: "/tv/movies", title: "Filmes" },
  { prefix: "/tv/series", title: "Séries" },
  { prefix: "/tv/serie", title: "Séries" },
  { prefix: "/tv/kids", title: "Infantil" },
  { prefix: "/tv/live", title: "Canais" },
  { prefix: "/tv/sports", title: "Esportes" },
  { prefix: "/tv/novelas", title: "Novelas" },
  { prefix: "/tv/dicas", title: "Dicas" },
  { prefix: "/tv/busca", title: "Buscar" },
];

function titleFor(pathname: string) {
  let best = "Filmes e séries";
  let bestLength = -1;

  for (const entry of TITLES) {
    const hit = entry.exact
      ? pathname === entry.prefix
      : pathname.startsWith(entry.prefix);
    if (hit && entry.prefix.length > bestLength) {
      best = entry.title;
      bestLength = entry.prefix.length;
    }
  }

  return best;
}

/** Marca do app ("H"), 34×34. Maior que o rótulo da categoria de propósito. */
function Mark() {
  return (
    <span className="mr-1.5 grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-[#8A2BE2] to-[#4A0FB0]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.png" alt="HUBFLIX" className="h-full w-full object-cover" />
    </span>
  );
}

function IconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "grid h-[33px] w-[33px] shrink-0 place-items-center rounded-full opacity-90",
        "transition-opacity hover:opacity-100 active:scale-95",
        "[&_svg]:h-[19px] [&_svg]:w-[19px] [&_svg]:fill-none [&_svg]:stroke-current",
        "[&_svg]:stroke-[1.7] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
      )}
    >
      {children}
    </Link>
  );
}

export function AppTopbar() {
  const pathname = usePathname();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname.includes("/assistir/")) return null;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 px-5 pt-[calc(env(safe-area-inset-top)+10px)]",
        "transition-[background-color,backdrop-filter] duration-300",
        stuck
          ? "bg-background/[0.62] supports-[backdrop-filter]:backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150"
          : "bg-transparent",
      )}
    >
      {/* Véu superior: garante leitura dos ícones sobre arte clara */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-[22px] top-0 -z-10 bg-gradient-to-b from-[rgba(4,5,9,.78)] via-[rgba(4,5,9,.35)] to-transparent"
      />

      <div className="flex h-11 items-center gap-[7px]">
        <Link href="/tv" aria-label="HUBFLIX — início" className="flex items-center">
          <Mark />
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-[-0.028em] text-foreground">
          {titleFor(pathname)}
        </h1>

        <IconButton href="/tv/dispositivos" label="Transmitir">
          <svg viewBox="0 0 24 24">
            <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
          </svg>
        </IconButton>

        <IconButton href="/tv/busca?favoritos=true" label="Minha lista">
          <svg viewBox="0 0 24 24">
            <path d="M6 3.8h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.8a1 1 0 0 1 1-1z" />
          </svg>
        </IconButton>

        <IconButton href="/tv/reportar" label="Reportar problema">
          <svg viewBox="0 0 24 24">
            <path d="M12 4.2 21.2 20H2.8z" />
            <path d="M12 10v4M12 17.2v.1" />
          </svg>
        </IconButton>

        <Link
          href="/tv/busca"
          aria-label="Buscar"
          className={cn(
            "ml-0.5 grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full",
            "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.22)]",
            "transition-transform active:scale-[0.92]",
            "[&_svg]:h-[19px] [&_svg]:w-[19px] [&_svg]:fill-none [&_svg]:stroke-current",
            "[&_svg]:stroke-[2.1] [&_svg]:[stroke-linecap:round]",
          )}
        >
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
