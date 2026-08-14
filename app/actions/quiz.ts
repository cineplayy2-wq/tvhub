"use server";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Recebe a resposta do quiz de campanha.
 *
 * Rota PÚBLICA — é o ponto de entrada de anúncio, então quem chega aqui não
 * tem sessão. Isso obriga a tratá-la como entrada hostil:
 *
 * - rate limit por e-mail e um teto global, senão um laço enche a tabela e
 *   estraga a leitura da campanha (que é o valor real do dado);
 * - todo campo cortado no tamanho, porque nada aqui é validado por sessão;
 * - respostas restritas às chaves que o quiz conhece, para o JSON não virar
 *   depósito de texto arbitrário.
 */

export type QuizResultado = { ok: boolean; erro?: string };

/** As mesmas chaves de `components/marketing/quiz.tsx`. */
const CHAVES_ACEITAS = new Set(["perfil", "gasto", "telas"]);

export async function registrarRespostaQuizAction(entrada: {
  email: string;
  respostas: Record<string, string>;
}): Promise<QuizResultado> {
  const email = String(entrada?.email ?? "").trim().toLowerCase().slice(0, 254);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, erro: "E-mail inválido." };
  }

  const porEmail = await rateLimit("quiz", email, 5, 60 * 60);
  const global = await rateLimit("quiz-global", "todos", 500, 60 * 60);
  if (!porEmail.allowed || !global.allowed) {
    // Responde OK de propósito: quem está abusando não precisa saber que
    // existe um teto, e quem é gente de verdade não chega nele.
    return { ok: true };
  }

  const respostas: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(entrada?.respostas ?? {})) {
    if (!CHAVES_ACEITAS.has(chave)) continue;
    if (typeof valor !== "string") continue;
    respostas[chave] = valor.slice(0, 40);
  }

  try {
    await prisma.quizLead.upsert({
      where: { email },
      // Refazer o quiz atualiza a resposta em vez de duplicar a pessoa na
      // lista — contato repetido estraga tanto a métrica quanto o disparo.
      update: { respostas, atualizadoEm: new Date() },
      create: { email, respostas },
    });
  } catch (erro) {
    console.error("[quiz] falha ao gravar:", erro);
    // O lead é importante, mas não a ponto de travar a jornada: a pessoa segue
    // para o cadastro de qualquer forma.
    return { ok: true };
  }

  return { ok: true };
}
