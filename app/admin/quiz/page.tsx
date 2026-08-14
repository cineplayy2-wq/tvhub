import { Users } from "lucide-react";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Leitura do quiz de campanha.
 *
 * O valor aqui não é a lista de e-mails — é a DISTRIBUIÇÃO das respostas. Se
 * 70% marcam "mais de R$ 250", o próximo criativo fala de dinheiro; se a
 * maioria marca "esporte ao vivo", ele fala de jogo. A tabela embaixo é o
 * contato; os gráficos em cima são a decisão.
 */

const ROTULOS: Record<string, Record<string, string>> = {
  perfil: {
    filmes: "Filmes e séries",
    esportes: "Esporte ao vivo",
    canais: "Canais ao vivo",
    familia: "Um pouco de tudo",
  },
  gasto: {
    ate50: "Até R$ 50",
    "50a120": "R$ 50 a 120",
    "120a250": "R$ 120 a 250",
    mais250: "Mais de R$ 250",
  },
  telas: { "1": "Só eu", "2": "Duas pessoas", "3mais": "Três ou mais" },
};

const TITULOS: Record<string, string> = {
  perfil: "O que mais assiste",
  gasto: "Quanto paga hoje",
  telas: "Pessoas na casa",
};

export default async function AdminQuizPage() {
  await requireAdmin();

  const leads = await prisma.quizLead.findMany({
    orderBy: { criadoEm: "desc" },
    take: 300,
  });

  // Distribuição por pergunta, calculada aqui mesmo: são centenas de linhas,
  // não vale uma consulta de agregação por pergunta.
  const distribuicao: Record<string, Record<string, number>> = {
    perfil: {},
    gasto: {},
    telas: {},
  };

  for (const lead of leads) {
    const r = (lead.respostas ?? {}) as Record<string, string>;
    for (const chave of Object.keys(distribuicao)) {
      const valor = r[chave];
      if (!valor) continue;
      distribuicao[chave][valor] = (distribuicao[chave][valor] ?? 0) + 1;
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            <Users className="h-3.5 w-3.5" />
            Campanha
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Quiz</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {leads.length === 0
              ? "Nenhuma resposta ainda — a página é /quiz."
              : `${leads.length} ${leads.length === 1 ? "resposta" : "respostas"}, mais recentes primeiro.`}
          </p>
        </div>
      </div>

      {leads.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(distribuicao).map(([chave, valores]) => {
            const total = Object.values(valores).reduce((a, b) => a + b, 0) || 1;
            const ordenado = Object.entries(valores).sort((a, b) => b[1] - a[1]);

            return (
              <div
                key={chave}
                className="rounded-2xl border border-white/[0.08] bg-surface/40 p-5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {TITULOS[chave]}
                </p>

                <div className="mt-4 space-y-3">
                  {ordenado.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  )}
                  {ordenado.map(([valor, contagem]) => {
                    const pct = Math.round((contagem / total) * 100);
                    return (
                      <div key={valor}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-foreground">
                            {ROTULOS[chave]?.[valor] ?? valor}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {pct}% · {contagem}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                            style={{ width: `${Math.max(3, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-semibold">E-mail</th>
              <th className="px-5 py-3 font-semibold">Assiste</th>
              <th className="px-5 py-3 font-semibold">Paga hoje</th>
              <th className="px-5 py-3 font-semibold">Telas</th>
              <th className="px-5 py-3 font-semibold">Quando</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center text-muted-foreground">
                  Nenhuma resposta ainda.
                </td>
              </tr>
            )}
            {leads.map((lead) => {
              const r = (lead.respostas ?? {}) as Record<string, string>;
              return (
                <tr
                  key={lead.id}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3 font-medium text-foreground">{lead.email}</td>
                  <td className="px-5 py-3 text-muted">
                    {ROTULOS.perfil[r.perfil] ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">{ROTULOS.gasto[r.gasto] ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{ROTULOS.telas[r.telas] ?? "—"}</td>
                  <td className="px-5 py-3 tabular-nums text-muted-foreground">
                    {formatDate(lead.criadoEm)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
