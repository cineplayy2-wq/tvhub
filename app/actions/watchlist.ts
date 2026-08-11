"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireProfile, requireUser } from "@/lib/auth/session";

/**
 * Adiciona ou remove um título da lista do perfil ativo.
 *
 * Devolve o estado final para o botão reconciliar a atualização otimista —
 * se o servidor divergir do que o clique assumiu, a UI volta ao real.
 */
export async function toggleWatchlistAction(titleId: string) {
  const user = await requireUser();
  const profile = await requireProfile(user.id);

  const existing = await prisma.watchlistItem.findUnique({
    where: { profileId_titleId: { profileId: profile.id, titleId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.watchlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/inicio");
    revalidatePath("/minha-lista");
    return { inList: false };
  }

  // O título precisa existir e estar publicado: sem esta checagem, um id
  // forjado no cliente criaria linha para rascunho ou para obra inexistente.
  const title = await prisma.title.findFirst({
    where: { id: titleId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!title) return { inList: false };

  await prisma.watchlistItem.create({
    data: { profileId: profile.id, titleId },
  });

  revalidatePath("/inicio");
  revalidatePath("/minha-lista");
  return { inList: true };
}
