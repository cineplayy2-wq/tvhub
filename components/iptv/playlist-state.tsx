import Link from "next/link";
import { Loader2, Radio } from "lucide-react";

/**
 * Faixa discreta durante a sincronização do catálogo compartilhado.
 *
 * Não bloqueia nada: o assinante continua assistindo o que já está no ar.
 * Abrir o app só lê o status — nunca dispara carga.
 */
export function SyncBanner({
  isSyncing,
  isStale,
}: {
  isSyncing?: boolean;
  isStale?: boolean;
}) {
  if (!isSyncing) return null;

  return (
    <div
      role="status"
      className="mx-4 mt-3 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm text-foreground md:mx-8"
    >
      <div className="flex items-start gap-2.5">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
        <div>
          <p className="font-medium">
            {isStale
              ? "A atualização está demorando — você pode continuar assistindo"
              : "Atualizando o catálogo — o que você já tem continua no ar"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Conteúdo novo vai aparecendo aos poucos. Não é preciso sair desta
            tela.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Tela de lista ausente.
 */
export function EmptyPlaylist({ status }: { status?: string }) {
  const message =
    status === "SYNCING"
      ? "Estamos montando o catálogo agora. Isso leva alguns minutos na primeira vez."
      : status === "ERROR"
        ? "Houve um erro ao carregar o catálogo. Entre em contato com o suporte."
        : "Entre em contato com o administrador para configurar o catálogo de canais.";

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
        href="/tv"
        className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        Voltar ao catálogo
      </Link>
    </div>
  );
}
