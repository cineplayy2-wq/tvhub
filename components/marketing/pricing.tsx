"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { PlanCard } from "@/types";
import {
  cn,
  discountPercent,
  formatMonthlyEquivalent,
  formatPrice,
} from "@/lib/utils";

const EASE = [0.32, 0.72, 0, 1] as const;

export function Pricing({ plans }: { plans: PlanCard[] }) {
  return (
    <section
      id="planos"
      className="film-grain relative scroll-mt-20 overflow-hidden px-5 py-28 sm:px-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[60vh] w-[110vw] -translate-x-1/2 rounded-[50%] opacity-[0.10] blur-[130px]"
        style={{
          background:
            "radial-gradient(ellipse at center, #B569D2 0%, transparent 62%)",
        }}
      />

      <div className="mx-auto max-w-[100rem]">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            Planos
          </p>
          <h2 className="mt-6 text-balance font-display text-display-sm uppercase leading-[0.95] tracking-tightest text-foreground">
            Dois planos, mesmo catálogo
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-base text-muted">
            A única diferença é quanto você paga por mês. Nenhum recurso fica de
            fora no plano mais barato.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-5 md:grid-cols-2">
          {plans.map((plan, index) => {
            const isYearly = plan.interval === "YEAR";
            const discount =
              plan.compareAtPriceCents && isYearly
                ? discountPercent(plan.priceCents, plan.compareAtPriceCents)
                : 0;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: index * 0.1, ease: EASE }}
                className={cn(
                  "relative flex flex-col rounded-xl border p-8 transition-colors duration-300",
                  plan.isHighlighted
                    ? "border-primary/60 bg-surface"
                    : "border-border bg-surface/40 hover:border-border-strong",
                )}
              >
                {plan.isHighlighted && discount > 0 && (
                  <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                    Economize {discount}%
                  </span>
                )}

                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {plan.name}
                </h3>

                <div className="mt-6 flex items-end gap-2">
                  <span className="font-display text-display-sm uppercase leading-[0.85] tracking-tightest text-foreground">
                    {isYearly
                      ? formatMonthlyEquivalent(plan.priceCents)
                      : formatPrice(plan.priceCents)}
                  </span>
                  <span className="pb-2 text-sm text-muted-foreground">
                    /mês
                  </span>
                </div>

                {/* O anual é cobrado de uma vez. Dizer isso aqui, e não no
                    checkout, é o que evita chargeback e reclamação depois. */}
                <p className="mt-3 text-xs text-muted-foreground">
                  {isYearly ? (
                    <>
                      {formatPrice(plan.priceCents)} cobrados uma vez por ano
                      {plan.compareAtPriceCents && (
                        <>
                          {" · "}
                          <span className="line-through">
                            {formatPrice(plan.compareAtPriceCents)}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    "Cobrado mensalmente"
                  )}
                </p>

                <ul className="mt-8 flex-1 space-y-3 border-t border-border pt-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="text-sm text-muted">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/cadastro?plano=${plan.slug}`}
                  className={cn(
                    buttonVariants({
                      variant: plan.isHighlighted ? "primary" : "outline",
                      size: "lg",
                      fullWidth: true,
                    }),
                    "mt-8",
                  )}
                >
                  Assinar {plan.name.toLowerCase()}
                </Link>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Pagamento via PIX · Sem fidelidade · Cancele quando quiser
        </p>
      </div>
    </section>
  );
}
