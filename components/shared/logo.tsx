import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Wordmark HUBFLIX.
 *
 * Usa a arte oficial do manual, não texto reconstruído: a marca tem o traço
 * da película atravessando as letras e o sinal de conexão sobre o H — nada
 * disso se reproduz com fonte.
 *
 * A arte é servida do próprio domínio, então `next/image` pode otimizá-la
 * (ao contrário das artes de canal, que vêm de hosts arbitrários).
 */

const SIZES = {
  sm: { width: 104, height: 28 },
  md: { width: 132, height: 36 },
  lg: { width: 220, height: 60 },
} as const;

export function Logo({
  className,
  size = "md",
  priority = false,
}: {
  className?: string;
  size?: keyof typeof SIZES;
  priority?: boolean;
}) {
  const { width, height } = SIZES[size];

  return (
    <Image
      src="/brand/wordmark.png"
      alt="HUBFLIX"
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
      style={{ width, height: "auto" }}
    />
  );
}

/**
 * Ícone da Marca ("H" Hubflix).
 * Usado na barra de navegação superior acompanhado do título da categoria.
 */
export function LogoHMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center shrink-0", className)}>
      <svg
        viewBox="0 0 38 38"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-8 w-8"
      >
        <rect width="38" height="38" rx="9" fill="url(#h_logo_gradient)" />
        <path
          d="M12 10.5V27.5M26 10.5V27.5M12 19H26"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="26" cy="11" r="2.5" fill="#F59E0B" />
        <defs>
          <linearGradient id="h_logo_gradient" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6C1DF5" />
            <stop offset="1" stopColor="#4F46E5" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

