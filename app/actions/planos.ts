"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { fieldErrorsFrom } from "@/lib/validations/auth";
import { slugify } from "@/lib/utils";

import type { AdminFormState } from "./admin";

/**
 * Gestão de planos e vínculo de assinatura.
 *
 * A tela de planos era só vitrine: mostrava o que estava no banco e não deixava
 * criar, editar nem atribuir nada. Quem quisesse mudar um preço ou colocar um
 * cliente num plano tinha que ir no banco pela mão.
 */

const planoSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome do plano").max(80),
  description: z.string().trim().max(240).optional().nullable(),
  /** Recebe "29,90" ou "29.90" e guarda em centavos. */
  preco: z
    .string()
    .trim()
    .min(1, "Informe o preço")
    .transform((v) => v.replace(/\./g, "").replace(",", "."))
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "Preço inválido")
    .transform((v) => Math.round(Number(v) * 100)),
  interval: z.enum(["MONTH", "YEAR"]),
  deviceLimit: z.coerce.number().int().min(1).max(10),
  maxProfiles: z.coerce.number().int().min(1).max(10),
  trialDays: z.coerce.number().int().min(0).max(90),
  /** Uma vantagem por linha. */
  features: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  isActive: z.coerce.boolean().optional().default(true),
});

export async function upsertPlanoAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();

  const parsed = planoSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description") || null,
    preco: formData.get("preco"),
    interval: formData.get("interval"),
    deviceLimit: formData.get("deviceLimit"),
    maxProfiles: formData.get("maxProfiles"),
    trialDays: formData.get("trialDays") || 0,
    features: formData.get("features") || "",
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { id, preco, ...dados } = parsed.data;

  try {
    const plano = id
      ? await prisma.plan.update({
          where: { id },
          data: { ...dados, priceCents: preco },
        })
      : await prisma.plan.create({
          data: {
            ...dados,
            priceCents: preco,
            slug: slugify(dados.name) || `plano-${Date.now()}`,
            sortOrder: await prisma.plan.count(),
          },
        });

    await writeAuditLog({
      actorId: admin.id,
      action: id ? "plan.update" : "plan.create",
      targetType: "Plan",
      targetId: plano.id,
      metadata: { name: plano.name, priceCents: plano.priceCents },
    });

    revalidatePath("/admin/planos");
    revalidatePath("/");
    return { success: true };
  } catch (erro) {
    const jaExiste =
      typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2002";
    return {
      error: jaExiste
        ? "Já existe um plano com esse nome"
        : erro instanceof Error
          ? erro.message
          : "Falha ao salvar o plano",
    };
  }
}

export async function togglePlanoAtivoAction(planId: string) {
  const admin = await requireAdmin();

  const plano = await prisma.plan.findUnique({
    where: { id: planId },
    select: { isActive: true, name: true },
  });
  if (!plano) return { erro: "Plano não encontrado" };

  await prisma.plan.update({
    where: { id: planId },
    data: { isActive: !plano.isActive },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: plano.isActive ? "plan.deactivate" : "plan.activate",
    targetType: "Plan",
    targetId: planId,
    metadata: { name: plano.name },
  });

  revalidatePath("/admin/planos");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Coloca (ou troca) o plano de um cliente.
 *
 * `Subscription.userId` é único, então é upsert: um cliente tem no máximo uma
 * assinatura. O período é calculado a partir do intervalo do plano — sem isso a
 * conta entraria sem validade e o controle de acesso não teria o que checar.
 */
export async function vincularPlanoAction(userId: string, planId: string) {
  const admin = await requireAdmin();

  const [cliente, plano] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.plan.findUnique({ where: { id: planId } }),
  ]);

  if (!cliente) return { erro: "Cliente não encontrado" };
  if (!plano) return { erro: "Plano não encontrado" };

  const inicio = new Date();
  const fim = new Date(inicio);
  if (plano.interval === "YEAR") fim.setFullYear(fim.getFullYear() + 1);
  else fim.setMonth(fim.getMonth() + 1);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId,
      status: "ACTIVE",
      currentPeriodStart: inicio,
      currentPeriodEnd: fim,
      nextChargeAt: fim,
    },
    update: {
      planId,
      status: "ACTIVE",
      currentPeriodStart: inicio,
      currentPeriodEnd: fim,
      nextChargeAt: fim,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "subscription.assign",
    targetType: "Subscription",
    targetId: userId,
    metadata: { plano: plano.name, ate: fim.toISOString() },
  });

  revalidatePath(`/admin/clientes/${userId}`);
  revalidatePath("/admin/clientes");
  return { ok: true, ate: fim.toISOString() };
}

/** Cancela a assinatura do cliente sem apagar o histórico. */
export async function cancelarAssinaturaAction(userId: string) {
  const admin = await requireAdmin();

  const assinatura = await prisma.subscription.findUnique({ where: { userId } });
  if (!assinatura) return { erro: "Este cliente não tem assinatura" };

  await prisma.subscription.update({
    where: { userId },
    data: { status: "CANCELED", canceledAt: new Date(), cancelAtPeriodEnd: true },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "subscription.cancel",
    targetType: "Subscription",
    targetId: userId,
  });

  revalidatePath(`/admin/clientes/${userId}`);
  revalidatePath("/admin/clientes");
  return { ok: true };
}
