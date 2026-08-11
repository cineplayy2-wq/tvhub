import "server-only";

import { prisma } from "@/lib/prisma";
import type { TitleCard } from "@/types";

/**
 * Amostra do catálogo para a landing (área pública).
 * Retorna lista vazia se o banco estiver fora — a seção some, a página não quebra.
 */
/**
 * Quantidade real de títulos publicados.
 * A landing usa esse número na copy — se o banco cair, retorna 0 e os textos
 * caem para a variante sem número, em vez de anunciar "0 títulos".
 */
export async function countPublishedTitles(): Promise<number> {
  try {
    return await prisma.title.count({ where: { status: "PUBLISHED" } });
  } catch {
    return 0;
  }
}

export async function getShowcaseTitles(limit = 12): Promise<TitleCard[]> {
  try {
    return await prisma.title.findMany({
      where: { status: "PUBLISHED", posterUrl: { not: null } },
      orderBy: { popularity: "desc" },
      take: limit,
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        posterUrl: true,
        backdropUrl: true,
        releaseYear: true,
        ageRating: true,
        durationSeconds: true,
      },
    });
  } catch (error) {
    console.error(
      "[catalog] vitrine indisponível:",
      error instanceof Error ? error.message.split("\n")[0] : error,
    );
    return [];
  }
}
