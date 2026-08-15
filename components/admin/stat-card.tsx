import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Cartão de número do painel.
 *
 * O valor é o elemento com mais peso visual — é para ele que o olho vai
 * primeiro numa varredura, e é ele que responde "está tudo bem?" sem exigir
 * leitura. O rótulo fica pequeno em cima; a dica embaixo só aparece quando
 * acrescenta contexto que o número sozinho não dá.
 *
 * O ícone é opcional e discreto de propósito: numa grade de seis cartões,
 * seis ícones coloridos competem entre si e o número deixa de saltar — que é
 * justamente o trabalho dele.
 */
export function StatCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
  icon?: LucideIcon;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.08] p-5",
        "bg-gradient-to-b from-surface-elevated/70 to-surface/30",
        "transition-colors duration-300 hover:border-white/[0.14]",
      )}
    >
      {/* Brilho de canto: dá profundidade sem pedir atenção. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/[0.12] blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <Icon
            className="h-4 w-4 shrink-0 text-muted-foreground/50"
            strokeWidth={1.8}
            aria-hidden
          />
        )}
      </div>

      <p
        className={cn(
          "relative mt-3 font-display text-4xl leading-none tracking-tightest tabular-nums",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
          (!tone || tone === "default") && "text-foreground",
        )}
      >
        {value}
      </p>

      {hint && (
        <p className="relative mt-2 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
