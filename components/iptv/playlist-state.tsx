import Link from "next/link";
import { Loader2, Radio } from "lucide-react";

/**
 * Aviso de sincronização oculto para o cliente conforme diretiva.
 */
export function SyncBanner({
  isSyncing,
  isStale,
}: {
  isSyncing?: boolean;
  isStale?: boolean;
}) {
  return null;
}

/**
 * Tela de lista ausente.
 */
export function EmptyPlaylist({ status }: { status?: string }) {
  const message =
    status === "SYNCING"
      ? "Estamos montando sua lista agora. Isso leva alguns minutos na primeira vez."
      : status === "ERROR"
        ? "Houve um erro ao carregar sua lista. Entre em contato com o suporte."
        : "Entre em contato com o administrador para configurar sua lista de canais.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="card-edge mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-surface">
        {status === "SYNCING" ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" strokeWidth={1.5} />
        ) : (
          <Radio className="h-8 w-8 text-primary" strokeWidth={1.5} />
        )}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {status === "SYNCING" ? "Preparando sua TV" : "Sua TV ainda não está configurada"}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>

      <Link
        href="/inicio"
        className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        Voltar ao catálogo
      </Link>
    </div>
  );
}
