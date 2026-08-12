import Link from "next/link";

import { M3uForm } from "@/components/admin/iptv/m3u-form";
import { M3uSyncStatusBadge } from "@/components/admin/iptv/m3u-sync-status";
import { RelinkBackupButton } from "@/components/admin/iptv/relink-backup-button";
import { SyncButton } from "@/components/admin/iptv/sync-button";
import { getSystemPlaylist } from "@/lib/queries/iptv";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Catálogo IPTV compartilhado.
 *
 * Uma lista só, servida a todos os assinantes. Permissões por cliente
 * (módulo adulto, categorias travadas) ficam em /admin/iptv/[userId].
 */
export default async function IptvCatalogPage() {
  const playlist = await getSystemPlaylist();

  return (
    <div className="px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-display text-foreground">
          Catálogo IPTV
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uma lista compartilhada por todos os assinantes. A sincronização
          roda uma vez — de madrugada ou sob demanda — e o conteúdo novo vai
          aparecendo sem derrubar o que já está no ar.
        </p>
      </div>

      {playlist ? (
        <div className="mb-8 rounded-lg border border-border bg-surface/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <M3uSyncStatusBadge
                  status={playlist.syncStatus}
                  lastError={playlist.lastSyncError}
                />
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Compartilhado
                </span>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <span>
                  <strong className="text-foreground">
                    {playlist._count.channels.toLocaleString("pt-BR")}
                  </strong>{" "}
                  canais
                </span>
                <span>
                  <strong className="text-foreground">
                    {playlist.groups.length.toLocaleString("pt-BR")}
                  </strong>{" "}
                  grupos
                </span>
                {playlist.lastSyncAt && (
                  <span>
                    Último sync:{" "}
                    <strong className="text-foreground">
                      {formatDate(playlist.lastSyncAt)}
                    </strong>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Lista: <strong className="text-foreground">{playlist.label}</strong>
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              {(playlist.backupSourceUrl || playlist.backupXtreamServer) && (
                <RelinkBackupButton userId={playlist.userId} />
              )}
              <SyncButton />
            </div>
          </div>

          <p className="mt-6 border-t border-border/50 pt-4 text-xs text-muted-foreground">
            Para liberar o módulo +18 ou travar categorias de um cliente,
            abra o cliente em{" "}
            <Link href="/admin/clientes" className="text-primary hover:underline">
              Clientes
            </Link>{" "}
            e use a aba IPTV dele.
          </p>
        </div>
      ) : (
        <div className="mb-8 rounded-lg border border-border bg-surface/40 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Ainda não há catálogo compartilhado. Configure a lista abaixo —
            ela passa a servir todos os assinantes.
          </p>
        </div>
      )}

      <div className="max-w-2xl">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {playlist ? "Editar fontes do catálogo" : "Configurar catálogo"}
        </h2>
        <M3uForm
          userId={playlist?.userId ?? "system"}
          existing={playlist}
        />
      </div>
    </div>
  );
}
