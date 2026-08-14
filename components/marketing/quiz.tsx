"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";

import { registrarRespostaQuizAction } from "@/app/actions/quiz";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Quiz de campanha — três passos, uma pergunta por tela.
 *
 * O formato existe por um motivo de conversão, não de estética: formulário
 * longo tem abandono alto porque a pessoa vê o custo todo de uma vez. Uma
 * pergunta por tela esconde esse custo e usa compromisso progressivo — quem
 * respondeu a primeira tende a terminar.
 *
 * O e-mail vem POR ÚLTIMO, e só depois de a pessoa já ter investido três
 * cliques. Pedir e-mail na primeira tela derruba a taxa pela metade.
 *
 * As respostas são gravadas no banco e aparecem em Admin → Quiz. Servem para
 * duas coisas: lista de contatos aquecidos e leitura de qual dor mais aparece
 * — que é o que deve virar o título do próximo criativo.
 */

const EASE = [0.32, 0.72, 0, 1] as const;

type Opcao = { id: string; rotulo: string; nota?: string };
type Passo = { chave: string; pergunta: string; sub: string; opcoes: Opcao[] };

const PASSOS: Passo[] = [
  {
    chave: "perfil",
    pergunta: "O que você mais assiste?",
    sub: "Assim já te mostramos o que interessa.",
    opcoes: [
      { id: "filmes", rotulo: "Filmes e séries", nota: "Lançamentos e maratona" },
      { id: "esportes", rotulo: "Esporte ao vivo", nota: "Campeonatos e jogos" },
      { id: "canais", rotulo: "Canais ao vivo", nota: "Novelas, notícias, variedades" },
      { id: "familia", rotulo: "Um pouco de tudo", nota: "A casa inteira assiste" },
    ],
  },
  {
    chave: "gasto",
    pergunta: "Quanto você paga hoje por mês?",
    sub: "Somando tudo que você assina para assistir.",
    opcoes: [
      { id: "ate50", rotulo: "Até R$ 50" },
      { id: "50a120", rotulo: "Entre R$ 50 e R$ 120" },
      { id: "120a250", rotulo: "Entre R$ 120 e R$ 250" },
      { id: "mais250", rotulo: "Mais de R$ 250" },
    ],
  },
  {
    chave: "telas",
    pergunta: "Quantas pessoas assistem na sua casa?",
    sub: "Isso define quantas telas você precisa ao mesmo tempo.",
    opcoes: [
      { id: "1", rotulo: "Só eu" },
      { id: "2", rotulo: "Duas pessoas" },
      { id: "3mais", rotulo: "Três ou mais" },
    ],
  },
];

export function Quiz({ fromPriceCents }: { fromPriceCents: number }) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = PASSOS.length + 1; // +1 = tela do e-mail
  const progresso = Math.round((passo / total) * 100);
  const naTelaFinal = passo === PASSOS.length;

  const responder = (chave: string, valor: string) => {
    setRespostas((r) => ({ ...r, [chave]: valor }));
    // Avanço automático: um clique a menos por pergunta, três a menos no total.
    setTimeout(() => setPasso((p) => p + 1), 220);
  };

  const enviar = async () => {
    setErro(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErro("Confira o e-mail — parece que falta alguma coisa.");
      return;
    }

    setEnviando(true);
    const resultado = await registrarRespostaQuizAction({
      email: email.trim(),
      respostas,
    });
    setEnviando(false);

    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não consegui salvar agora. Tente de novo.");
      return;
    }

    // Leva direto para o cadastro com o e-mail já preenchido: cada campo que a
    // pessoa não precisa digitar de novo é conversão que não se perde.
    router.push(`/cadastro?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:py-24">
      {/* Progresso */}
      <div className="mb-10">
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <span>
            Passo {Math.min(passo + 1, total)} de {total}
          </span>
          <span>{progresso}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(6, progresso)}%` }}
            transition={{ duration: 0.5, ease: EASE }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!naTelaFinal ? (
          <motion.div
            key={PASSOS[passo].chave}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <h1 className="font-display text-4xl uppercase leading-[0.95] tracking-tightest text-foreground sm:text-5xl">
              {PASSOS[passo].pergunta}
            </h1>
            <p className="mt-3 text-sm text-muted sm:text-base">{PASSOS[passo].sub}</p>

            <div className="mt-8 grid gap-3">
              {PASSOS[passo].opcoes.map((opcao, i) => {
                const escolhida = respostas[PASSOS[passo].chave] === opcao.id;
                return (
                  <motion.button
                    key={opcao.id}
                    type="button"
                    onClick={() => responder(PASSOS[passo].chave, opcao.id)}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: EASE, delay: i * 0.06 }}
                    className={cn(
                      "group flex items-center justify-between gap-4 rounded-2xl border p-5 text-left transition-all duration-200",
                      escolhida
                        ? "border-primary bg-primary/[0.12]"
                        : "border-white/[0.08] bg-surface/40 hover:border-primary/50 hover:bg-surface/70",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-foreground">
                        {opcao.rotulo}
                      </span>
                      {opcao.nota && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {opcao.nota}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all",
                        escolhida
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-white/15 text-muted-foreground group-hover:border-primary/60 group-hover:text-accent",
                      )}
                      aria-hidden
                    >
                      {escolhida ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="final"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.10] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Encontramos seu plano
            </div>

            <h1 className="font-display text-4xl uppercase leading-[0.95] tracking-tightest text-foreground sm:text-5xl">
              Pronto.
              <br />
              <span className="text-accent">Onde eu te mando?</span>
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              Seu acesso sai por{" "}
              <span className="font-semibold text-foreground">
                {formatPrice(fromPriceCents)}
              </span>{" "}
              por mês — tudo num lugar só, 2 telas ao mesmo tempo e sem anúncio.
              Deixe o e-mail e a gente já abre seu cadastro.
            </p>

            <div className="mt-8">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void enviar()}
                placeholder="seu@email.com"
                aria-label="Seu e-mail"
                className="w-full rounded-2xl border border-white/[0.10] bg-surface/60 px-5 py-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              {erro && (
                <p className="mt-2 text-sm font-medium text-danger">{erro}</p>
              )}

              <button
                type="button"
                onClick={() => void enviar()}
                disabled={enviando}
                className={cn(
                  buttonVariants({ variant: "primary", size: "lg" }),
                  "group mt-4 w-full justify-center disabled:opacity-70",
                )}
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    Criar meu acesso
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-smooth group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Sem cartão agora. Você escolhe o plano no próximo passo.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {passo > 0 && (
        <button
          type="button"
          onClick={() => setPasso((p) => Math.max(0, p - 1))}
          className="mt-8 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      )}
    </div>
  );
}
