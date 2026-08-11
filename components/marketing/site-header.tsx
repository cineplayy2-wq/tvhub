"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  // Header transparente sobre o hero; ganha fundo ao rolar para não sumir na arte
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300 ease-smooth",
        scrolled
          ? "border-b border-border bg-background/85 backdrop-blur-lg"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="HUBFLIX — início">
          <Logo />
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="#planos"
            className="hidden px-3 py-2 text-sm text-muted transition-colors hover:text-foreground sm:block"
          >
            Planos
          </Link>
          <Link
            href="#perguntas"
            className="hidden px-3 py-2 text-sm text-muted transition-colors hover:text-foreground sm:block"
          >
            Dúvidas
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
          >
            Assinar
          </Link>
        </nav>
      </div>
    </header>
  );
}
