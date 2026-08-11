import "server-only";

import { prisma } from "@/lib/prisma";
import type { PlanCard } from "@/types";

/**
 * Espelho dos planos do seed. Serve de fallback para a landing continuar
 * vendável se o banco estiver fora do ar — uma home 500 custa conversão,
 * e o preço aqui é o mesmo que o checkout vai cobrar (validado no servidor).
 */
const FALLBACK_PLANS: PlanCard[] = [
  {
    id: "fallback-mensal",
    slug: "mensal",
    name: "Mensal",
    description: "Flexibilidade total. Cancele quando quiser.",
    priceCents: 2990,
    compareAtPriceCents: null,
    interval: "MONTH",
    deviceLimit: 2,
    maxProfiles: 4,
    features: [
      "Catálogo completo",
      "2 telas simultâneas",
      "Até 4 perfis",
      "Full HD, sem anúncios",
      "Cancele quando quiser",
    ],
    isHighlighted: false,
  },
  {
    id: "fallback-anual",
    slug: "anual",
    name: "Anual",
    description: "O melhor custo-benefício: pague uma vez, assista o ano todo.",
    priceCents: 19700,
    compareAtPriceCents: 35880,
    interval: "YEAR",
    deviceLimit: 2,
    maxProfiles: 4,
    features: [
      "Tudo do plano Mensal",
      "Equivale a R$ 16,42 por mês",
      "Economia de R$ 161,80 no ano",
      "Preço travado por 12 meses",
    ],
    isHighlighted: true,
  },
];

export async function getPublicPlans(): Promise<PlanCard[]> {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        priceCents: true,
        compareAtPriceCents: true,
        interval: true,
        features: true,
        deviceLimit: true,
        maxProfiles: true,
      },
    });

    if (plans.length === 0) return FALLBACK_PLANS;

    return plans.map((plan) => ({
      ...plan,
      // Destaca o anual: é o plano com melhor LTV
      isHighlighted: plan.interval === "YEAR",
    }));
  } catch (error) {
    // Só a mensagem: o stack do Prisma polui o log a cada request da home
    console.error(
      "[plans] banco indisponível, usando fallback:",
      error instanceof Error ? error.message.split("\n")[0] : error,
    );
    return FALLBACK_PLANS;
  }
}
