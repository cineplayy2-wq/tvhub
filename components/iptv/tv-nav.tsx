"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, Cast, Heart, Search, Sparkles } from "lucide-react";

import { LogoHMark } from "@/components/shared/logo";
import { UserProfileMenu } from "@/components/profile/user-profile-menu";
import { CastModal } from "./cast-modal";
import { ReportModal } from "./report-modal";
import type { ProfileSummary } from "@/types";
import { cn } from "@/lib/utils";

const STANDARD_LINKS = [
  { href: "/tv", label: "Filmes e Séries" },
  { href: "/tv/live", label: "Canais" },
  { href: "/tv/sports", label: "Esportes" },
  { href: "/tv/novelas", label: "Novelas" },
  { href: "/tv/dicas", label: "Dicas" },
];

const KIDS_LINKS = [
  { href: "/tv/kids", label: "Catálogo Infantil" },
  { href: "/tv/dicas", label: "Dicas" },
];

function getCategoryTitle(pathname: string, isKids: boolean): string {
  if (isKids) return "Espaço Kids";
  if (pathname === "/tv") return "Filmes e Séries";
  if (pathname.startsWith("/tv/live")) return "Canais Ao Vivo";
  if (pathname.startsWith("/tv/movies")) return "Filmes";
  if (pathname.startsWith("/tv/series") || pathname.startsWith("/tv/serie")) return "Séries";
  if (pathname.startsWith("/tv/sports")) return "Esportes";
  if (pathname.startsWith("/tv/novelas")) return "Novelas";
  if (pathname.startsWith("/tv/kids")) return "Kids";
  if (pathname.startsWith("/tv/dicas")) return "Dicas";
  if (pathname.startsWith("/tv/busca")) return "Busca";
  return "Filmes e Séries";
}

export function TvNav({
  user,
  profiles = [],
  activeProfile = null,
}: {
  user?: { email?: string | null; name?: string | null; role?: string } | null;
  profiles?: ProfileSummary[];
  activeProfile?: ProfileSummary | null;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [castOpen, setCastOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isKidsProfile = Boolean(activeProfile?.isKids);
  const navLinks = isKidsProfile ? KIDS_LINKS : STANDARD_LINKS;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const categoryTitle = getCategoryTitle(pathname, isKidsProfile);

  const isActive = (href: string) =>
    href === "/tv"
      ? pathname === "/tv" || pathname.startsWith("/tv/movies") || pathname.startsWith("/tv/series")
      : pathname.startsWith(href);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-all duration-300",
          scrolled
            ? "glass border-b border-white/[0.08] bg-background/90 shadow-lg backdrop-blur-xl"
            : "border-b border-transparent bg-gradient-to-b from-black/80 via-black/40 to-transparent",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-8 lg:px-12">
          {/* Logo H + Categoria ao lado */}
          <Link href={isKidsProfile ? "/tv/kids" : "/tv"} className="flex items-center gap-3 shrink-0 group">
            <LogoHMark className="transition-transform duration-300 group-hover:scale-105" />
            <div className="flex items-center gap-2.5">
              <span className="h-4 w-[1px] bg-white/20" />
              <span className="text-sm font-extrabold tracking-tight text-foreground transition-colors group-hover:text-accent flex items-center gap-1.5">
                {isKidsProfile && <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />}
                {categoryTitle}
              </span>
            </div>
          </Link>

          {/* Links de navegação desktop */}
          <nav className="scrollbar-none hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto md:flex lg:gap-2">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative shrink-0 px-3 py-2 text-sm transition-colors duration-200",
                    active
                      ? "font-bold text-foreground"
                      : "font-medium text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                  {active && (
                    <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary shadow-[0_0_8px_rgba(124,42,158,0.8)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Botões de Ação na Lateral + Bolinha do Perfil */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Transmitir para TV */}
            <button
              type="button"
              onClick={() => setCastOpen(true)}
              aria-label="Transmitir para TV"
              title="Transmitir para TV (Chromecast / AirPlay)"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-surface/80 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              <Cast className="h-4 w-4" />
            </button>

            {/* Relatar Problema */}
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              aria-label="Reportar problema"
              title="Reportar travamento ou problema"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-surface/80 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-rose-400"
            >
              <AlertCircle className="h-4 w-4" />
            </button>

            {/* Favoritos */}
            <Link
              href="/minha-lista"
              aria-label="Favoritos"
              title="Favoritos"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-surface/80 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              <Heart className="h-4 w-4" />
            </Link>

            {/* Busca */}
            <Link
              href="/tv/busca"
              aria-label="Buscar conteúdo"
              title="Buscar Filmes, Séries e Canais"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-surface/80 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </Link>

            {/* Bolinha do Perfil do Cliente */}
            <UserProfileMenu user={user} profiles={profiles} activeProfile={activeProfile} />
          </div>
        </div>
      </header>

      {/* Modais de Suporte */}
      <CastModal open={castOpen} onClose={() => setCastOpen(false)} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  );
}
