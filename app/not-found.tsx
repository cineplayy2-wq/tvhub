import Link from "next/link";
import { Film, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-24 text-center">
      <div className="max-w-md w-full rounded-3xl border border-white/10 bg-surface/60 p-8 backdrop-blur-xl shadow-2xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary">
          <Film className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Página não encontrada
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          O conteúdo que você procurava não existe, foi removido ou a URL está incorreta.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
          <Link
            href="/tv"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover shadow-lg shadow-primary/25"
          >
            <Home className="h-4 w-4" />
            Ir para o Inicio (HUBFLIX)
          </Link>
        </div>
      </div>
    </div>
  );
}
