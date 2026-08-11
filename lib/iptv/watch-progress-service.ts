import "server-only";

import { prisma } from "@/lib/prisma";
import { cleanMediaTitle, slugify } from "@/lib/utils";

export interface ContinueWatchingItem {
  channelId: string;
  cleanName: string;
  originalName: string;
  logoUrl: string | null;
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  remainingSeconds: number;
  category: string | null;
  lastWatched: Date;
  watchCount: number;
  isSeries: boolean;
}

const COMPLETION_RATIO = 0.92;
const MIN_POSITION_SECONDS = 15;

/**
 * Salva a posição exata onde o usuário parou de assistir.
 * Garante vínculo perfeito com o canal e contagem de visualizações completas.
 */
export async function saveWatchProgress({
  profileId,
  titleName,
  channelId,
  positionSeconds,
  durationSeconds,
}: {
  profileId: string;
  titleName: string;
  channelId?: string;
  positionSeconds: number;
  durationSeconds: number;
}) {
  if (!profileId || !titleName || positionSeconds < MIN_POSITION_SECONDS) return;

  const cleanName = cleanMediaTitle(titleName);
  const itemKey = slugify(cleanName);
  if (!itemKey) return;

  const completed =
    durationSeconds > 0 && positionSeconds / durationSeconds >= COMPLETION_RATIO;

  // Se channelId não veio na requisição, resolve via itemKey na playlist ativa
  let targetChannelId = channelId || null;
  if (!targetChannelId) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { userId: true },
      });
      if (profile?.userId) {
        const found = await prisma.m3uChannel.findFirst({
          where: {
            playlist: { userId: profile.userId },
            name: { contains: cleanName.slice(0, 15), mode: "insensitive" },
          },
          select: { id: true },
        });
        if (found) targetChannelId = found.id;
      }
    } catch {}
  }

  try {
    const existing = await prisma.watchProgress.findUnique({
      where: { profileId_itemKey: { profileId, itemKey } },
      select: { id: true, completed: true, watchCount: true, durationSeconds: true },
    });

    if (!existing) {
      await prisma.watchProgress.create({
        data: {
          profileId,
          channelId: targetChannelId,
          itemKey,
          positionSeconds,
          durationSeconds,
          completed,
          watchCount: completed ? 1 : 0,
        },
      });
      return;
    }

    const finishedNow = completed && !existing.completed;

    await prisma.watchProgress.update({
      where: { id: existing.id },
      data: {
        positionSeconds,
        durationSeconds: durationSeconds > 0 ? durationSeconds : existing.durationSeconds,
        completed,
        channelId: targetChannelId || undefined,
        watchCount: finishedNow ? existing.watchCount + 1 : existing.watchCount,
        lastWatched: new Date(),
      },
    });
  } catch (error) {
    console.error("[progress] falha ao gravar:", error);
  }
}

/**
 * Retorna a lista de itens "Continuar Assistindo" para o perfil logado.
 * Tenta casar primeiro por channelId direto, depois por itemKey na playlist ativa.
 */
export async function getContinueWatchingList(
  playlistId: string,
  profileId: string,
  limit = 12,
): Promise<ContinueWatchingItem[]> {
  if (!profileId || !playlistId) return [];

  try {
    const records = await prisma.watchProgress.findMany({
      where: {
        profileId,
        completed: false,
        positionSeconds: { gt: MIN_POSITION_SECONDS },
      },
      orderBy: { lastWatched: "desc" },
      take: limit * 2,
      select: {
        itemKey: true,
        channelId: true,
        positionSeconds: true,
        durationSeconds: true,
        lastWatched: true,
        watchCount: true,
        channel: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            streamUrl: true,
            playlistId: true,
            group: { select: { category: true } },
          },
        },
      },
    });

    if (records.length === 0) return [];

    const result: ContinueWatchingItem[] = [];

    for (const record of records) {
      if (result.length >= limit) break;

      let channel = record.channel;

      // Se o canal não veio direto ou pertencia a outra versão da playlist
      if (!channel || channel.playlistId !== playlistId) {
        try {
          const fallback = await prisma.m3uChannel.findFirst({
            where: {
              playlistId,
              isActive: true,
              group: { isHidden: false, category: { not: "adult" } },
              name: { contains: record.itemKey.replace(/-/g, " "), mode: "insensitive" },
            },
            select: {
              id: true,
              name: true,
              logoUrl: true,
              streamUrl: true,
              playlistId: true,
              group: { select: { category: true } },
            },
          });
          if (fallback) channel = fallback;
        } catch {}
      }

      if (!channel) continue;

      const percent =
        record.durationSeconds > 0
          ? Math.min(100, Math.round((record.positionSeconds / record.durationSeconds) * 100))
          : 0;

      result.push({
        channelId: channel.id,
        cleanName: cleanMediaTitle(channel.name),
        originalName: channel.name,
        logoUrl: channel.logoUrl,
        positionSeconds: record.positionSeconds,
        durationSeconds: record.durationSeconds,
        progressPercent: percent,
        remainingSeconds: Math.max(0, record.durationSeconds - record.positionSeconds),
        category: channel.group?.category ?? "movies",
        lastWatched: record.lastWatched,
        watchCount: record.watchCount,
        isSeries:
          channel.streamUrl.includes("/series/") || channel.group?.category === "series",
      });
    }

    return result;
  } catch (error) {
    console.error("[progress] falha ao listar:", error);
    return [];
  }
}

/** Onde o player deve retomar, e quantas vezes o título já foi visto. */
export async function getResumePoint(profileId: string, titleName: string) {
  const itemKey = slugify(cleanMediaTitle(titleName));
  if (!profileId || !itemKey) return null;

  try {
    const record = await prisma.watchProgress.findUnique({
      where: { profileId_itemKey: { profileId, itemKey } },
      select: {
        positionSeconds: true,
        durationSeconds: true,
        completed: true,
        watchCount: true,
      },
    });

    if (!record) return null;

    return {
      positionSeconds: record.completed ? 0 : record.positionSeconds,
      durationSeconds: record.durationSeconds,
      watchCount: record.watchCount,
      completed: record.completed,
      progressPercent:
        record.durationSeconds > 0
          ? Math.min(100, Math.round((record.positionSeconds / record.durationSeconds) * 100))
          : 0,
    };
  } catch {
    return null;
  }
}
