"use server";

import { revalidatePath } from "next/cache";

import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const REASONS = new Set([
  "Sinal fora do ar / Tela preta",
  "Áudio travando ou sem som",
  "Imagem com travamentos constantes",
  "Legenda ou idioma incorreto",
  "Conteúdo trocado / Nome errado",
]);

/**
 * Grava um reporte de problema de sinal.
 *
 * Antes o modal só fingia envio com setTimeout. Agora cai em AuditLog com
 * canal, motivo e perfil — o admin já tem a tela de auditoria.
 */
export async function reportChannelIssueAction(input: {
  channelId?: string;
  channelName?: string;
  reason: string;
}) {
  const user = await requireUser();

  if (!input.reason || !REASONS.has(input.reason)) {
    return { ok: false as const, error: "Motivo inválido." };
  }

  const profile = await getActiveProfile(user.id).catch(() => null);

  let targetId = input.channelId ?? "unknown";
  let channelName = input.channelName ?? null;

  if (input.channelId) {
    const channel = await prisma.m3uChannel.findFirst({
      where: {
        id: input.channelId,
        playlist: { userId: user.id },
      },
      select: { id: true, name: true },
    });
    if (channel) {
      targetId = channel.id;
      channelName = channel.name;
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "IPTV_SIGNAL_REPORT",
      targetType: "M3uChannel",
      targetId,
      metadata: {
        reason: input.reason,
        channelName,
        profileId: profile?.id ?? null,
        profileName: profile?.name ?? null,
      },
    },
  });

  revalidatePath("/admin/auditoria");
  return { ok: true as const };
}
