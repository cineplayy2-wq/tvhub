import Link from "next/link";

import { SearchField } from "@/components/admin/search-field";
import { Pagination } from "@/components/admin/pagination";
import { M3uSyncStatusBadge } from "@/components/admin/iptv/m3u-sync-status";
import { SyncButton } from "@/components/admin/iptv/sync-button";
import { listAllPlaylists } from "@/lib/queries/iptv";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function IptvPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { items, total, totalPages } = await listAllPlaylists({
    query: searchParams.q,
    page,
  });

  return (
    <div className="px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-display text-foreground">
          IPTV / M3U
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Listas M3U atribuídas aos clientes. Gerencie canais e sincronização.
        </p>
      </div>

      <div className="mb-5">
        <SearchField
          placeholder="Buscar por cliente ou nome da lista"
          basePath="/admin/iptv"
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface/40 px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {searchParams.q
              ? `Nenhuma lista encontrada para "${searchParams.q}".`
              : "Nenhuma lista M3U atribuída ainda."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Vá até{" "}
            <Link
              href="/admin/clientes"
              className="text-primary hover:text-primary-hover"
            >
              Clientes
            </Link>{" "}
            e configure a M3U de cada cliente.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/60 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Cliente
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Lista
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Canais
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Grupos
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Último Sync
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-surface-hover/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clientes/${item.userId}`}
                      className="transition-colors hover:text-primary"
                    >
                      <span className="block font-medium text-foreground">
                        {item.user.name ?? "Sem nome"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {item.user.email}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/iptv/${item.userId}`}
                      className="text-foreground transition-colors hover:text-primary"
                    >
                      {item.label}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {item.sourceType === "URL"
                        ? "URL"
                        : item.sourceType === "XTREAM"
                          ? "Xtream Codes"
                          : "Texto colado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <M3uSyncStatusBadge
                      status={item.syncStatus}
                      lastError={item.lastSyncError}
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {item.totalChannels}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {item.totalGroups}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.lastSyncAt
                      ? formatDate(item.lastSyncAt)
                      : "Nunca"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SyncButton userId={item.userId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          basePath="/admin/iptv"
          searchParams={searchParams}
        />
      </div>
    </div>
  );
}
