"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncM3uPlaylistAction } from "@/app/actions/iptv";
import { cn } from "@/lib/utils";

/**
 * Dispara a sincronização do catálogo compartilhado.
 *
 * `userId` é opcional e ignorado — existe só para não quebrar chamadas
 * antigas do painel por cliente.
 */
export function SyncButton({
  userId: _userId,
  className,
}: {
  userId?: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await syncM3uPlaylistAction();
        });
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50",
        className,
      )}
    >
      <RefreshCw
        className={cn("h-4 w-4", isPending && "animate-spin")}
        strokeWidth={1.75}
      />
      {isPending ? "Sincronizando…" : "Sincronizar Agora"}
    </button>
  );
}
