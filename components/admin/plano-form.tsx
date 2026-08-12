"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Pencil, Plus, Power } from "lucide-react";

import { togglePlanoAtivoAction, upsertPlanoAction } from "@/app/actions/planos";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

export type PlanoEditavel = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  interval: string;
  deviceLimit: number;
  maxProfiles: number;
  trialDays: number;
  features: string[];
  isActive: boolean;
};

const campo =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

/** Reais com vírgula, do jeito que se digita: 2990 -> "29,90" */
function emReais(centavos: number) {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/**
 * Criação e edição de planos.
 *
 * A tela de planos era vitrine: listava o que existia no banco sem nenhum jeito
 * de mudar preço, limite de telas ou criar um plano novo. Qualquer ajuste
 * exigia mexer no banco na mão.
 */
export function PlanoForm({ planos }: { planos: PlanoEditavel[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [alternando, alternar] = useTransition();
  const [state, formAction] = useFormState(upsertPlanoAction, {});

  const emEdicao = planos.find((p) => p.id === aberto) ?? null;
  const criando = aberto === "novo";

  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto(criando ? null : "novo")}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          {criando ? "Fechar" : "Novo plano"}
        </button>

        {planos.map((p) => (
          <div key={p.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAberto(aberto === p.id ? null : p.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                aberto === p.id
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground",
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
              {p.name}
            </button>
            <button
              type="button"
              disabled={alternando}
              onClick={() => alternar(() => void togglePlanoAtivoAction(p.id))}
              title={p.isActive ? "Desativar plano" : "Ativar plano"}
              className={cn(
                "rounded-lg border p-2 transition-colors disabled:opacity-50",
                p.isActive
                  ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Power className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {(criando || emEdicao) && (
        <form
          action={formAction}
          key={aberto ?? "novo"}
          className="rounded-2xl border border-white/10 bg-surface/60 p-6 space-y-4"
        >
          {emEdicao && <input type="hidden" name="id" value={emEdicao.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Nome do plano
              </label>
              <input
                name="name"
                defaultValue={emEdicao?.name ?? ""}
                placeholder="Ex: Mensal"
                className={campo}
              />
              {state.fieldErrors?.name && (
                <p className="mt-1 text-xs text-danger">{state.fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Preço (R$)
              </label>
              <input
                name="preco"
                defaultValue={emEdicao ? emReais(emEdicao.priceCents) : ""}
                placeholder="29,90"
                className={campo}
              />
              {state.fieldErrors?.preco && (
                <p className="mt-1 text-xs text-danger">{state.fieldErrors.preco}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Descrição
            </label>
            <input
              name="description"
              defaultValue={emEdicao?.description ?? ""}
              placeholder="Acesso completo a filmes, séries e canais ao vivo."
              className={campo}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Cobrança
              </label>
              <select
                name="interval"
                defaultValue={emEdicao?.interval ?? "MONTH"}
                className={campo}
              >
                <option value="MONTH">Mensal</option>
                <option value="YEAR">Anual</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Telas
              </label>
              <input
                name="deviceLimit"
                type="number"
                min={1}
                max={10}
                defaultValue={emEdicao?.deviceLimit ?? 2}
                className={campo}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Perfis
              </label>
              <input
                name="maxProfiles"
                type="number"
                min={1}
                max={10}
                defaultValue={emEdicao?.maxProfiles ?? 4}
                className={campo}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Teste (dias)
              </label>
              <input
                name="trialDays"
                type="number"
                min={0}
                max={90}
                defaultValue={emEdicao?.trialDays ?? 0}
                className={campo}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Vantagens — uma por linha
            </label>
            <textarea
              name="features"
              rows={4}
              defaultValue={(emEdicao?.features ?? []).join("\n")}
              placeholder={"Catálogo completo\nSem anúncios\nSuporte no WhatsApp"}
              className={campo}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={emEdicao?.isActive ?? true}
              className="h-4 w-4 rounded border-border bg-surface"
            />
            Plano visível para novos clientes
          </label>

          {state.error && (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3">
              <p className="text-sm text-danger">{state.error}</p>
            </div>
          )}
          {state.success && (
            <div className="rounded-lg border border-success/40 bg-success/10 p-3">
              <p className="text-sm text-success">Plano salvo.</p>
            </div>
          )}

          <SubmitButton variant="primary" size="md">
            {emEdicao ? "Salvar alterações" : "Criar plano"}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
