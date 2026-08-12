"use client";

import { useState, useTransition } from "react";
import { CreditCard, XCircle } from "lucide-react";

import { cancelarAssinaturaAction, vincularPlanoAction } from "@/app/actions/planos";
import { formatPrice } from "@/lib/utils";

type PlanoOpcao = {
  id: string;
  name: string;
  priceCents: number;
  interval: string;
  deviceLimit: number;
};

/**
 * Atribui um plano ao cliente direto na ficha dele.
 *
 * Antes a ficha só EXIBIA a assinatura: para colocar alguém num plano era
 * preciso mexer no banco na mão. Como o limite de telas e a validade saem daqui,
 * um cliente sem assinatura ficava sem regra nenhuma aplicada.
 */
export function PlanoDoCliente({
  userId,
  planos,
  planoAtualId,
  temAssinatura,
}: {
  userId: string;
  planos: PlanoOpcao[];
  planoAtualId?: string | null;
  temAssinatura: boolean;
}) {
  const [escolhido, setEscolhido] = useState(planoAtualId ?? planos[0]?.id ?? "");
  const [pendente, iniciar] = useTransition();
  const [retorno, setRetorno] = useState<string | null>(null);

  if (planos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhum plano ativo cadastrado. Crie um em <strong>Planos &amp; Assinaturas</strong>.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={escolhido}
          onChange={(e) => {
            setEscolhido(e.target.value);
            setRetorno(null);
          }}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {planos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatPrice(p.priceCents)}/{p.interval === "YEAR" ? "ano" : "mês"} ·{" "}
              {p.deviceLimit} telas
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={pendente || !escolhido}
          onClick={() => {
            setRetorno(null);
            iniciar(async () => {
              const r = await vincularPlanoAction(userId, escolhido);
              setRetorno(
                "erro" in r && r.erro
                  ? r.erro
                  : `Plano aplicado até ${new Date(
                      (r as { ate: string }).ate,
                    ).toLocaleDateString("pt-BR")}`,
              );
            });
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <CreditCard className="h-4 w-4" />
          {pendente ? "Aplicando…" : temAssinatura ? "Trocar plano" : "Aplicar plano"}
        </button>
      </div>

      {temAssinatura && (
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            setRetorno(null);
            iniciar(async () => {
              const r = await cancelarAssinaturaAction(userId);
              setRetorno("erro" in r && r.erro ? r.erro : "Assinatura cancelada");
            });
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-danger transition-colors hover:underline disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancelar assinatura
        </button>
      )}

      {retorno && <p className="text-xs text-muted-foreground">{retorno}</p>}
    </div>
  );
}
