"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserProfileMenu } from "@/components/profile/user-profile-menu";
import { LogoHMark } from "@/components/shared/logo";
import type { ProfileSummary } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Barra superior, conforme o protótipo.
 *
 * Estrutura: marca + título da categoria à esquerda; coração, lupa e avatar do
 * perfil à direita. Transparente no topo e opaca ao rolar.
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

function IconButton({
  href,
  label,
  children,
  className,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  className?: string;
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
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function AppTopbar({
  user,
  profiles = [],
  activeProfile = null,
}: {
  user?: { email?: string | null; name?: string | null; role?: string } | null;
  profiles?: ProfileSummary[];
  activeProfile?: ProfileSummary | null;
}) {
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
        {/* Marca à esquerda, com o título da categoria ao lado */}
        <Link href="/tv" aria-label="HUBFLIX — início" className="shrink-0">
          <LogoHMark />
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-[-0.028em] text-foreground">
          {titleFor(pathname)}
        </h1>

        {/* Coração — Minha lista / favoritos IPTV */}
        <IconButton href="/tv/busca?favoritos=true" label="Minha lista">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 20.4 4.6 13A4.9 4.9 0 0 1 12 5.7 4.9 4.9 0 0 1 19.4 13z" />
          </svg>
        </IconButton>

        {/* Lupa colada no perfil, os dois na ponta direita */}
        <Link
          href="/tv/busca"
          aria-label="Buscar"
          className={cn(
            "grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full",
            "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.22)]",
            "transition-transform active:scale-[0.92]",
            "[&_svg]:h-[19px] [&_svg]:w-[19px] [&_svg]:fill-none [&_svg]:stroke-current",
            "[&_svg]:stroke-[2.1] [&_svg]:[stroke-linecap:round]",
          )}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
        </Link>

        <div className="shrink-0">
          <UserProfileMenu
            user={user}
            profiles={profiles}
            activeProfile={activeProfile}
          />
        </div>
      </div>
    </header>
  );
}
