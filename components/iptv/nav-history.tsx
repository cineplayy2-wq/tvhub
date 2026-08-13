"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Memória de por onde a pessoa passou dentro do app.
 *
 * O "Voltar" das telas de conteúdo apontava para a CATEGORIA do item —
 * `/tv/${channel.group.slug}`. Quem chegava num filme pela Home era despejado
 * em "Filmes legendados", uma tela onde nunca esteve, e perdia a posição da
 * rolagem e o filtro que tinha escolhido.
 *
 * `router.back()` sozinho não resolve: numa aba nova, aberta direto no link do
 * conteúdo, não existe para onde voltar e o botão não faz nada — ou pior, joga
 * a pessoa para fora do site. Por isso a pilha vive aqui, no `sessionStorage`:
 * ela diz se existe uma tela ANTERIOR DENTRO DO APP, e é isso que decide entre
 * voltar de verdade e cair no destino de reserva.
 *
 * Fica no `sessionStorage` e não em memória porque recarregar a página no meio
 * do caminho não pode apagar o rastro.
 */

const CHAVE = "tvhub_nav";
/** Fundo do poço: o suficiente para o Voltar, sem virar histórico eterno. */
const MAX = 12;

/** Rotas que não são destino de retorno: voltar para o player é um laço. */
function ehDestinoValido(rota: string) {
  return !rota.includes("/assistir/") && !rota.startsWith("/perfis");
}

function lerPilha(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const cru = sessionStorage.getItem(CHAVE);
    return cru ? (JSON.parse(cru) as string[]) : [];
  } catch {
    return [];
  }
}

function gravarPilha(pilha: string[]) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(pilha.slice(-MAX)));
  } catch {}
}

/** Última tela do app que serve como retorno, ou `null` se não houver. */
export function telaAnterior(): string | null {
  const pilha = lerPilha();
  // O topo é a tela ATUAL; o retorno é o item abaixo dela.
  for (let i = pilha.length - 2; i >= 0; i--) {
    if (ehDestinoValido(pilha[i])) return pilha[i];
  }
  return null;
}

/** Registra cada navegação interna. Montado uma vez, no layout da área logada. */
export function NavHistory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    const query = searchParams?.toString();
    const atual = query ? `${pathname}?${query}` : pathname;

    const pilha = lerPilha();
    // Recarregar a mesma tela não empilha: senão o Voltar teria que ser
    // apertado duas vezes para sair do lugar.
    if (pilha[pilha.length - 1] === atual) return;

    pilha.push(atual);
    gravarPilha(pilha);
  }, [pathname, searchParams]);

  return null;
}
