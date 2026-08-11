"use client";

import { motion } from "framer-motion";

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Seção de agitação do problema.
 *
 * Toda afirmação aqui é sobre PRÁTICAS PÚBLICAS do mercado (plano com
 * anúncio, cobrança por tela extra, reajuste na renovação) ou sobre regras
 * reais do HUBFLIX. Nenhuma estatística inventada e nenhum concorrente citado
 * pelo nome: número falso em landing é dívida, e comparação nominal com preço
 * envelhece em semanas.
 */
export function Manifesto() {
  return (
    <section className="border-y border-border bg-surface/30">
      <div className="mx-auto max-w-[100rem] px-5 py-28 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-24">
          <div>
            <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-danger">
              <span className="h-px w-8 bg-danger" aria-hidden />
              O problema
            </p>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: EASE }}
              className="mt-6 max-w-3xl text-balance font-display text-display-sm uppercase leading-[0.95] tracking-tightest text-foreground"
            >
              Você começou pagando por conteúdo.
              <span className="block text-danger">Hoje paga por anúncio.</span>
            </motion.h2>
          </div>

          <div className="space-y-6 text-base leading-relaxed text-muted lg:pt-24">
            <p>
              Primeiro o preço subiu. Depois criaram um plano mais barato{" "}
              <span className="text-foreground">com propaganda no meio do filme</span>{" "}
              — e o que você já pagava virou &ldquo;o caro&rdquo;.
            </p>
            <p>
              Aí veio o limite de telas, a cobrança por usuário extra e o
              reajuste que aparece sozinho na renovação.
            </p>
            <p className="text-foreground">
              Nada disso melhorou um único filme.
            </p>
          </div>
        </div>

        {/* Contraponto direto: cada número abaixo é regra do sistema, não promessa */}
        <div className="mt-20 grid gap-px border-t border-border md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="border-b border-border py-12 md:border-b-0 md:border-r md:pr-14"
          >
            <div className="font-display text-stat uppercase leading-none tracking-tightest text-primary">
              Zero
            </div>
            <p className="mt-5 max-w-[38ch] text-base leading-relaxed text-muted">
              anúncios. Em <span className="text-foreground">todos</span> os
              planos, inclusive o mais barato. Aqui não existe versão com
              propaganda porque não existe propaganda.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            className="py-12 md:pl-14"
          >
            <div className="font-display text-stat uppercase leading-none tracking-tightest text-primary">
              2 telas
            </div>
            <p className="mt-5 max-w-[38ch] text-base leading-relaxed text-muted">
              incluídas no preço base. Não é upgrade, não é pacote adicional e
              não é &ldquo;usuário extra&rdquo;. Já vem com a assinatura.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
