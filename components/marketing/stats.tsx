"use client";

import { motion } from "framer-motion";

const EASE = [0.32, 0.72, 0, 1] as const;

type Stat = { value: string; label: string };

/**
 * Bloco de números grandes.
 *
 * Toda métrica aqui é verificável no próprio produto — quantidade de títulos
 * vem do banco, e as demais são regras do sistema (2 telas, 4 perfis, zero
 * anúncios). Número inventado em landing é dívida: alguém confere.
 */
export function Stats({ titleCount }: { titleCount: number }) {
  const stats: Stat[] = [
    {
      value: titleCount > 0 ? String(titleCount) : "—",
      label: "títulos no catálogo, com lançamentos toda semana",
    },
    { value: "0", label: "anúncios — em qualquer plano, em qualquer momento" },
    { value: "2", label: "telas simultâneas, sem cobrança extra por isso" },
    { value: "4", label: "perfis por conta, com histórico separado" },
  ];

  return (
    <section className="border-y border-border">
      <div className="mx-auto grid max-w-[100rem] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: index * 0.07, ease: EASE }}
            className="border-b border-border p-8 last:border-b-0 sm:p-10 lg:border-b-0 lg:border-r lg:last:border-r-0"
          >
            <div className="font-display text-stat uppercase leading-none tracking-tightest text-primary">
              {stat.value}
            </div>
            <p className="mt-4 max-w-[22ch] text-sm leading-relaxed text-muted">
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
