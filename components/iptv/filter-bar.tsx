"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { FilterGroup } from "@/lib/queries/filters";
import { cn } from "@/lib/utils";

/**
 * Barra de filtros do protótipo.
 *
 * Cada grupo é uma pílula com seta; tocar abre um painel logo abaixo do
 * cabeçalho com as opções e as contagens REAIS. Filtro escolhido vira uma
 * etiqueta branca com "×" na frente da fila — assim o que está ativo fica
 * sempre visível, sem precisar reabrir o painel para lembrar.
 *
 * Opção sem conteúdo não é renderizada: contagem zero vinda do servidor já
 * chega filtrada.
 */
export function FilterBar({
  groups,
  counts,
  className,
}: {
  groups: FilterGroup[];
  counts: Record<string, number>;
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);

  const active = (params.get("f") ?? "").split(",").filter(Boolean);

  const apply = (next: string[]) => {
    const search = new URLSearchParams(params.toString());
    if (next.length > 0) search.set("f", next.join(","));
    else search.delete("f");
    search.delete("page");
    router.push(`?${search.toString()}`, { scroll: false });
  };

  const toggle = (id: string) =>
    apply(active.includes(id) ? active.filter((x) => x !== id) : [...active, id]);

  // Grupos que têm ao menos uma opção com conteúdo
  const usable = groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => (counts[option.id] ?? 0) > 0),
    }))
    .filter((group) => group.options.length > 0);

  if (usable.length === 0) return null;

  const activeLabels = active
    .map((id) => {
      for (const group of usable) {
        const option = group.options.find((o) => o.id === id);
        if (option) return { id, label: option.label };
      }
      return null;
    })
    .filter(Boolean) as Array<{ id: string; label: string }>;

  return (
    <div className={cn("relative", className)}>
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-5 pb-3">
        {activeLabels.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className="flex h-[38px] shrink-0 items-center gap-2 rounded-xl bg-white/[0.92] pl-3.5 pr-2.5 text-[13.5px] font-bold text-[#06070A]"
          >
            {tag.label}
            <span className="text-base font-normal leading-none opacity-50">×</span>
          </button>
        ))}

        {activeLabels.length > 0 && (
          <span aria-hidden className="my-auto h-[22px] w-px shrink-0 bg-white/[0.16]" />
        )}

        {usable.map((group) => {
          const hasActive = group.options.some((option) => active.includes(option.id));
          const isOpen = open === group.id;

          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setOpen(isOpen ? null : group.id)}
              aria-expanded={isOpen}
              className={cn(
                "flex h-[38px] shrink-0 items-center gap-1.5 rounded-xl pl-[15px] pr-3",
                "text-[13.5px] font-semibold text-foreground transition-colors",
                "shadow-[inset_0_1px_0_rgba(255,255,255,.13)]",
                hasActive ? "bg-primary/40" : "bg-white/[0.07] hover:bg-white/[0.1]",
              )}
            >
              {group.label}
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className={cn(
                  "h-[13px] w-[13px] fill-none stroke-muted-foreground stroke-[2.6] transition-transform duration-300 [stroke-linecap:round] [stroke-linejoin:round]",
                  isOpen && "rotate-180",
                )}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Painel do grupo aberto */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={() => setOpen(null)}
            className="fixed inset-0 z-40 cursor-default bg-black/55"
          />
          <div className="absolute inset-x-0 top-full z-50 max-h-[58vh] overflow-auto rounded-b-[28px] bg-[rgba(8,10,14,.97)] px-5 pb-6 pt-4 shadow-card supports-[backdrop-filter]:backdrop-blur-[34px]">
            <p className="mb-3 text-[10.5px] font-extrabold uppercase tracking-[0.11em] text-muted-foreground">
              {usable.find((g) => g.id === open)?.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {usable
                .find((g) => g.id === open)
                ?.options.map((option) => {
                  const on = active.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggle(option.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors",
                        on
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/[0.07] text-foreground hover:bg-white/[0.12]",
                      )}
                    >
                      {option.label}
                      <b
                        className={cn(
                          "text-[11px] font-bold tabular-nums",
                          on ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {(counts[option.id] ?? 0).toLocaleString("pt-BR")}
                      </b>
                    </button>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
