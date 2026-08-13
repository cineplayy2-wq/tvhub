"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { telaAnterior } from "./nav-history";
import { cn } from "@/lib/utils";

/**
 * Voltar para onde a pessoa estava — não para a gaveta do conteúdo.
 *
 * A regra é uma só: se existe tela anterior DENTRO do app, volta no histórico
 * (assim a posição da rolagem e os filtros da lista são preservados pelo
 * navegador, coisa que um `push` para a mesma URL não faz). Se não existe —
 * link compartilhado, aba nova, recarga na própria tela de conteúdo —, cai no
 * destino de reserva, que nunca é lugar nenhum.
 *
 * O rótulo diz para onde vai quando dá para saber. "Voltar para Início" evita
 * a hesitação de um "Voltar" que não promete nada.
 */

/** Nome legível de uma rota, para o rótulo do botão. */
function rotuloDe(rota: string | null): string | null {
  if (!rota) return null;
  const limpa = rota.split("?")[0];

  const MAPA: Array<[string, string]> = [
    ["/tv/movies", "Filmes"],
    ["/tv/series", "Séries"],
    ["/tv/serie", "Séries"],
    ["/tv/live", "Canais"],
    ["/tv/sports", "Esportes"],
    ["/tv/novelas", "Novelas"],
    ["/tv/kids", "Infantil"],
    ["/tv/busca", "Busca"],
    ["/tv/dicas", "Dicas"],
  ];

  for (const [prefixo, nome] of MAPA) {
    if (limpa.startsWith(prefixo)) return nome;
  }
  if (limpa === "/tv") return "Início";
  return null;
}

export function BackButton({
  fallbackHref = "/tv",
  className,
}: {
  /** Para onde ir quando não há tela anterior no app. */
  fallbackHref?: string;
  className?: string;
}) {
  const router = useRouter();
  const [anterior, setAnterior] = useState<string | null>(null);

  // Só depois de montar: `sessionStorage` não existe no servidor, e ler no
  // primeiro render faria o HTML do servidor divergir do cliente.
  useEffect(() => setAnterior(telaAnterior()), []);

  const voltar = () => {
    if (anterior) router.back();
    else router.push(fallbackHref);
  };

  const destino = rotuloDe(anterior ?? fallbackHref);

  return (
    <button
      type="button"
      onClick={voltar}
      className={cn(
        "flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white/90",
        "shadow-lg backdrop-blur-md transition-colors hover:bg-black/90 hover:text-white",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {destino ? `Voltar para ${destino}` : "Voltar"}
    </button>
  );
}
