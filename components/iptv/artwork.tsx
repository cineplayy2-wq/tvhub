"use client";

import { useState } from "react";

import { useDeviceTier } from "./device-tier-provider";
import { cn, tmdbSrcSet } from "@/lib/utils";

/**
 * Arte de um item, com fallback tipográfico.
 *
 * Logo de lista IPTV quebra o tempo todo — host fora do ar, hotlink barrado,
 * URL morta. O código antigo escondia a `<img>` no erro e deixava um retângulo
 * vazio, que parece bug. Aqui o nome vira a arte: nunca há buraco na grade.
 *
 * Não usa `next/image` de propósito, por dois motivos: as artes vêm de
 * domínios arbitrários da lista do assinante, que não dá para declarar em
 * `remotePatterns`; e o otimizador de imagem consome CPU do servidor, que
 * nesta VPS é o recurso mais escasso. Para o TMDB, o próprio CDN já entrega
 * várias larguras — é o que o `srcset` abaixo aproveita.
 */

const TINTS = [
  "from-[#1E2A3A]",
  "from-[#2A1E3A]",
  "from-[#1E3A2C]",
  "from-[#3A2A1E]",
  "from-[#3A1E28]",
];

/** Mesmo item, mesmo gradiente sempre — aleatório destruiria o reconhecimento. */
function tintFor(seed: string) {
  let sum = 0;
  for (let index = 0; index < seed.length; index++) sum += seed.charCodeAt(index);
  return TINTS[sum % TINTS.length];
}

/** Larguras disponíveis no CDN do TMDB, por tipo de uso. */
const POSTER_WIDTHS = [185, 342, 500];
const BACKDROP_WIDTHS = [780, 1280];

export function Artwork({
  src,
  alt,
  seed,
  fit = "cover",
  className,
  eager = false,
  /** Papel da imagem: define as larguras oferecidas ao navegador. */
  role = "poster",
  /** Largura de exibição, para o navegador escolher o arquivo certo. */
  sizes,
}: {
  src: string | null | undefined;
  alt: string;
  /** Semente do gradiente do fallback — normalmente o id do canal. */
  seed: string;
  /** `contain` para logo de canal (PNG transparente), `cover` para pôster. */
  fit?: "cover" | "contain";
  className?: string;
  eager?: boolean;
  role?: "poster" | "backdrop";
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const { tier } = useDeviceTier();

  // Aparelho fraco não baixa nem decodifica capa: cai direto no cartão
  // tipográfico, que é só texto e pinta praticamente de graça.
  const showImage = Boolean(src) && !failed && tier !== "lite";

  const widths = role === "backdrop" ? BACKDROP_WIDTHS : POSTER_WIDTHS;
  const srcSet = tmdbSrcSet(src, widths);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {showImage ? (
        <img
          src={src as string}
          srcSet={srcSet}
          sizes={srcSet ? (sizes ?? (role === "backdrop" ? "100vw" : "180px")) : undefined}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          // `async` tira a decodificação do thread principal: em celular fraco
          // é o que evita o travamento ao rolar uma trilha cheia de pôsteres.
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full transition-transform duration-500 ease-smooth",
            fit === "cover" ? "object-cover" : "object-contain p-5",
          )}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-end bg-gradient-to-br to-background p-3",
            tintFor(seed),
          )}
        >
          <span className="line-clamp-3 text-[13px] font-semibold leading-tight tracking-tight text-foreground/90">
            {alt}
          </span>
        </div>
      )}
    </div>
  );
}
