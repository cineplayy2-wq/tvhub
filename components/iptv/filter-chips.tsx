import Link from "next/link";

import { cn } from "@/lib/utils";

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
  href: string;
  active: boolean;
};

/**
 * Fileira de filtros.
 *
 * Um estilo só para todas as páginas: fundo neutro, ativo em âmbar sólido.
 * A contagem fica em fonte tabular ao lado do rótulo, não entre parênteses
 * colada no texto — assim a linha não "pisca" de largura ao trocar de filtro.
 */
export function FilterChips({
  chips,
  className,
}: {
  chips: FilterChip[];
  className?: string;
}) {
  if (chips.length <= 1) return null;

  return (
    <div className={cn("scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1", className)}>
      {chips.map((chip) => (
        <Link
          key={chip.id}
          href={chip.href}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors",
            chip.active
              ? "bg-primary text-primary-foreground"
              : "border border-white/[0.08] bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <span className="max-w-[180px] truncate">{chip.label}</span>
          {chip.count != null && (
            <span
              className={cn(
                "tabular-nums",
                chip.active ? "text-primary-foreground/70" : "text-muted-foreground/70",
              )}
            >
              {chip.count.toLocaleString("pt-BR")}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** Limpa prefixos decorativos que as listas M3U colocam no nome do grupo. */
export function cleanGroupLabel(name: string) {
  return name.replace(/^[^\p{L}\p{N}]+/u, "").trim() || name;
}
