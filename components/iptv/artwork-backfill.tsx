"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Dispara o preenchimento das capas depois que a tela já pintou.
 *
 * Não renderiza nada. A única razão de existir é tirar a busca no TMDB do
 * caminho crítico: quem abre a home vê a home, e a arte que falta é resolvida
 * atrás, um lote por vez.
 *
 * Três cuidados que o formato exige:
 *
 * - Só começa depois do primeiro quadro (`requestIdleCallback` quando existe).
 *   Competir com a renderização inicial num celular fraco atrasaria justamente
 *   o que o usuário está esperando.
 * - Para no primeiro lote vazio ou no primeiro erro. Um laço que insiste em
 *   endpoint quebrado vira martelo contra o próprio servidor.
 * - `router.refresh()` uma vez ao final, não a cada lote: cada refresh é uma
 *   renderização do servidor inteira, e chamar a cada 20 itens transformaria a
 *   melhoria de imagem numa tempestade de requisições.
 */

/** Teto de lotes por visita. 6 x 20 = 120 títulos, o bastante para uma sessão. */
const MAX_LOTES = 6;

export function ArtworkBackfill() {
  const router = useRouter();
  const jaRodou = useRef(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;

    let vivo = true;
    let preencheuAlgo = false;

    const rodar = async () => {
      for (let lote = 0; lote < MAX_LOTES; lote++) {
        if (!vivo) return;

        try {
          const resposta = await fetch("/api/iptv/artwork", { method: "POST" });
          if (!resposta.ok) return;

          const { processados, restantes } = (await resposta.json()) as {
            processados: number;
            restantes: number;
          };

          if (processados > 0) preencheuAlgo = true;
          if (processados === 0 || restantes === 0) break;
        } catch {
          return;
        }
      }

      // Só vale reconstruir a página se alguma capa realmente entrou.
      if (vivo && preencheuAlgo) router.refresh();
    };

    const agendar =
      typeof window.requestIdleCallback === "function"
        ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 4000 })
        : (fn: () => void) => window.setTimeout(fn, 1500);

    const id = agendar(() => void rodar());

    return () => {
      vivo = false;
      if (typeof window.cancelIdleCallback === "function") {
        try {
          window.cancelIdleCallback(id as number);
        } catch {}
      } else {
        clearTimeout(id as number);
      }
    };
  }, [router]);

  return null;
}
