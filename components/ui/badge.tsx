import type { AgeRating } from "@prisma/client";
import { AGE_RATING_COLOR, AGE_RATING_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-border-strong px-1.5 py-0.5 text-[11px] font-medium text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Selo de classificação indicativa no padrão brasileiro. */
export function AgeBadge({
  rating,
  className,
}: {
  rating: AgeRating;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-[3px] px-1 text-[11px] font-bold leading-none text-white",
        AGE_RATING_COLOR[rating],
        className,
      )}
      // O número sozinho não é compreensível fora do contexto brasileiro
      aria-label={
        rating === "L"
          ? "Livre para todos os públicos"
          : `Não recomendado para menores de ${AGE_RATING_LABEL[rating]} anos`
      }
    >
      {AGE_RATING_LABEL[rating]}
    </span>
  );
}
