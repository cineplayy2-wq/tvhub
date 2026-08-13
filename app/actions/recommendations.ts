"use server";

import { revalidatePath } from "next/cache";

import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { chaveDeItem } from "@/lib/queries/dismissed";

/**
 * Dispensar uma sugestão.
 *
 * O "x" das trilhas de recomendação vale para o PERFIL, não para o navegador.
 * Antes ele gravava em `localStorage`: quem abria no celular via de novo tudo
 * o que já tinha dispensado no computador, e limpar o site zerava a memória.
 *
 * Dispensar tira o título das DICAS, jamais do catálogo. Ele continua na
 * busca, na grade do gênero e em Todo o acervo — "não me sugira isto" e "não
 * quero ter acesso a isto" são pedidos diferentes, e o segundo nunca foi feito.
 *
 * A chave é o nome normalizado, não o id do canal: a sincronização da M3U
 * recria linhas e o id nem sempre sobrevive. A dispensa precisa sobreviver.
 */

export type DismissResult = { ok: boolean; erro?: string };

export async function dismissRecommendationAction(input: {
  name: string;
  channelId?: string | null;
  tmdbId?: number | null;
}): Promise<DismissResult> {
  const user = await requireUser();
  const profile = await getActiveProfile(user.id).catch(() => null);

  if (!profile?.id) return { ok: false, erro: "Nenhum perfil ativo." };

  const itemKey = chaveDeItem(input.name);
  if (!itemKey) return { ok: false, erro: "Título inválido." };

  try {
    await prisma.dismissedRecommendation.upsert({
      where: { profileId_itemKey: { profileId: profile.id, itemKey } },
      create: {
        profileId: profile.id,
        itemKey,
        channelId: input.channelId ?? null,
        tmdbId: typeof input.tmdbId === "number" && input.tmdbId > 0 ? input.tmdbId : null,
      },
      // Dispensar de novo é idempotente: só reafirma o que já valia.
      update: {},
    });
  } catch (erro) {
    console.error("[recomendacoes] falha ao dispensar:", erro);
    return { ok: false, erro: "Não consegui salvar agora." };
  }

  // As trilhas são renderizadas no servidor; sem isto o título só sumiria de
  // verdade na próxima navegação completa.
  revalidatePath("/tv");
  revalidatePath("/tv/movies");
  revalidatePath("/tv/series");

  return { ok: true };
}

/** Desfazer — existe para o "dispensei sem querer" ter conserto. */
export async function restoreRecommendationAction(name: string): Promise<DismissResult> {
  const user = await requireUser();
  const profile = await getActiveProfile(user.id).catch(() => null);

  if (!profile?.id) return { ok: false, erro: "Nenhum perfil ativo." };

  const itemKey = chaveDeItem(name);
  if (!itemKey) return { ok: false, erro: "Título inválido." };

  try {
    await prisma.dismissedRecommendation.deleteMany({
      where: { profileId: profile.id, itemKey },
    });
  } catch {
    return { ok: false, erro: "Não consegui restaurar agora." };
  }

  revalidatePath("/tv");
  revalidatePath("/tv/movies");
  revalidatePath("/tv/series");

  return { ok: true };
}
