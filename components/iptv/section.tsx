import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Cabeçalho único de todas as seções da área logada.
 *
 * A tela tinha um título diferente por página — emoji no meio da frase,
 * caixa alta em uma, versal em outra, cor variando por seção. Um componente
 * só resolve o ritmo vertical e mantém a hierarquia legível: sobrelinha
 * pequena para o contexto, título para o conteúdo.
 */
export function SectionHeader({
  eyebrow,
  title,
  hint,
  href,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  href?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </p>
        )}
        <h2 className="truncate text-xl font-extrabold leading-tight tracking-[-0.025em] text-foreground">
          {title}
        </h2>
        {hint && (
          <p className="mt-[3px] truncate text-[12.5px] font-medium tracking-[-0.005em] text-muted-foreground">
            {hint}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        {href && (
          <Link
            href={href}
            className="group flex items-center gap-0.5 rounded-full px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            Ver tudo
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

/** Espaçamento lateral único da área logada. */
export const GUTTER = "px-4 md:px-8 lg:px-12";
