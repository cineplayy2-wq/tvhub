import { GUTTER } from "./section";

/**
 * Esqueletos de carregamento.
 *
 * Existem para que a página apareça em pedaços em vez de tudo de uma vez:
 * o topo pinta enquanto as consultas de cada trilha ainda estão rodando.
 * As medidas são as mesmas dos cards reais — esqueleto de tamanho diferente
 * causa um salto de layout quando o conteúdo chega, que é pior do que a
 * espera que ele tenta disfarçar.
 */

export function HeroSkeleton() {
  return (
    <div className="relative h-[68vh] min-h-[430px] w-full overflow-hidden md:h-[76vh] md:max-h-[720px]">
      <div className="skeleton absolute inset-0" />
      <div className="scrim-hero absolute inset-0" />

      <div className="relative flex h-full flex-col justify-end px-4 pb-10 md:px-8 md:pb-14 lg:px-12">
        <div className="h-3 w-32 rounded bg-white/10" />
        <div className="mt-4 h-10 w-3/4 max-w-lg rounded bg-white/10 md:h-14" />
        <div className="mt-4 h-3 w-40 rounded bg-white/[0.07]" />
        <div className="mt-6 h-11 w-40 rounded-xl bg-white/[0.07]" />
      </div>
    </div>
  );
}

export function RailSkeleton({
  variant = "poster",
  count = 8,
}: {
  variant?: "poster" | "tile";
  count?: number;
}) {
  const isPoster = variant === "poster";

  return (
    <section>
      <div className={`${GUTTER} mb-4`}>
        <div className="h-3 w-24 rounded bg-white/[0.07]" />
        <div className="mt-2 h-5 w-56 rounded bg-white/10" />
      </div>

      <div className="scrollbar-none flex gap-3 overflow-hidden px-4 md:gap-4 md:px-8 lg:px-12">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className={isPoster ? "w-[132px] shrink-0 md:w-[152px]" : "w-[168px] shrink-0 md:w-[188px]"}
          >
            <div
              className={`skeleton w-full rounded-xl ${isPoster ? "aspect-[2/3]" : "aspect-video"}`}
            />
            <div className="mt-2 h-3 w-4/5 rounded bg-white/[0.07]" />
            <div className="mt-1.5 h-2.5 w-2/5 rounded bg-white/[0.05]" />
          </div>
        ))}
      </div>
    </section>
  );
}
