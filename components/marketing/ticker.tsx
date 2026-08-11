import { cn } from "@/lib/utils";

/**
 * Faixa de texto em rolagem contínua.
 *
 * A lista é duplicada e a animação percorre -50%: o segundo bloco assume
 * exatamente onde o primeiro termina, sem emenda. Duplicar é obrigatório —
 * com uma cópia só, o loop dá um salto visível a cada volta.
 */
export function Ticker({
  items,
  variant = "dark",
  reverse = false,
  className,
}: {
  items: string[];
  variant?: "dark" | "accent" | "invert";
  reverse?: boolean;
  className?: string;
}) {
  const loop = [...items, ...items];

  const skin = {
    dark: "border-y border-border bg-surface/40 text-muted",
    accent: "bg-primary text-primary-foreground",
    invert: "bg-invert text-invert-foreground",
  }[variant];

  return (
    <div
      className={cn("relative overflow-hidden py-4", skin, className)}
      // Decorativo e repetido: para leitor de tela é ruído puro
      aria-hidden
    >
      <div
        className={cn(
          "flex w-max items-center gap-8 motion-reduce:animate-none",
          reverse ? "animate-marquee-reverse" : "animate-marquee-fast",
        )}
      >
        {loop.map((item, index) => (
          <span key={`${item}-${index}`} className="flex items-center gap-8">
            <span className="whitespace-nowrap font-display text-lg uppercase tracking-[0.08em] sm:text-xl">
              {item}
            </span>
            <span className="text-[8px] opacity-50">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
