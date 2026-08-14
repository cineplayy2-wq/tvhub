import Link from "next/link";

import { M3uForm } from "@/components/admin/iptv/m3u-form";
import { M3uSyncStatusBadge } from "@/components/admin/iptv/m3u-sync-status";
import { RelinkBackupButton } from "@/components/admin/iptv/relink-backup-button";
import { SyncButton } from "@/components/admin/iptv/sync-button";
import { PoolDashboard } from "@/components/admin/iptv/pool-dashboard";
import { getPoolOverview } from "@/lib/iptv/pool-service";
import { getSystemPlaylist } from "@/lib/queries/iptv";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function IptvCatalogPage() {
  const [playlist, poolData] = await Promise.all([
    getSystemPlaylist(),
    getPoolOverview(),
  ]);

  return (
    <div className="px-6 py-8 space-y-10">
      {/* 1. Módulo do Pool de M3U e Telas Simultâneas */}
      <PoolDashboard initialData={poolData} />

      <hr className="border-white/10" />

      {/* 2. Catálogo IPTV Compartilhado & Fontes */}
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-black text-white tracking-tight">
            Fontes do Catálogo IPTV Principal
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A lista compartilhada que alimenta as vitrines de canais, filmes e séries para os assinantes.
          </p>
        </div>

        {playlist ? (
          <div className="mb-8 rounded-3xl border border-white/10 bg-surface/60 p-6 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <M3uSyncStatusBadge
                    status={playlist.syncStatus}
                    lastError={playlist.lastSyncError}
                  />
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-light">
                    Catálogo Ativo
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
                  Nome da Lista: <strong className="text-foreground">{playlist.label}</strong>
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-3">
                {(playlist.backupSourceUrl || playlist.backupXtreamServer) && (
                  <RelinkBackupButton userId={playlist.userId} />
                )}
                <SyncButton />
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não há catálogo configurado. Configure a lista abaixo.
            </p>
          </div>
        )}

        <div className="max-w-2xl rounded-3xl border border-white/10 bg-surface/60 p-6 backdrop-blur-md">
          <h3 className="mb-4 text-base font-bold text-white">
            {playlist ? "Editar Fontes da Playlist Principal" : "Configurar Playlist Principal"}
          </h3>
          <M3uForm
            userId={playlist?.userId ?? "system"}
            existing={playlist}
          />
        </div>
      </div>
    </div>
  );
}
