"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Voltar que preserva a aba e a rolagem.
 *
 * `router.back()` usa o histórico do App Router, então a posição de scroll
 * volta. O `fallbackHref` cobre o caso em que a pessoa chegou por link
 * externo ou abriu a URL direto — aí não há histórico útil.
 */
export function BackButton({
  fallbackHref,
  label = "Voltar",
  className,
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white/90 shadow-lg backdrop-blur-md transition-colors hover:bg-black/90 hover:text-white",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

/** Variante em Link estático quando o componente precisa ser server-side puro. */
export function BackLink({
  href,
  label = "Voltar",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}
