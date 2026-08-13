"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, PanelLeft, Search, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Menu lateral do desktop e da TV.
 *
 * É a mesma taxonomia da barra de baixo do celular, girada 90°. Em tela larga
 * a barra inferior desperdiça a lateral e obriga o olho a atravessar a tela
 * inteira; e em TV, com controle remoto, navegar para baixo em uma coluna é o
 * gesto natural do direcional.
 *
 * Dois estados: recolhido (72px, só ícone) e expandido (240px, ícone +
 * rótulo). Expande no foco também, não só no clique — em TV o usuário não
 * clica, ele navega, e o menu precisa se abrir quando o foco chega nele.
 */

type Item = { href: string; label: string; match: string[]; icon: React.ReactNode };

const ITEMS: Item[] = [
  {
    href: "/tv",
    label: "Filmes e séries",
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

/**
 * Rótulo que só aparece com o menu aberto.
 *
 * Fica sempre no DOM (não é montado/desmontado): assim o leitor de tela
 * anuncia o nome do item mesmo com o menu recolhido, e a abertura por CSS
 * não depende de re-render.
 */
const LABEL =
  "truncate opacity-0 transition-opacity duration-200 " +
  "group-hover/nav:opacity-100 group-focus-within/nav:opacity-100 " +
  "group-data-[pinned]/nav:opacity-100";

function isActive(pathname: string, item: Item) {
  return item.match.some((prefix) =>
    prefix === "/tv" ? pathname === "/tv" : pathname.startsWith(prefix),
  );
}

export function SideNav({
  avatarUrl,
  profileName,
}: {
  /** Foto do perfil ativo, resolvida no servidor pelo layout. */
  avatarUrl?: string | null;
  profileName?: string | null;
}) {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);

  if (pathname.includes("/assistir/")) return null;

  return (
    <aside
      data-pinned={pinned || undefined}
      className={cn(
        "group/nav fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-white/[0.10] md:flex",
        // Um plano acima do fundo, não o próprio fundo: em `bg-background` a
        // coluna não tinha onde começar e o menu se confundia com a página.
        "bg-surface/95 supports-[backdrop-filter]:bg-surface/75 supports-[backdrop-filter]:backdrop-blur-xl",
        // Abre por CSS, não por estado do React: `focus-within` é o que faz o
        // menu se abrir quando o foco do controle remoto chega nele, e
        // funciona mesmo onde os eventos sintéticos do React falham — que é
        // exatamente o navegador de TV antiga.
        "w-[72px] transition-[width] duration-300 ease-smooth",
        "hover:w-60 focus-within:w-60 data-[pinned]:w-60",
      )}
    >
      {/* Marca */}
      <div className="flex h-20 items-center gap-3 px-4">
        <Link href="/tv" aria-label="HUBFLIX — início" className="shrink-0">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-[12px] bg-gradient-to-br from-[#8F37B4] to-[#4E1566]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark.png" alt="HUBFLIX" className="h-full w-full object-cover" />
          </span>
        </Link>
        <span className={LABEL + " text-lg font-extrabold tracking-tight text-foreground"}>
          HUBFLIX
        </span>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex h-12 items-center gap-3 rounded-xl px-3 transition-colors",
                // Alvo de 48px: distância de TV pede área grande
                active
                  ? "bg-primary/20 text-foreground ring-1 ring-inset ring-primary/40"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
              )}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center [&_svg]:h-[22px] [&_svg]:w-[22px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
                {item.icon}
              </span>
              <span className={LABEL + " text-[15px] font-semibold"}>{item.label}</span>
            </Link>
          );
        })}

        <div className="my-3 h-px bg-white/[0.06]" />

        <Link
          href="/tv/busca"
          title="Buscar"
          className="flex h-12 items-center gap-3 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center">
            <Search className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </span>
          <span className={LABEL + " text-[15px] font-semibold"}>Buscar</span>
        </Link>

        <Link
          href="/tv/busca?favoritos=true"
          title="Favoritos"
          className="flex h-12 items-center gap-3 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center">
            <Heart className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </span>
          <span className={LABEL + " text-[15px] font-semibold"}>Favoritos</span>
        </Link>

        {/* Trocar de perfil. Também tinha sumido na reconstrução do menu — e
            sem esta porta não havia como sair de um perfil infantil. */}
        <Link
          href="/perfis"
          title={profileName ? `Perfil de ${profileName} — trocar` : "Trocar perfil"}
          className="flex h-12 items-center gap-3 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt=""
                className="h-[26px] w-[26px] rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <UserRound className="h-[22px] w-[22px]" strokeWidth={1.8} />
            )}
          </span>
          <span className={LABEL + " truncate text-[15px] font-semibold"}>
            {profileName ?? "Trocar perfil"}
          </span>
        </Link>
      </nav>

      <button
        type="button"
        onClick={() => setPinned((value) => !value)}
        aria-label={pinned ? "Recolher menu" : "Fixar menu aberto"}
        aria-pressed={pinned}
        className="m-3 flex h-11 items-center gap-3 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center">
          <PanelLeft className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <span className={LABEL + " text-[14px] font-medium"}>{pinned ? "Recolher" : "Fixar"}</span>
      </button>
    </aside>
  );
}
