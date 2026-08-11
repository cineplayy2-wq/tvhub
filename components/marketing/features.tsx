"use client";

import { motion } from "framer-motion";
import {
  Ban,
  MonitorPlay,
  Rewind,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

const EASE = [0.32, 0.72, 0, 1] as const;

const FEATURES = [
  {
    icon: MonitorPlay,
    title: "2 telas ao mesmo tempo",
    description:
      "Você e mais alguém, cada um no seu filme. Sem brigar pelo controle.",
  },
  {
    icon: Ban,
    title: "Zero anúncios",
    description:
      "Nenhum plano tem propaganda. Nem o mais barato, nem em nenhum momento.",
  },
  {
    icon: Users,
    title: "Até 4 perfis",
    description:
      "Histórico separado para cada um, com perfil infantil e trava por PIN.",
  },
  {
    icon: Sparkles,
    title: "Full HD real",
    description:
      "Streaming adaptativo: a qualidade sobe até onde sua conexão aguenta.",
  },
  {
    icon: Rewind,
    title: "Continue de onde parou",
    description:
      "Comece na TV, termine no celular. O ponto exato viaja com você.",
  },
  {
    icon: Wallet,
    title: "Cancele em um clique",
    description:
      "Sem fidelidade, sem ligação, sem retenção. Você entra e sai quando quiser.",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-[100rem] px-5 py-28 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            <span className="h-px w-8 bg-primary" aria-hidden />
            Por que o HUBFLIX
          </p>
          <h2 className="mt-6 text-balance font-display text-display-sm uppercase leading-[0.95] tracking-tightest text-foreground">
            O básico bem feito, sem pegadinha
          </h2>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-muted">
            Nada de plano barato com anúncio, nem qualidade reduzida escondida
            na letra miúda. O que está escrito é o que você recebe.
          </p>
        </div>

        {/* Grade com bordas internas: a linha entre os itens organiza a leitura
            melhor que espaçamento sozinho, e sustenta o tom editorial. */}
        <div className="grid border-t border-border sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: (index % 2) * 0.08, ease: EASE }}
              className="group border-b border-border py-8 pr-6 sm:odd:border-r sm:odd:pr-10 sm:even:pl-10"
            >
              <feature.icon
                className="h-5 w-5 text-primary transition-transform duration-500 ease-smooth group-hover:-translate-y-0.5"
                strokeWidth={1.75}
                aria-hidden
              />
              <h3 className="mt-5 text-[15px] font-medium text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
