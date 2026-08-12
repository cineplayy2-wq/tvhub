"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { fieldErrorsFrom } from "@/lib/validations/auth";
import { m3uPlaylistSchema } from "@/lib/validations/iptv";
import { revincularBackup, syncPlaylist } from "@/lib/iptv/sync-service";
import { falhaEpg, testarFonteEpg, type ResultadoEpg } from "@/lib/iptv/epg";

import type { AdminFormState } from "./admin";

// ==========================================================
// ADMIN — GESTÃO DE M3U
// ==========================================================

export async function upsertM3uPlaylistAction(
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();

  const parsed = m3uPlaylistSchema.safeParse({
    userId: formData.get("userId"),
    label: formData.get("label"),
    sourceType: formData.get("sourceType"),
    sourceUrl: formData.get("sourceUrl") || null,
    rawContent: formData.get("rawContent") || null,
    xtreamServer: formData.get("xtreamServer") || null,
    xtreamUsername: formData.get("xtreamUsername") || null,
    xtreamPassword: formData.get("xtreamPassword") || null,
    autoSyncHours: formData.get("autoSyncHours") || 0,
    backupSourceUrl: formData.get("backupSourceUrl") || null,
    backupXtreamServer: formData.get("backupXtreamServer") || null,
    backupXtreamUsername: formData.get("backupXtreamUsername") || null,
    backupXtreamPassword: formData.get("backupXtreamPassword") || null,
    epgUrl: formData.get("epgUrl") || null,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { userId, ...data } = parsed.data;

  try {
    const existing = await prisma.m3uPlaylist.findUnique({
      where: { userId },
    });

    let playlist;
    if (existing) {
      playlist = await prisma.m3uPlaylist.update({
        where: { userId },
        data: {
          ...data,
          syncStatus: "PENDING",
        },
      });
    } else {
      playlist = await prisma.m3uPlaylist.create({
        data: { userId, ...data },
      });
    }

    void syncPlaylist(playlist).catch((err) => {
      console.error("Erro na sincronização M3U em segundo plano:", err);
    });

    await writeAuditLog({
      actorId: admin.id,
      action: existing ? "m3u.update" : "m3u.create",
      targetType: "M3uPlaylist",
      targetId: userId,
      metadata: {
        label: data.label,
        sourceType: data.sourceType,
      },
    });

    revalidatePath("/admin/iptv");
    revalidatePath(`/admin/iptv/${userId}`);
    revalidatePath(`/admin/clientes/${userId}`);
    revalidatePath("/tv");

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Erro ao salvar a lista M3U",
    };
  }
}

/**
 * Testa uma URL de EPG antes de salvar.
 *
 * Baixa só o cabeçalho de canais do XMLTV e diz quantos canais da lista do
 * cliente têm programação. Sem isso, configurar EPG é chute: a URL responde
 * 200, mas os tvg-id podem não bater com nada.
 */
export async function testarEpgAction(
  userId: string,
  url: string,
): Promise<ResultadoEpg> {
  await requireAdmin();

  const endereco = url.trim();
  if (!endereco) return falhaEpg("Informe a URL do EPG");
  if (!/^https?:\/\//i.test(endereco)) {
    return falhaEpg("A URL precisa começar com http:// ou https://");
  }

  const playlist = await prisma.m3uPlaylist.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!playlist) {
    return falhaEpg("Salve a lista M3U antes de testar o EPG");
  }

  return testarFonteEpg(endereco, playlist.id);
}

export async function syncM3uPlaylistAction(userId: string) {
  const admin = await requireAdmin();

  const playlist = await prisma.m3uPlaylist.findUnique({
    where: { userId },
  });

  if (!playlist) return { error: "Lista M3U não encontrada" };

  void syncPlaylist(playlist).catch((err) => {
    console.error("Erro na sincronização manual:", err);
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "m3u.sync",
    targetType: "M3uPlaylist",
    targetId: playlist.id,
  });

  revalidatePath("/admin/iptv");
  revalidatePath(`/admin/iptv/${userId}`);
  revalidatePath(`/admin/clientes/${userId}`);

  return { success: true };
}

/**
 * Revincula as URLs de backup sem reimportar o catálogo.
 *
 * "Sincronizar Agora" apaga os canais antes de repovoar, e o assinante fica
 * sem catálogo durante o processo. Quando só o failover ficou para trás,
 * este caminho resolve sem janela de indisponibilidade.
 */
export async function revincularBackupAction(userId: string) {
  const admin = await requireAdmin();

  const playlist = await prisma.m3uPlaylist.findUnique({ where: { userId } });
  if (!playlist) return { erro: "Lista M3U não encontrada" };
  if (!playlist.backupSourceUrl && !playlist.backupXtreamServer) {
    return { erro: "Nenhuma lista de backup configurada" };
  }

  try {
    const resultado = await revincularBackup(playlist);

    await writeAuditLog({
      actorId: admin.id,
      action: "m3u.relink_backup",
      targetType: "M3uPlaylist",
      targetId: playlist.id,
      metadata: resultado,
    });

    revalidatePath(`/admin/iptv/${userId}`);
    return resultado;
  } catch (erro) {
    return {
      erro: erro instanceof Error ? erro.message : "Falha ao revincular o backup",
    };
  }
}

/**
 * Liga/desliga o módulo adulto (+18) deste cliente.
 *
 * É o único caminho que libera o +18. Sem ele, a categoria adulta não retorna
 * nada — nem pela navegação, nem por quem digitar a URL direto.
 */
export async function alternarModuloAdultoAction(userId: string) {
  const admin = await requireAdmin();

  const playlist = await prisma.m3uPlaylist.findUnique({
    where: { userId },
    select: { id: true, adultUnlocked: true },
  });
  if (!playlist) return { erro: "Lista M3U não encontrada" };

  const liberado = !playlist.adultUnlocked;

  await prisma.m3uPlaylist.update({
    where: { userId },
    data: { adultUnlocked: liberado },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: liberado ? "adult.unlock" : "adult.lock",
    targetType: "M3uPlaylist",
    targetId: playlist.id,
    metadata: { userId },
  });

  revalidatePath(`/admin/iptv/${userId}`);
  revalidatePath("/tv");
  return { liberado };
}

export async function deleteM3uPlaylistAction(userId: string) {
  const admin = await requireAdmin();

  await prisma.m3uPlaylist.deleteMany({ where: { userId } });

  await writeAuditLog({
    actorId: admin.id,
    action: "m3u.delete",
    targetType: "M3uPlaylist",
    targetId: userId,
  });

  revalidatePath("/admin/iptv");
  revalidatePath(`/admin/clientes/${userId}`);
}

export async function toggleGroupVisibilityAction(
  groupId: string,
  playlistId: string,
) {
  await requireAdmin();

  const group = await prisma.m3uGroup.findUnique({
    where: { id: groupId },
    select: { isHidden: true },
  });

  if (!group) return;

  await prisma.m3uGroup.update({
    where: { id: groupId },
    data: { isHidden: !group.isHidden },
  });

  revalidatePath("/admin/iptv");
}

export async function toggleCategoryLockAction(
  playlistId: string,
  category: string,
  isHidden: boolean,
  userId: string,
) {
  await requireAdmin();

  if (category === "adult") {
    await prisma.m3uGroup.updateMany({
      where: {
        playlistId,
        OR: [
          { category: "adult" },
          { name: { contains: "adult", mode: "insensitive" } },
          { name: { contains: "+18", mode: "insensitive" } },
          { name: { contains: "18+", mode: "insensitive" } },
          { name: { contains: "xxx", mode: "insensitive" } },
          { name: { contains: "onlyfans", mode: "insensitive" } },
          { name: { contains: "privacy", mode: "insensitive" } },
          { name: { contains: "playboy", mode: "insensitive" } },
          { name: { contains: "venus", mode: "insensitive" } },
          { name: { contains: "sexy", mode: "insensitive" } },
          { name: { contains: "brazzers", mode: "insensitive" } },
          { name: { contains: "hustler", mode: "insensitive" } },
          { name: { contains: "hentai", mode: "insensitive" } },
        ],
      },
      data: { isHidden },
    });
  } else {
    await prisma.m3uGroup.updateMany({
      where: { playlistId, category },
      data: { isHidden },
    });
  }

  revalidatePath("/admin/iptv");
  revalidatePath(`/admin/iptv/${userId}`);
  revalidatePath("/tv");
}

export async function toggleChannelFavoriteAction(channelId: string) {
  const user = await requireUser();

  const channel = await prisma.m3uChannel.findUnique({
    where: { id: channelId },
    include: { playlist: { select: { userId: true } } },
  });

  if (!channel || channel.playlist.userId !== user.id) return;

  await prisma.m3uChannel.update({
    where: { id: channelId },
    data: { isFavorite: !channel.isFavorite },
  });

  revalidatePath("/tv");
}
