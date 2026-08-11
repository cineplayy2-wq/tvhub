import "server-only";

import { prisma } from "@/lib/prisma";
import { STREAM } from "@/lib/constants";

export type SubscriptionState = {
  isActive: boolean;
  status: string | null;
  planName: string | null;
  /** Limite de telas simultâneas do plano vigente. */
  deviceLimit: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Fonte única da pergunta "esta conta pode assistir?".
 *
 * PAST_DUE conta como ativo de propósito: é o período de graça entre o
 * vencimento e o corte. Cortar no primeiro dia de atraso gera cancelamento
 * por irritação em quem só esqueceu de pagar o PIX.
 */
export async function getSubscriptionState(
  userId: string,
): Promise<SubscriptionState> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      plan: { select: { name: true, deviceLimit: true } },
    },
  });

  if (!subscription) {
    return {
      isActive: false,
      status: null,
      planName: null,
      deviceLimit: STREAM.DEFAULT_DEVICE_LIMIT,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  const withinPeriod =
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd.getTime() > Date.now();

  const hasAccessStatus =
    subscription.status === "ACTIVE" ||
    subscription.status === "TRIALING" ||
    subscription.status === "PAST_DUE";

  return {
    isActive: hasAccessStatus && withinPeriod,
    status: subscription.status,
    planName: subscription.plan.name,
    deviceLimit: subscription.plan.deviceLimit,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}
