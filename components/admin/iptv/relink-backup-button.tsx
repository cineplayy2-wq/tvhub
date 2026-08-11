"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";

import { revincularBackupAction } from "@/app/actions/iptv";
import { cn } from "@/lib/utils";

type Retorno =
  | { erro: string }
  | { vinculados: number; analisados: number; canaisNoBackup: number };

/**
 * Revincula o backup sem reimportar.
 *
 * Fica ao lado de "Sincronizar Agora" de propósito: aquele apaga os canais
 * antes de repovoar e deixa o assinante sem catálogo por minutos. Quando os
 * canais já estão certos e só o failover ficou para trás, este é o botão certo.
 */
export function RelinkBackupButton({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [retorno, setRetorno] = useState<Retorno | null>(null);

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <button
        type="button"
        disabled={pendente}
        onClick={() => {
          setRetorno(null);
          iniciar(async () => {
            setRetorno(await revincularBackupAction(userId));
          });
        }}
        title="Preenche as URLs de backup nos canais já importados, sem apagar nada"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
      >
        <Link2 className={cn("h-4 w-4", pendente && "animate-pulse")} strokeWidth={1.75} />
        {pendente ? "Revinculando…" : "Revincular backup"}
      </button>

      {retorno && "erro" in retorno && (
        <p className="text-xs text-danger">{retorno.erro}</p>
      )}

      {retorno && !("erro" in retorno) && (
        <p className="text-xs text-muted-foreground">
          <strong className="text-emerald-400">{retorno.vinculados}</strong> de{" "}
          {retorno.analisados} canais com backup ({retorno.canaisNoBackup} na lista
          secundária)
        </p>
      )}
    </div>
  );
}
