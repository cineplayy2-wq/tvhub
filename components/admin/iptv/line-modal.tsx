"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Plus, X, Server, KeyRound, User, Layers, FileText } from "lucide-react";
import { createIptvLineAction, updateIptvLineAction } from "@/app/actions/admin-pool";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import type { IptvLine } from "@prisma/client";

export function LineModal({
  line,
  open,
  onClose,
}: {
  line?: IptvLine | null;
  open: boolean;
  onClose: () => void;
}) {
  const isEditing = !!line;
  const [state, formAction] = useFormState(
    isEditing ? updateIptvLineAction : createIptvLineAction,
    {},
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {isEditing ? "Editar Linha M3U / Servidor" : "Adicionar Nova Linha M3U ao Pool"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Cada linha atende até 2 telas simultâneas de forma balanceada.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          action={async (formData) => {
            await formAction(formData);
            onClose();
          }}
          className="space-y-4"
        >
          {line?.id && <input type="hidden" name="id" value={line.id} />}

          {state.error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
              {state.error}
            </div>
          )}

          {state.success && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
              {state.success}
            </div>
          )}

          <Input
            name="label"
            label="Identificação da Linha / Servidor"
            placeholder="Ex: Servidor Alpha #01 ou Linha VIP 1"
            defaultValue={line?.label || ""}
            required
            autoFocus
          />

          <Input
            name="serverUrl"
            label="URL Base do Servidor / M3U"
            placeholder="Ex: http://hghg.mr34567.site:80"
            defaultValue={line?.serverUrl || ""}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="username"
              label="Usuário Xtream"
              placeholder="Ex: 417367"
              defaultValue={line?.username || ""}
              required
            />

            <Input
              name="password"
              label="Senha Xtream"
              placeholder="Ex: 679834"
              defaultValue={line?.password || ""}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="maxScreens"
              type="number"
              min={1}
              max={10}
              label="Limite de Telas da Linha"
              defaultValue={line?.maxScreens || 2}
              required
            />

            <Input
              name="notes"
              label="Observações / Painel (Opcional)"
              placeholder="Ex: Validade Dez/2026"
              defaultValue={line?.notes || ""}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              Cancelar
            </button>
            <SubmitButton size="md">
              {isEditing ? "Salvar Alterações" : "Adicionar ao Pool"}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
