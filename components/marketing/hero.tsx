"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";

type HeroProps = {
  /** Menor preço mensal equivalente, para a âncora "a partir de". */
  fromPriceCents: number;
  /** Quantidade real de títulos publicados — número vazio soa falso. */
  titleCount: number;
};

const EASE = [0.32, 0.72, 0, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

export function Hero({ fromPriceCents, titleCount }: HeroProps) {
  return (
    <section className="film-grain relative isolate flex min-h-[88vh] flex-col justify-end overflow-hidden pb-14 pt-32">
      {/* Luz de projeção: único ponto quente da tela, atrás do texto */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-25%] -z-10 h-[80vh] w-[130vw] -translate-x-1/2 rounded-[50%] opacity-[0.18] blur-[130px]"
        style={{
          background:
            "radial-gradient(ellipse at center, #E8B44C 0%, transparent 62%)",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-[100rem] px-5 sm:px-8"
      >
        <motion.div
          variants={rise}
          className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary"
        >
          <span className="h-px w-8 bg-primary" aria-hidden />
          Sem anúncio · Sem fidelidade · Sem cartão
        </motion.div>

        {/*
          O título é o produto visual da página. Escala fluida em clamp() —
          nunca estoura no celular, nunca fica tímido no monitor grande.
          overflow-hidden + y no filho: cada linha "sobe de dentro" da anterior.
        */}
        <h1 className="mt-6">
          <span className="sr-only">
            Chega de pagar para ver anúncio.
          </span>

          <span aria-hidden className="block">
            {[
              { text: "Chega de", tone: "text-foreground" },
              { text: "pagar para", tone: "text-foreground" },
              { text: "ver anúncio", tone: "text-primary" },
            ].map((line) => (
              // overflow-hidden no pai + y no filho: cada linha sobe de dentro
              // da anterior, em vez de simplesmente aparecer
              <span key={line.text} className="block overflow-hidden">
                <motion.span
                  variants={rise}
                  className={`block font-display text-display-md uppercase leading-[0.86] tracking-tightest ${line.tone}`}
                >
                  {line.text}
                </motion.span>
              </span>
            ))}
          </span>
        </h1>

        <div className="mt-10 flex flex-col gap-8 border-t border-border pt-8 lg:flex-row lg:items-end lg:justify-between">
          <motion.p
            variants={rise}
            className="max-w-lg text-balance text-base leading-relaxed text-muted sm:text-lg"
          >
            {titleCount > 0 ? `${titleCount} títulos` : "Catálogo completo"} em
            Full HD, <span className="text-foreground">2 telas ao mesmo tempo</span>{" "}
            e nenhuma propaganda — em todos os planos. Você paga no PIX, sem
            cartão salvo e sem débito automático.
          </motion.p>

          <motion.div variants={rise} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/cadastro"
                className={cn(
                  buttonVariants({ variant: "primary", size: "lg" }),
                  "group",
                )}
              >
                Quero assinar
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 ease-smooth group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
              <Link
                href="#planos"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <Play className="h-4 w-4" aria-hidden />
                Ver preços
              </Link>
            </div>

            <p className="text-xs text-muted-foreground lg:text-right">
              A partir de{" "}
              <span className="font-medium text-muted">
                {formatPrice(fromPriceCents)}
              </span>{" "}
              por mês · Cancele quando quiser
            </p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
