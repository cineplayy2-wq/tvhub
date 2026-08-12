import Image from "next/image";
import Link from "next/link";

import { AgeBadge } from "@/components/ui/badge";
import { cn, formatDuration } from "@/lib/utils";
import type { TitleCard as TitleCardData, TitleCardWithProgress } from "@/types";

/**
 * Fundo determinístico do fallback: o mesmo título recebe sempre o mesmo
 * gradiente. Aleatório mudaria a cada render e destruiria o reconhecimento.
 */
const TINTS = [
  "from-[#1E2A3A] to-[#0A0B0D]",
  "from-[#2A1E3A] to-[#0A0B0D]",
  "from-[#1E3A2C] to-[#0A0B0D]",
  "from-[#3A2A1E] to-[#0A0B0D]",
  "from-[#3A1E28] to-[#0A0B0D]",
];

function tintFor(id: string) {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return TINTS[sum % TINTS.length];
}

function hasProgress(
  item: TitleCardData | TitleCardWithProgress,
): item is TitleCardWithProgress {
  return "progress" in item;
}

export function TitleCard({
  item,
  className,
}: {
  item: TitleCardData | TitleCardWithProgress;
  className?: string;
}) {
  const progress = hasProgress(item) ? item.progress : null;

  return (
    <Link
      href={`/titulo/${item.slug}`}
      className={cn(
        "group relative block shrink-0 overflow-hidden rounded-[14px] border border-border/80 bg-surface",
        "transition-all duration-300 ease-smooth hover:border-primary/60 hover:shadow-[0_0_24px_rgba(177,92,255,0.25)]",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        className,
      )}
    >
      <div className="relative aspect-[2/3] w-full">
        {item.posterUrl ? (
          <Image
            src={item.posterUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 40vw, 200px"
            className="object-cover transition-transform duration-700 ease-smooth group-hover:scale-[1.04]"
          />
        ) : (
          /* Sem arte, o título vira a arte. Catálogo de domínio público quase
             nunca vem com pôster, e card vazio parece defeito. */
          <div
            className={cn(
              "flex h-full w-full flex-col justify-end bg-gradient-to-br p-3",
              tintFor(item.id),
            )}
          >
            <span className="font-display text-lg uppercase leading-[0.95] tracking-tightest text-foreground">
              {item.name}
            </span>
            {item.releaseYear && (
              <span className="mt-1 text-[11px] text-muted-foreground">
                {item.releaseYear}
              </span>
            )}
          </div>
        )}

        {/* Barra de progresso: só existe em "continuar assistindo" */}
        {progress && progress.percent > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-background/70">
            <div
              className="h-full bg-primary"
              style={{ width: `${progress.percent}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progress.percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${Math.round(progress.percent)}% assistido`}
            />
          </div>
        )}
      </div>

      {/* Metadados aparecem no hover: o pôster é o protagonista */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-background via-background/90 to-transparent p-3 pt-8 opacity-0 transition-all duration-300 ease-smooth group-hover:translate-y-0 group-hover:opacity-100">
        <h3 className="truncate text-[13px] font-medium text-foreground">
          {item.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          <AgeBadge rating={item.ageRating} />
          <span className="text-[11px] text-muted-foreground">
            {progress?.episodeLabel ??
              (item.durationSeconds
                ? formatDuration(item.durationSeconds)
                : item.type === "SERIES"
                  ? "Série"
                  : "")}
          </span>
        </div>
      </div>
    </Link>
  );
}
