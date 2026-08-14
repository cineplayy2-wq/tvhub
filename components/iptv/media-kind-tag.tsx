import { cn } from "@/lib/utils";

/**
 * Etiqueta "Filme" / "Série" na quina do pôster.
 *
 * Existe porque a arte não diferencia os dois: capa de série e capa de filme
 * são o mesmo retângulo 2:3, e quem clica só descobre o que é depois de abrir
 * — filme cai no player, série cai numa lista de temporadas. A etiqueta paga
 * essa diferença antes do clique.
 *
 * Deliberadamente discreta: preto translúcido e texto pequeno, no canto
 * inferior direito, onde o pôster costuma ser mais escuro. Ela informa quando
 * o olho a procura e desaparece quando não. Um chip colorido aqui competiria
 * com a arte, que é o que a pessoa veio ver.
 */
export function MediaKindTag({
  isSeries,
  className,
}: {
  isSeries: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-1.5 right-1.5 z-10 rounded",
        "bg-black/65 px-1.5 py-[2px] ring-1 ring-inset ring-white/10 backdrop-blur-[2px]",
        "text-[8.5px] font-semibold uppercase leading-[1.35] tracking-[0.06em] text-white/85",
        className,
      )}
    >
      {isSeries ? "Série" : "Filme"}
    </span>
  );
}
