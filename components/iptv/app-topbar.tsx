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
    <span className="mr-1.5 grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-[#8F37B4] to-[#4E1566]">
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

export function AppTopbar({
  avatarUrl,
  profileName,
}: {
  /** Foto do perfil ativo, resolvida no servidor pelo layout. */
  avatarUrl?: string | null;
  profileName?: string | null;
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
        <Link href="/tv" aria-label="HUBFLIX — início" className="flex items-center">
          <Mark />
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-[-0.028em] text-foreground">
          {titleFor(pathname)}
        </h1>

        {/* "Transmitir" e "Reportar" saíram: apontavam para /tv/dispositivos e
            /tv/reportar, rotas que não existem — os dois caíam em 404. No lugar
            entra o acesso ao perfil, que estava faltando e é o que permite sair
            de um perfil infantil. */}
        {/* Favoritos com Coração */}
        <IconButton href="/tv/busca?favoritos=true" label="Favoritos">
          <svg viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </IconButton>

        {/* Busca ao lado dos Favoritos */}
        <Link
          href="/tv/busca"
          aria-label="Buscar"
          className={cn(
            "grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full",
            "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.22)]",
            "transition-transform active:scale-[0.92]",
            "[&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:fill-none [&_svg]:stroke-current",
            "[&_svg]:stroke-[2.1] [&_svg]:[stroke-linecap:round]",
          )}
        >
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
        </Link>

        {/* Perfil bem à direita: a FOTO, não o círculo roxo com o boneco
            genérico. É por ela que se sabe, de relance, em qual perfil o
            aparelho está — que é a única pergunta que este botão responde. */}
        <Link
          href="/perfis"
          aria-label={profileName ? `Perfil de ${profileName} — trocar` : "Trocar perfil"}
          className="ml-1 flex h-[34px] w-[34px] shrink-0 overflow-hidden rounded-full shadow-md ring-2 ring-white/25 transition-transform active:scale-95"
        >
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt={profileName ?? "Perfil"}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center bg-surface-elevated text-white">
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.8]"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="3.6" />
                <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
              </svg>
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
