import type { Metadata } from "next";

import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Manifesto } from "@/components/marketing/manifesto";
import { Pricing } from "@/components/marketing/pricing";
import { SavingsCalculator } from "@/components/marketing/savings-calculator";
import { Showcase } from "@/components/marketing/showcase";
import { Stats } from "@/components/marketing/stats";
import { Ticker } from "@/components/marketing/ticker";
import { getPublicPlans } from "@/lib/queries/plans";
import { getShowcaseTitles } from "@/lib/queries/catalog";
import { countPublishedTitles } from "@/lib/queries/catalog";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
};

/**
 * Renderização por requisição, não ISR.
 *
 * Com `revalidate`, o Next prerenderiza esta página durante o build — e o build
 * roda na máquina de desenvolvimento, sem acesso ao banco da VPS. O resultado
 * era catálogo vazio e preços de fallback congelados no HTML publicado.
 * As queries são baratas e todas têm fallback se o banco cair.
 */
export const dynamic = "force-dynamic";

const TICKER_ITEMS = [
  "Sem anúncio",
  "2 telas",
  "Full HD",
  "Sem fidelidade",
  "Até 4 perfis",
  "Pagamento por PIX",
];

export default async function LandingPage() {
  const [plans, titles, titleCount] = await Promise.all([
    getPublicPlans(),
    getShowcaseTitles(14),
    countPublishedTitles(),
  ]);

  // Âncora "a partir de": menor mensalidade equivalente entre os planos
  const fromPriceCents = Math.min(
    ...plans.map((plan) =>
      plan.interval === "YEAR"
        ? Math.round(plan.priceCents / 12)
        : plan.priceCents,
    ),
  );

  return (
    <>
      <AnnouncementBar label="Cancele quando quiser · Sem fidelidade" />
      <Hero fromPriceCents={fromPriceCents} titleCount={titleCount} />
      <Ticker items={TICKER_ITEMS} variant="accent" />
      <SavingsCalculator fromPriceCents={fromPriceCents} />
      <Showcase titles={titles} />
      <Manifesto />
      <Features />
      <Stats titleCount={titleCount} />
      <HowItWorks />
      <Pricing plans={plans} />
      <Faq />
      <FinalCta fromPriceCents={fromPriceCents} />
    </>
  );
}
