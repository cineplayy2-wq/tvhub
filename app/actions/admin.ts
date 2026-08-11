"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { fieldErrorsFrom } from "@/lib/validations/auth";
import { episodeSchema, titleSchema } from "@/lib/validations/admin";

export type AdminFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

/** Erro de unique violation do Prisma. */
function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

// ==========================================================
// CLIENTES
// ==========================================================

export async function toggleUserBlockAction(userId: string, reason?: string) {
  const admin = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, role: true },
  });

  if (!user) return;

  // Um admin não pode bloquear outro admin nem a si mesmo pelo painel:
  // é o caminho mais fácil para alguém trancar a operação inteira fora.
  if (user.role === "ADMIN") return;

  const shouldBlock = user.status === "ACTIVE";

  await prisma.user.update({
    where: { id: userId },
    data: shouldBlock
      ? {
          status: "BLOCKED",
          blockedAt: new Date(),
          blockedReason: reason?.trim() || "Bloqueado pelo administrador",
        }
      : { status: "ACTIVE", blockedAt: null, blockedReason: null },
  });

  if (shouldBlock) {
    // Bloquear sem encerrar o que já está tocando deixaria o acesso de pé
    // até o fim da sessão. A trava de telas (Passo 6) também lê estas linhas.
    await prisma.streamSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, endedAt: new Date(), endReason: "ADMIN_REVOKED" },
    });
  }

  await writeAuditLog({
    actorId: admin.id,
    action: shouldBlock ? "user.block" : "user.unblock",
    targetType: "User",
    targetId: userId,
    metadata: reason ? { reason } : undefined,
  });

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${userId}`);
}

// ==========================================================
// CONTEÚDO
// ==========================================================

export async function upsertTitleAction(
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();

  const parsed = titleSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug"),
    synopsis: formData.get("synopsis"),
    type: formData.get("type"),
    status: formData.get("status"),
    posterUrl: formData.get("posterUrl"),
    backdropUrl: formData.get("backdropUrl"),
    logoUrl: formData.get("logoUrl"),
    trailerUrl: formData.get("trailerUrl"),
    videoProvider: formData.get("videoProvider"),
    videoProviderId: formData.get("videoProviderId"),
    videoUrl: formData.get("videoUrl"),
    videoStatus: formData.get("videoStatus"),
    releaseYear: formData.get("releaseYear") || null,
    durationSeconds: formData.get("durationSeconds") || null,
    ageRating: formData.get("ageRating"),
    director: formData.get("director"),
    country: formData.get("country"),
    tmdbId: formData.get("tmdbId") ?? null,
    tmdbRating: formData.get("tmdbRating") ?? null,
    originalName: formData.get("originalName"),
    genres: formData.getAll("genres").join(","),
    cast: formData.get("cast") ?? "",
    isFeatured: formData.get("isFeatured") === "on",
    popularity: formData.get("popularity") || 0,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { id, genres, ...data } = parsed.data;

  // Publicar sem vídeo pronto gera um card que quebra no play.
  // A regra vive aqui, não só no client, porque o client é contornável.
  if (data.status === "PUBLISHED" && data.type === "MOVIE") {
    if (data.videoStatus !== "READY" || (!data.videoProviderId && !data.videoUrl)) {
      return {
        error:
          "Para publicar um filme, o vídeo precisa estar READY e ter ID do provedor ou URL HLS.",
      };
    }
  }

  const relation = {
    genres: { set: genres.map((slug) => ({ slug })) },
  };

  try {
    if (id) {
      await prisma.title.update({
        where: { id },
        data: {
          ...data,
          ...relation,
          // Marca a data só na primeira publicação, para não bagunçar
          // a ordenação de "Lançamentos" a cada edição
          ...(data.status === "PUBLISHED"
            ? { publishedAt: (await currentPublishedAt(id)) ?? new Date() }
            : {}),
        },
      });

      await writeAuditLog({
        actorId: admin.id,
        action: "title.update",
        targetType: "Title",
        targetId: id,
        metadata: { status: data.status },
      });

      revalidatePath("/admin/conteudo");
      revalidatePath(`/admin/conteudo/${id}`);
      return { success: true };
    }

    const created = await prisma.title.create({
      data: {
        ...data,
        genres: { connect: genres.map((slug) => ({ slug })) },
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
      },
      select: { id: true },
    });

    await writeAuditLog({
      actorId: admin.id,
      action: "title.create",
      targetType: "Title",
      targetId: created.id,
      metadata: { name: data.name },
    });

    revalidatePath("/admin/conteudo");
    redirect(`/admin/conteudo/${created.id}`);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fieldErrors: { slug: "Já existe um título com este slug." } };
    }
    throw error;
  }
}

async function currentPublishedAt(titleId: string) {
  const existing = await prisma.title.findUnique({
    where: { id: titleId },
    select: { publishedAt: true },
  });
  return existing?.publishedAt ?? null;
}

export async function deleteTitleAction(titleId: string) {
  const admin = await requireAdmin();

  const title = await prisma.title.findUnique({
    where: { id: titleId },
    select: { name: true },
  });

  await prisma.title.delete({ where: { id: titleId } });

  await writeAuditLog({
    actorId: admin.id,
    action: "title.delete",
    targetType: "Title",
    targetId: titleId,
    metadata: { name: title?.name },
  });

  revalidatePath("/admin/conteudo");
  redirect("/admin/conteudo");
}

// ==========================================================
// EPISÓDIOS
// ==========================================================

export async function upsertEpisodeAction(
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();

  const parsed = episodeSchema.safeParse({
    id: formData.get("id") || undefined,
    titleId: formData.get("titleId"),
    season: formData.get("season"),
    number: formData.get("number"),
    name: formData.get("name"),
    synopsis: formData.get("synopsis"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    videoProviderId: formData.get("videoProviderId"),
    videoUrl: formData.get("videoUrl"),
    videoStatus: formData.get("videoStatus"),
    durationSeconds: formData.get("durationSeconds") || null,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { id, ...data } = parsed.data;

  try {
    if (id) {
      await prisma.episode.update({ where: { id }, data });
    } else {
      await prisma.episode.create({ data });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        error: `Já existe o episódio T${data.season}E${data.number} nesta série.`,
      };
    }
    throw error;
  }

  await writeAuditLog({
    actorId: admin.id,
    action: id ? "episode.update" : "episode.create",
    targetType: "Episode",
    targetId: id ?? data.titleId,
    metadata: { season: data.season, number: data.number },
  });

  revalidatePath(`/admin/conteudo/${data.titleId}`);
  return { success: true };
}

export async function deleteEpisodeAction(episodeId: string, titleId: string) {
  const admin = await requireAdmin();

  await prisma.episode.delete({ where: { id: episodeId } });

  await writeAuditLog({
    actorId: admin.id,
    action: "episode.delete",
    targetType: "Episode",
    targetId: episodeId,
  });

  revalidatePath(`/admin/conteudo/${titleId}`);
}
