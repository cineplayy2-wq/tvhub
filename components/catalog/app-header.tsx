"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { switchProfileAction } from "@/app/actions/profiles";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import type { ProfileSummary } from "@/types";

const NAV = [
  { href: "/tv", label: "Canais & IPTV" },
  { href: "/inicio", label: "Catálogo VOD" },
  { href: "/minha-lista", label: "Favoritos" },
];

export function AppHeader({
  profile,
  isAdmin,
}: {
  profile: ProfileSummary;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  // Transparente sobre o Hero, sólido ao rolar. Barra opaca desde o topo
  // rouba a parte mais bonita da arte em destaque.
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Trocar de página com o menu aberto deixaria o painel órfão na tela
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300 ease-smooth",
        scrolled
          ? "border-b border-border bg-background/90 backdrop-blur-lg"
          : "bg-gradient-to-b from-background/80 to-transparent",
      )}
    >
      <div className="flex h-16 items-center gap-6 px-5 sm:px-10">
        <Link href="/inicio" aria-label="HUBFLIX">
          <Logo size="sm" />
        </Link>

        <nav className="flex items-center gap-5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn(
                "text-sm transition-colors",
                pathname === item.href
                  ? "text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/busca"
            aria-label="Buscar"
            className="rounded p-2 text-muted transition-colors hover:text-foreground"
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-surface-hover"
            >
              <ProfileAvatar
                id={profile.id}
                name={profile.name}
                avatarUrl={profile.avatarUrl}
                isKids={profile.isKids}
                size="sm"
              />
            </button>

            {menuOpen && (
              <>
                {/* Camada de captura: fecha ao clicar em qualquer lugar fora,
                    sem precisar de listener global no document */}
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-0 cursor-default"
                />
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-10 w-52 animate-scale-in overflow-hidden rounded-lg border border-border bg-surface shadow-card"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {profile.name}
                    </p>
                    {profile.isKids && (
                      <p className="text-[11px] text-muted-foreground">
                        Perfil infantil
                      </p>
                    )}
                  </div>

                  <form action={switchProfileAction}>
                    <button
                      type="submit"
                      role="menuitem"
                      className="w-full px-4 py-2.5 text-left text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                      Trocar de perfil
                    </button>
                  </form>

                  <Link
                    href="/conta"
                    role="menuitem"
                    className="block px-4 py-2.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    Minha conta
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      role="menuitem"
                      className="block border-t border-border px-4 py-2.5 text-sm text-accent transition-colors hover:bg-surface-hover"
                    >
                      Painel administrativo
                    </Link>
                  )}

                  <form action={logoutAction}>
                    <button
                      type="submit"
                      role="menuitem"
                      className="w-full border-t border-border px-4 py-2.5 text-left text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                      Sair
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
