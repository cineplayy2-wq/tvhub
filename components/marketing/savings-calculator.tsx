"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Calculadora de economia — o argumento central da página.
 *
 * A tese "tudo num lugar só" convence pouco dita como frase e muito mostrada
 * como CONTA. A pessoa marca o que já assina, vê o total do próprio bolso e
 * compara com um número só. O trabalho de persuasão é feito pelo dado dela,
 * não pelo nosso adjetivo.
 *
 * ------------------------------------------------------------------
 * POR QUE NÃO USAMOS OS LOGOS NEM O NOME DAS PLATAFORMAS
 * ------------------------------------------------------------------
 * Duas razões práticas, ambas custam campanha:
 *
 * 1. Meta e Google reprovam criativo que usa marca de terceiro sem
 *    autorização. Um anúncio com esses logos é reprovado na revisão, e conta
 *    que insiste leva restrição.
 * 2. Citar as marcas ao lado da nossa sugere vínculo que não existe.
 *
 * A conta funciona igual sem os nomes — o que convence é o TOTAL, e a pessoa
 * sabe perfeitamente o que ela assina. Os rótulos abaixo descrevem o TIPO de
 * serviço, que é fato e não é marca de ninguém.
 */

type Servico = {
  id: string;
  rotulo: string;
  descricao: string;
  /** Mensalidade típica no Brasil, em centavos. Ajuste conforme o mercado. */
  centavos: number;
};

const SERVICOS: Servico[] = [
  { id: "filmes-1", rotulo: "Streaming de filmes e séries", descricao: "O grandão, com originais", centavos: 5990 },
  { id: "filmes-2", rotulo: "Segundo streaming", descricao: "Aquele que você assina só por uma série", centavos: 3490 },
  { id: "infantil", rotulo: "Streaming infantil", descricao: "Desenhos e animação para as crianças", centavos: 4390 },
  { id: "esportes", rotulo: "Pacote de esportes", descricao: "Campeonatos e jogos ao vivo", centavos: 6990 },
  { id: "canais", rotulo: "TV por assinatura", descricao: "Canais ao vivo, notícias e novelas", centavos: 9990 },
  { id: "premium", rotulo: "Canal premium de cinema", descricao: "Lançamentos e clássicos", centavos: 4990 },
];

const EASE = [0.32, 0.72, 0, 1] as const;

export function SavingsCalculator({
  /** Menor mensalidade equivalente entre os planos reais do banco. */
  fromPriceCents,
}: {
  fromPriceCents: number;
}) {
  // Começa com os três mais comuns marcados: tela vazia não comunica nada, e
  // a pessoa desmarca mais rápido do que marca.
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(["filmes-1", "canais", "esportes"]),
  );

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const copia = new Set(atual);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });

  const { totalMes, totalAno, economiaMes, economiaAno } = useMemo(() => {
    const mes = SERVICOS.filter((s) => marcados.has(s.id)).reduce(
      (soma, s) => soma + s.centavos,
      0,
    );
    return {
      totalMes: mes,
      totalAno: mes * 12,
      economiaMes: Math.max(0, mes - fromPriceCents),
      economiaAno: Math.max(0, (mes - fromPriceCents) * 12),
    };
  }, [marcados, fromPriceCents]);

  return (
    <section id="economia" className="relative isolate overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[60vh] w-[110vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] opacity-[0.14] blur-[130px]"
        style={{ background: "radial-gradient(ellipse at center, #B569D2 0%, transparent 62%)" }}
      />

      <div className="mx-auto w-full max-w-[100rem] px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="max-w-2xl"
        >
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            <span className="h-px w-8 bg-accent" aria-hidden />
            Faça a conta
          </p>
          <h2 className="mt-6 font-display text-display-sm uppercase leading-[0.9] tracking-tightest text-foreground">
            Quanto você paga
            <br />
            <span className="text-accent">para assistir hoje?</span>
          </h2>
          <p className="mt-5 text-balance text-base leading-relaxed text-muted sm:text-lg">
            Marque o que já cai na sua fatura todo mês. A conta é sua — a gente
            só coloca do lado o que você pagaria aqui.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          {/* Seleção */}
          <div className="grid gap-3 sm:grid-cols-2">
            {SERVICOS.map((servico, i) => {
              const ativo = marcados.has(servico.id);
              return (
                <motion.button
                  key={servico.id}
                  type="button"
                  onClick={() => alternar(servico.id)}
                  aria-pressed={ativo}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.05 }}
                  className={cn(
                    "group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-300",
                    ativo
                      ? "border-primary/60 bg-primary/[0.08] shadow-[0_0_28px_-12px_rgba(124,42,158,0.8)]"
                      : "border-white/[0.08] bg-surface/40 hover:border-white/[0.16] hover:bg-surface/70",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                      ativo
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/20 text-transparent group-hover:border-white/40",
                    )}
                    aria-hidden
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {servico.rotulo}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {servico.descricao}
                    </span>
                  </span>

                  <span className="shrink-0 font-mono text-sm tabular-nums text-muted">
                    {formatPrice(servico.centavos)}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Resultado */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            className="lg:sticky lg:top-24 lg:self-start"
          >
            <div className="overflow-hidden rounded-3xl border border-white/[0.10] bg-gradient-to-b from-surface-elevated/80 to-surface/40 p-7 backdrop-blur-xl sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Você paga hoje
              </p>

              <div className="mt-2 flex items-baseline gap-2">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={totalMes}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="font-display text-[3.25rem] leading-none tracking-tightest text-foreground line-through decoration-danger/70 decoration-[3px]"
                  >
                    {formatPrice(totalMes)}
                  </motion.span>
                </AnimatePresence>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>

              <div className="mt-6 h-px w-full bg-white/[0.08]" />

              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                Aqui você paga
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-[3.75rem] leading-none tracking-tightest text-accent">
                  {formatPrice(fromPriceCents)}
                </span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>

              <AnimatePresence>
                {economiaMes > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 rounded-2xl border border-success/25 bg-success/[0.08] p-4">
                      <p className="text-xs font-medium text-muted">
                        Sobra no seu bolso
                      </p>
                      <p className="mt-1 font-display text-2xl tracking-tight text-success">
                        {formatPrice(economiaMes)}
                        <span className="ml-1.5 text-sm font-sans font-normal text-muted-foreground">
                          por mês
                        </span>
                      </p>
                      <p className="mt-1 text-sm font-semibold text-success/90">
                        {formatPrice(economiaAno)} por ano
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Link
                href="/cadastro"
                className={cn(
                  buttonVariants({ variant: "primary", size: "lg" }),
                  "group mt-6 w-full justify-center",
                )}
              >
                Quero economizar isso
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 ease-smooth group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                PIX · Sem cartão salvo · Cancele quando quiser
              </p>
            </div>
          </motion.div>
        </div>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          Valores de referência do mercado brasileiro, usados apenas para
          comparação. Confira o preço atual de cada serviço que você assina.
        </p>
      </div>
    </section>
  );
}
