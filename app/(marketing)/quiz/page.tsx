import type { Metadata } from "next";

import { Quiz } from "@/components/marketing/quiz";
import { getPublicPlans } from "@/lib/queries/plans";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Descubra seu plano — ${SITE.name}`,
  description:
    "Três perguntas rápidas e a gente mostra quanto você economiza trocando várias assinaturas por uma só.",
  // Página de campanha não deve competir com a home no orgânico: ela existe
  // para receber tráfego pago, e indexá-la divide autoridade sem ganho.
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function QuizPage() {
  const plans = await getPublicPlans();

  const fromPriceCents = plans.length
    ? Math.min(
        ...plans.map((plan) =>
          plan.interval === "YEAR" ? Math.round(plan.priceCents / 12) : plan.priceCents,
        ),
      )
    : 0;

  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-20%] -z-10 h-[70vh] w-[120vw] -translate-x-1/2 rounded-[50%] opacity-[0.16] blur-[130px]"
        style={{ background: "radial-gradient(ellipse at center, #B569D2 0%, transparent 62%)" }}
      />
      <Quiz fromPriceCents={fromPriceCents} />
    </main>
  );
}
