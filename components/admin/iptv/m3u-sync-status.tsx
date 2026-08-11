"use client";

import { cn } from "@/lib/utils";
import type { M3uSyncStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  M3uSyncStatus,
  { label: string; color: string; dotColor: string }
> = {
  PENDING: {
    label: "Pendente",
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
  },
  SYNCING: {
    label: "Sincronizando…",
    color: "text-warning",
    dotColor: "bg-warning animate-pulse",
  },
  SYNCED: {
    label: "Sincronizado",
    color: "text-success",
    dotColor: "bg-success",
  },
  ERROR: {
    label: "Erro",
    color: "text-danger",
    dotColor: "bg-danger",
  },
};

export function M3uSyncStatusBadge({
  status,
  lastError,
  className,
}: {
  status: M3uSyncStatus;
  lastError?: string | null;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn("h-2 w-2 rounded-full", config.dotColor)}
        aria-hidden
      />
      <span className={cn("text-sm", config.color)}>{config.label}</span>
      {status === "ERROR" && lastError && (
        <span
          className="max-w-[200px] truncate text-xs text-danger/70"
          title={lastError}
        >
          ({lastError})
        </span>
      )}
    </div>
  );
}
