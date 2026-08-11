import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
};

/**
 * Registra uma ação administrativa.
 *
 * Best-effort de propósito: se a auditoria falhar, a operação já executada não
 * pode ser desfeita nem a resposta virar erro. O log some, a ação permanece —
 * o contrário (bloquear o admin porque o log falhou) é pior.
 */
export async function writeAuditLog({
  actorId,
  action,
  targetType,
  targetId,
  metadata,
}: AuditInput) {
  try {
    const forwarded = headers().get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() ?? null;

    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        ipAddress,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  } catch (error) {
    console.error(
      `[audit] falha ao registrar "${action}":`,
      error instanceof Error ? error.message : error,
    );
  }
}
