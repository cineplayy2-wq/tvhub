import Link from "next/link";
import { CategoryLockControls } from "@/components/admin/iptv/category-lock-controls";
import { M3uForm } from "@/components/admin/iptv/m3u-form";
import { M3uSyncStatusBadge } from "@/components/admin/iptv/m3u-sync-status";
import { RelinkBackupButton } from "@/components/admin/iptv/relink-backup-button";
import { SyncButton } from "@/components/admin/iptv/sync-button";
import { getCustomer } from "@/lib/queries/admin";
import { getUserPlaylist } from "@/lib/queries/iptv";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function IptvUserPage({
  params,
}: {
  params: { userId: string };
}) {
  try {
    const customer = await getCustomer(params.userId);

    if (!customer) {
      return (
        <div className="px-8 py-10">
          <Link
            href="/admin/iptv"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← IPTV / M3U
          </Link>
          <div className="mt-8 rounded-2xl border border-border bg-surface/50 p-8 text-center">
            <h1 className="text-xl font-bold text-foreground">Cliente não encontrado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O ID informado não pertence a um cliente válido no sistema.
            </p>
            <Link
              href="/admin/iptv"
              className="mt-6 inline-flex items-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
            >
              Voltar para Lista IPTV
            </Link>
          </div>
        </div>
      );
    }

    const playlist = await getUserPlaylist(params.userId);

    return (
      <div className="px-8 py-10">
        <Link
          href="/admin/iptv"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← IPTV / M3U
        </Link>

        <div className="mb-8 mt-4">
          <h1 className="text-2xl font-semibold tracking-display text-foreground">
            M3U — {customer.name ?? customer.email}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure a lista IPTV deste cliente.
          </p>
        </div>

        {/* Status card when playlist exists */}
        {playlist && (
          <div className="mb-8 rounded-lg border border-border bg-surface/40 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <M3uSyncStatusBadge
                  status={playlist.syncStatus}
                  lastError={playlist.lastSyncError}
                />
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">
                      {playlist._count.channels}
                    </strong>{" "}
                    canais
                  </span>
                  <span>
                    <strong className="text-foreground">
                      {playlist.groups.length}
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
              </div>
              <div className="flex flex-wrap items-start gap-3">
                {(playlist.backupSourceUrl || playlist.backupXtreamServer) && (
                  <RelinkBackupButton userId={params.userId} />
                )}
                <SyncButton userId={params.userId} />
              </div>
            </div>

            {/* Lock Controls */}
            <div className="mt-8 border-t border-border/50 pt-6">
              <CategoryLockControls
                playlistId={playlist.id}
                userId={params.userId}
                groups={playlist.groups.map((g) => ({
                  category: g.category,
                  isHidden: g.isHidden,
                }))}
              />
            </div>

            {/* Groups list */}
            {playlist.groups.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Grupos ({playlist.groups.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {playlist.groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between rounded-md border border-border bg-surface/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {group.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {group.category ?? "live"}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-surface-elevated px-2 py-0.5 text-xs tabular-nums text-muted">
                        {group._count.channels}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <div className="max-w-2xl">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {playlist ? "Editar Lista" : "Atribuir Lista M3U"}
          </h2>
          <M3uForm userId={params.userId} existing={playlist} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("[IptvUserPage Error]", error);
    return (
      <div className="px-8 py-10">
        <Link
          href="/admin/iptv"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← IPTV / M3U
        </Link>
        <div className="mt-8 rounded-2xl border border-border bg-surface/50 p-8 text-center">
          <h1 className="text-xl font-bold text-foreground">Erro ao carregar lista</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ocorreu uma falha temporária ao obter os dados da lista M3U.
          </p>
          <Link
            href="/admin/iptv"
            className="mt-6 inline-flex items-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
          >
            Voltar para IPTV
          </Link>
        </div>
      </div>
    );
  }
}
