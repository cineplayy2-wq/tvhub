"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";

const EASE = [0.32, 0.72, 0, 1] as const;

export function FinalCta({ fromPriceCents }: { fromPriceCents: number }) {
  return (
    <section className="film-grain relative overflow-hidden border-t border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 bottom-[-40%] h-[70vh] w-[120vw] -translate-x-1/2 rounded-[50%] opacity-[0.14] blur-[130px]"
        style={{
          background:
            "radial-gradient(ellipse at center, #E8B44C 0%, transparent 62%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative mx-auto max-w-[100rem] px-5 py-32 text-center sm:px-8"
      >
        <h2 className="mx-auto max-w-4xl text-balance font-display text-display-md uppercase leading-[0.9] tracking-tightest text-foreground">
          Aperte play hoje.
          <span className="block text-muted-foreground">
            Cancele amanhã se quiser.
          </span>
        </h2>

        <p className="mx-auto mt-8 max-w-lg text-balance text-base leading-relaxed text-muted">
          Sem fidelidade, sem multa e sem ligação de retenção. O botão de
          cancelar fica na sua conta, a um clique — e o acesso vale até o fim do
          período que você já pagou.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/cadastro"
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "group",
            )}
          >
            Assinar por {formatPrice(fromPriceCents)}/mês
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 ease-smooth group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Pagamento por PIX · Nada é debitado automaticamente · Você aprova cada
          cobrança
        </p>
      </motion.div>
    </section>
  );
}
