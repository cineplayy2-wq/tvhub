"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-24 text-center">
      <div className="max-w-md w-full rounded-3xl border border-danger/30 bg-surface/60 p-8 backdrop-blur-xl shadow-2xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/20 text-danger">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Ocorreu um erro inesperado
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Não foi possível carregar esta tela. Tente recarregar a página.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover shadow-lg shadow-primary/25"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </button>

          <Link
            href="/tv"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
          >
            <Home className="h-4 w-4" />
            Ir para a Home
          </Link>
        </div>
      </div>
    </div>
  );
}
