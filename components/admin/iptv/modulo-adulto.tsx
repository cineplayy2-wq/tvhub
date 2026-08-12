"use client";

import { useState, useTransition } from "react";
import { Lock, Unlock } from "lucide-react";

import { alternarModuloAdultoAction } from "@/app/actions/iptv";
import { cn } from "@/lib/utils";

/**
 * Módulo adulto (+18), cobrado à parte.
 *
 * O conteúdo adulto da M3U chega sempre bloqueado. Este é o único lugar que
 * libera, e vale só para este cliente. Mesmo liberado, o +18 aparece apenas na
 * seção dedicada — nunca entra em destaques, busca ou perfil infantil.
 */
export function ModuloAdulto({
  userId,
  liberado,
  canaisAdultos,
}: {
  userId: string;
  liberado: boolean;
  canaisAdultos: number;
}) {
  const [ativo, setAtivo] = useState(liberado);
  const [pendente, iniciar] = useTransition();

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        ativo ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-surface/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {ativo ? (
            <Unlock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          ) : (
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Módulo Adulto +18 — R$ 15,00/mês
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {canaisAdultos.toLocaleString("pt-BR")} canais adultos no catálogo
              compartilhado. Bloqueados por padrão; libere apenas para quem
              contratou o adicional.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await alternarModuloAdultoAction(userId);
              if (!("erro" in r)) setAtivo(r.liberado);
            })
          }
          className={cn(
            "shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
            ativo
              ? "border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
              : "bg-primary text-primary-foreground hover:bg-primary-hover",
          )}
        >
          {pendente ? "Salvando…" : ativo ? "Bloquear +18" : "Liberar +18"}
        </button>
      </div>

      {ativo && (
        <p className="mt-3 border-t border-amber-500/20 pt-3 text-[11px] text-amber-300/90">
          Liberado. O conteúdo aparece só na seção Adulto — perfis infantis e trilhas de
          destaque continuam sem ele.
        </p>
      )}
    </div>
  );
}
