import "server-only";

import { prisma } from "@/lib/prisma";
import { cleanMediaTitle, slugify } from "@/lib/utils";

/**
 * Sugestões que o perfil mandou parar de mostrar.
 *
 * A chave é o nome normalizado — a mesma de `WatchProgress.itemKey` — e não o
 * id do canal. A sincronização da M3U recria linhas e o id nem sempre
 * sobrevive; se a dispensa dependesse dele, o título voltaria a ser sugerido
 * na primeira atualização da lista, que é o oposto do que foi pedido.
 */

export function chaveDeItem(nome: string) {
  return slugify(cleanMediaTitle(nome));
}

/**
 * Conjunto de chaves dispensadas pelo perfil.
 *
 * Uma consulta só por renderização, compartilhada por todas as trilhas. O
 * volume é naturalmente pequeno (é o que uma pessoa dispensou à mão), então
 * carregar tudo é mais barato que filtrar item a item no banco.
 */
export async function getDismissedKeys(profileId: string | null | undefined): Promise<Set<string>> {
  if (!profileId) return new Set();

  try {
    const linhas = await prisma.dismissedRecommendation.findMany({
      where: { profileId },
      select: { itemKey: true },
      take: 2000,
    });
    return new Set(linhas.map((l) => l.itemKey));
  } catch {
    // Sem a lista, o certo é mostrar demais e não de menos: uma sugestão
    // repetida incomoda, uma trilha vazia parece defeito.
    return new Set();
  }
}

/** Tira da trilha o que o perfil já dispensou. */
export function semDispensados<T extends { name: string }>(
  itens: T[],
  dispensadas: Set<string>,
): T[] {
  if (dispensadas.size === 0) return itens;
  return itens.filter((item) => !dispensadas.has(chaveDeItem(item.name)));
}
