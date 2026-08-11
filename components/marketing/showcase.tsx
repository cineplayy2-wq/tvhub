import Image from "next/image";
import { AgeBadge } from "@/components/ui/badge";
import type { TitleCard } from "@/types";

/**
 * Vitrine do catálogo em duas faixas contínuas.
 *
 * Cada faixa é a lista duplicada, com a animação percorrendo -50% — o segundo
 * bloco assume onde o primeiro termina, sem emenda. A segunda faixa anda no
 * sentido oposto: duas faixas na mesma direção parecem uma tabela deslizando,
 * em direções opostas parecem movimento de câmera.
 */
export function Showcase({ titles }: { titles: TitleCard[] }) {
  if (titles.length === 0) return null;

  const half = Math.ceil(titles.length / 2);
  const rows = [titles.slice(0, half), titles.slice(half)];

  return (
    <section className="relative overflow-hidden py-24" aria-label="Catálogo">
      <div className="mx-auto mb-14 max-w-[100rem] px-5 sm:px-8">
        <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
          <span className="h-px w-8 bg-primary" aria-hidden />
          No ar agora
        </p>
        <h2 className="mt-6 max-w-2xl text-balance font-display text-display-sm uppercase leading-[0.95] tracking-tightest text-foreground">
          Um catálogo que não te faz rolar por vinte minutos
        </h2>
      </div>

      <div className="relative space-y-4">
        {/* Máscaras: os pôsteres surgem e somem no preto, sem corte seco */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent sm:w-44"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent sm:w-44"
        />

        {rows.map((row, rowIndex) => {
          if (row.length === 0) return null;
          const loop = [...row, ...row];

          return (
            <div
              key={rowIndex}
              className={`flex w-max gap-4 motion-reduce:animate-none ${
                rowIndex === 0 ? "animate-marquee" : "animate-marquee-reverse"
              }`}
            >
              {loop.map((title, index) => (
                <article
                  key={`${title.id}-${index}`}
                  className="group relative h-60 w-40 shrink-0 overflow-hidden rounded-lg border border-border bg-surface sm:h-72 sm:w-48"
                >
                  {title.posterUrl && (
                    <Image
                      src={title.posterUrl}
                      alt={title.name}
                      fill
                      sizes="192px"
                      className="object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
                      loading="lazy"
                    />
                  )}

                  {/* Metadados só no hover: o pôster é o protagonista */}
                  <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-background via-background/85 to-transparent p-3 opacity-0 transition-all duration-500 ease-smooth group-hover:translate-y-0 group-hover:opacity-100">
                    <h3 className="truncate text-[13px] font-medium text-foreground">
                      {title.name}
                    </h3>
                    <div className="mt-1.5 flex items-center gap-2">
                      <AgeBadge rating={title.ageRating} />
                      <span className="text-[11px] text-muted-foreground">
                        {title.releaseYear ?? ""}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
