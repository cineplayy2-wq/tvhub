"use server";

import { prisma } from "@/lib/prisma";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { PLAYER } from "@/lib/constants";
import { watchItemKey } from "@/lib/utils";

/**
 * Grava o ponto de reprodução do perfil ativo.
 *
 * Chamada com frequência pelo player (a cada ~10s), então é deliberadamente
 * barata: um upsert, sem revalidatePath. Revalidar aqui invalidaria o cache
 * do catálogo inteiro várias vezes por filme.
 */
export async function saveProgressAction(input: {
  titleId: string;
  episodeId: string | null;
  positionSeconds: number;
  durationSeconds: number;
}) {
  const user = await requireUser();
  const profile = await requireProfile(user.id);

  const { titleId, episodeId, positionSeconds, durationSeconds } = input;

  if (durationSeconds <= 0 || positionSeconds < 0) return;

  const completed =
    positionSeconds / durationSeconds >= PLAYER.COMPLETED_THRESHOLD;

  // itemKey = episódio quando série, título quando filme. Existe porque no
  // Postgres um unique com coluna NULL não impede duplicata: sem ele, o mesmo
  // filme geraria uma linha nova a cada gravação.
  const itemKey = watchItemKey(titleId, episodeId);

  await prisma.watchProgress.upsert({
    where: { profileId_itemKey: { profileId: profile.id, itemKey } },
    update: {
      positionSeconds,
      durationSeconds,
      completed,
      lastWatched: new Date(),
    },
    create: {
      profileId: profile.id,
      titleId,
      episodeId,
      itemKey,
      positionSeconds,
      durationSeconds,
      completed,
    },
  });
}
