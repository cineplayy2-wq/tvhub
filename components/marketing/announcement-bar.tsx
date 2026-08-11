import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Faixa de aviso no topo. Fica ACIMA do header fixo e rola junto com a página:
 * grudar as duas coisas rouba altura permanente da dobra em telas de notebook.
 */
export function AnnouncementBar({ label }: { label: string }) {
  return (
    <div className="relative z-50 border-b border-border/60 bg-surface">
      <Link
        href="#planos"
        className="group mx-auto flex max-w-6xl items-center justify-center gap-2 px-5 py-2.5 text-center"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {label}
        </span>
        <ArrowRight
          className="h-3 w-3 text-primary transition-transform duration-300 ease-smooth group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </div>
  );
}
