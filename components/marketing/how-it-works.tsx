"use client";

import { motion } from "framer-motion";

const EASE = [0.32, 0.72, 0, 1] as const;

const STEPS = [
  {
    number: "01",
    title: "Escolha o plano",
    description:
      "Mensal ou anual, mesmo catálogo. O pagamento é por PIX e você aprova cada cobrança — nada é debitado sozinho.",
  },
  {
    number: "02",
    title: "Crie sua conta",
    description:
      "E-mail e senha, sem formulário longo. Seu primeiro perfil já vem criado para você não cair numa tela vazia.",
  },
  {
    number: "03",
    title: "Aperte play",
    description:
      "Funciona no navegador da TV, do celular e do computador. Parou num aparelho, retoma no outro do ponto exato.",
  },
];

/**
 * Banda invertida.
 *
 * Não é light mode — a área logada e o player seguem escuros. É um recurso de
 * ritmo: preto contínuo do topo ao rodapé achata a página e faz tudo parecer a
 * mesma seção. Uma quebra clara no meio reorganiza a leitura.
 */
export function HowItWorks() {
  return (
    <section className="bg-invert text-invert-foreground">
      <div className="mx-auto max-w-[100rem] px-5 py-28 sm:px-8">
        <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-invert-muted">
          <span className="h-px w-8 bg-invert-muted" aria-hidden />
          Como funciona
        </p>

        <h2 className="mt-6 max-w-3xl text-balance font-display text-display-sm uppercase leading-[0.95] tracking-tightest">
          Do cadastro ao play em menos de dois minutos
        </h2>

        <ol className="mt-16 grid gap-px border-t border-invert-border md:grid-cols-3">
          {STEPS.map((step, index) => (
            <motion.li
              key={step.number}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: EASE }}
              className="border-b border-invert-border py-10 md:border-b-0 md:border-r md:pr-10 md:last:border-r-0 md:[&:not(:first-child)]:pl-10"
            >
              <span className="font-display text-5xl leading-none tracking-tightest text-invert-foreground/25">
                {step.number}
              </span>
              <h3 className="mt-6 text-lg font-semibold tracking-display">
                {step.title}
              </h3>
              <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-invert-muted">
                {step.description}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
