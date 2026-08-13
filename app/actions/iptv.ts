"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getActiveProfile, requireAdmin, requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { fieldErrorsFrom } from "@/lib/validations/auth";
import { m3uPlaylistSchema } from "@/lib/validations/iptv";
import { revincularBackup, syncPlaylist } from "@/lib/iptv/sync-service";
import { falhaEpg, testarFonteEpg, type ResultadoEpg } from "@/lib/iptv/epg";

import type { AdminFormState } from "./admin";

// ==========================================================
// ADMIN — GESTÃO DO CATÁLOGO COMPARTILHADO
// ==========================================================

/**
 * Cria ou atualiza o catálogo do sistema.
 *
 * `userId` no formulário ainda existe por compatibilidade com o painel: ele
 * aponta para quem cadastrou a lista, não para o dono exclusivo do conteúdo.
 * Se já houver catálogo `isSystem`, atualiza aquele — nunca cria uma cópia
 * por cliente.
 */
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

  const { userId: userIdRaw, ...data } = parsed.data;
  const userId =
    userIdRaw === "system"
      ? admin.id
      : userIdRaw;

  try {
    const existing =
      (await prisma.m3uPlaylist.findFirst({ where: { isSystem: true } })) ??
      (await prisma.m3uPlaylist.findUnique({ where: { userId } }));

    let playlist;
    if (existing) {
      playlist = await prisma.m3uPlaylist.update({
        where: { id: existing.id },
        data: {
          ...data,
          isSystem: true,
          syncStatus: "PENDING",
        },
      });
    } else {
      playlist = await prisma.m3uPlaylist.create({
        data: { userId, ...data, isSystem: true },
      });
    }

    void syncPlaylist(playlist).catch((err) => {
      console.error("Erro na sincronização M3U em segundo plano:", err);
    });

    await writeAuditLog({
      actorId: admin.id,
      action: existing ? "m3u.update" : "m3u.create",
      targetType: "M3uPlaylist",
      targetId: playlist.id,
      metadata: {
        label: data.label,
        sourceType: data.sourceType,
        isSystem: true,
      },
    });

    revalidatePath("/admin/iptv");
    revalidatePath("/tv");

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Erro ao salvar o catálogo M3U",
    };
  }
}

/**
 * Testa uma URL de EPG antes de salvar.
 *
 * Baixa só o cabeçalho de canais do XMLTV e diz quantos canais do catálogo
 * têm programação. Sem isso, configurar EPG é chute: a URL responde 200, mas
 * os tvg-id podem não bater com nada.
 */
export async function testarEpgAction(
  _userId: string,
  url: string,
): Promise<ResultadoEpg> {
  await requireAdmin();

  const endereco = url.trim();
  if (!endereco) return falhaEpg("Informe a URL do EPG");
  if (!/^https?:\/\//i.test(endereco)) {
    return falhaEpg("A URL precisa começar com http:// ou https://");
  }

  const playlist = await prisma.m3uPlaylist.findFirst({
    where: { isSystem: true },
    select: { id: true },
  });

  if (!playlist) {
    return falhaEpg("Configure o catálogo compartilhado antes de testar o EPG");
  }

  return testarFonteEpg(endereco, playlist.id);
}

export async function syncM3uPlaylistAction(_userId?: string) {
  const admin = await requireAdmin();

  const playlist = await prisma.m3uPlaylist.findFirst({
    where: { isSystem: true },
  });

  if (!playlist) return { error: "Catálogo compartilhado não encontrado" };

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
  revalidatePath("/tv");

  return { success: true };
}

/**
 * Revincula as URLs de backup sem reimportar o catálogo.
 *
 * Quando só o failover ficou para trás, este caminho resolve sem janela de
 * indisponibilidade.
 */
export async function revincularBackupAction(_userId?: string) {
  const admin = await requireAdmin();

  const playlist = await prisma.m3uPlaylist.findFirst({ where: { isSystem: true } });
  if (!playlist) return { erro: "Catálogo compartilhado não encontrado" };
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

    revalidatePath("/admin/iptv");
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
 * Mora no User — o catálogo é compartilhado, então liberar um assinante não
 * pode abrir o +18 para todo mundo.
 */
export async function alternarModuloAdultoAction(userId: string) {
  const admin = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, adultUnlocked: true },
  });
  if (!user) return { erro: "Cliente não encontrado" };

  const liberado = !user.adultUnlocked;

  await prisma.user.update({
    where: { id: userId },
    data: { adultUnlocked: liberado },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: liberado ? "adult.unlock" : "adult.lock",
    targetType: "User",
    targetId: userId,
    metadata: { userId },
  });

  revalidatePath(`/admin/iptv/${userId}`);
  revalidatePath(`/admin/clientes/${userId}`);
  revalidatePath("/tv");
  return { liberado };
}

/**
 * Grava a linha IPTV (user/senha do provedor) DESTE cliente.
 *
 * Sem isto ele não assiste — a conta da lista nunca entra no play.
 */
export async function salvarLinhaIptvAction(
  userId: string,
  username: string,
  password: string,
): Promise<{ ok: true } | { erro: string }> {
  const admin = await requireAdmin();

  const user = username.trim();
  const pass = password.trim();
  if (!user || !pass) {
    return { erro: "Informe usuário e senha da linha IPTV deste cliente." };
  }

  const existe = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!existe) return { erro: "Cliente não encontrado" };

  await prisma.user.update({
    where: { id: userId },
    data: { iptvUsername: user, iptvPassword: pass },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "iptv.line.update",
    targetType: "User",
    targetId: userId,
    metadata: { iptvUsername: user },
  });

  revalidatePath(`/admin/iptv/${userId}`);
  revalidatePath(`/admin/clientes/${userId}`);
  return { ok: true };
}

export async function deleteM3uPlaylistAction(userId: string) {
  const admin = await requireAdmin();

  // Não apaga o catálogo do sistema — isso tiraria a TV de todo mundo.
  const playlist = await prisma.m3uPlaylist.findUnique({ where: { userId } });
  if (playlist?.isSystem) {
    return { error: "Não é possível apagar o catálogo compartilhado por aqui." };
  }

  await prisma.m3uPlaylist.deleteMany({ where: { userId, isSystem: false } });

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

/**
 * Trava/libera uma categoria PARA ESTE CLIENTE.
 *
 * Não mexe em M3uGroup.isHidden — o catálogo é compartilhado.
 */
export async function toggleCategoryLockAction(
  _playlistId: string,
  category: string,
  isHidden: boolean,
  userId: string,
) {
  await requireAdmin();

  const { setUserCategoryLock } = await import("@/lib/queries/iptv");
  await setUserCategoryLock(userId, category, isHidden);

  revalidatePath("/admin/iptv");
  revalidatePath(`/admin/iptv/${userId}`);
  revalidatePath(`/admin/clientes/${userId}`);
  revalidatePath("/tv");
}

export async function toggleChannelFavoriteAction(channelId: string) {
  const user = await requireUser();
  const profile = await getActiveProfile(user.id);
  if (!profile) return;

  const channel = await prisma.m3uChannel.findUnique({
    where: { id: channelId },
    select: { id: true },
  });
  if (!channel) return;

  const existente = await prisma.channelFavorite.findUnique({
    where: {
      profileId_channelId: { profileId: profile.id, channelId },
    },
  });

  if (existente) {
    await prisma.channelFavorite.delete({ where: { id: existente.id } });
  } else {
    await prisma.channelFavorite.create({
      data: { profileId: profile.id, channelId },
    });
  }

  revalidatePath("/tv");
}
