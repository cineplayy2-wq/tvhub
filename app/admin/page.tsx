import Link from "next/link";
import { StatCard } from "@/components/admin/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { getAdminOverview } from "@/lib/queries/admin";
import { formatPrice, formatDate } from "@/lib/utils";
import { Tv, Activity, Users, Database, ShieldAlert, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const overview = await getAdminOverview();

  return (
    <div className="px-8 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Painel Analítico de Controle
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitoramento em tempo real de clientes, dispositivos ativos, listas IPTV e receita.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/iptv"
            className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
          >
            <Database className="h-4 w-4 text-primary" />
            Gerenciar Listas IPTV
          </Link>
          <Link
            href="/admin/clientes"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            Gerenciar Clientes
          </Link>
        </div>
      </div>

      {/* Primary Analytical Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <StatCard
          label="Contas de Clientes"
          value={overview.totalUsers}
          hint={`${overview.activeSubscriptions} com assinaturas ativas`}
        />
        <StatCard
          label="Receita (Últimos 30 Dias)"
          value={formatPrice(overview.revenueLast30Cents)}
          hint="Soma dos pagamentos confirmados"
        />
        <StatCard
          label="Assistindo Agora (Sessões)"
          value={overview.activeStreams}
          hint="Conexões ativas no player"
          tone={overview.activeStreams > 0 ? "default" : "default"}
        />
        <StatCard
          label="Clientes Bloqueados"
          value={overview.blockedUsers}
          tone={overview.blockedUsers > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Listas IPTV Cadastradas"
          value={overview.totalPlaylists}
          hint="Listas ativas na plataforma"
        />
        <StatCard
          label="Total de Canais / VOD"
          value={overview.totalChannels.toLocaleString("pt-BR")}
          hint="Canais e filmes sincronizados"
        />
        <StatCard
          label="Perfis de Consumo"
          value={overview.totalProfiles}
          hint="Perfis ativos entre os clientes"
        />
        <StatCard
          label="Títulos no Catálogo"
          value={overview.publishedTitles}
          hint={`${overview.draftTitles} rascunhos`}
        />
      </div>

      {/* Realtime Active Stream Sessions */}
      <div className="rounded-xl border border-border/80 bg-surface/50 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Dispositivos & Conexões Ativas Agora</h2>
              <p className="text-xs text-muted-foreground">Sessões de reprodução em tempo real pelos clientes</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
            {overview.activeStreams} dispositivo(s) online
          </span>
        </div>

        {overview.activeSessions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum cliente assistindo no momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-3 pt-2">Cliente</th>
                  <th className="pb-3 pt-2">Perfil</th>
                  <th className="pb-3 pt-2">Dispositivo / App</th>
                  <th className="pb-3 pt-2">Endereço IP</th>
                  <th className="pb-3 pt-2">Iniciado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {overview.activeSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-surface-hover/50">
                    <td className="py-3 font-semibold text-foreground">
                      {session.user?.name || session.user?.email || "Desconhecido"}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {session.profile?.name || "Padrão"}
                    </td>
                    <td className="py-3 font-medium text-foreground">
                      {session.deviceLabel || "Navegador Web"}
                    </td>
                    <td className="py-3 text-xs font-mono text-muted-foreground">
                      {session.ipAddress || "127.0.0.1"}
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {formatDate(session.startedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IPTV Playlists Sync Monitor */}
      <div className="rounded-xl border border-border/80 bg-surface/50 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Monitor de Sincronizações IPTV</h2>
              <p className="text-xs text-muted-foreground">Status e atualização das listas de reprodução dos assinantes</p>
            </div>
          </div>
          <Link href="/admin/iptv" className="text-xs font-semibold text-primary hover:underline">
            Ver todas as listas →
          </Link>
        </div>

        {overview.recentPlaylists.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma lista IPTV cadastrada.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overview.recentPlaylists.map((pl) => (
              <div key={pl.id} className="flex flex-col justify-between rounded-lg border border-border/60 bg-surface-elevated/40 p-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="truncate font-bold text-sm text-foreground">{pl.label}</span>
                    {pl.syncStatus === "SYNCED" ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle className="h-3.5 w-3.5" /> OK
                      </span>
                    ) : pl.syncStatus === "SYNCING" ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sincronizando
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> Erro
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {pl.user?.name || pl.user?.email}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                  <span>{pl.totalChannels.toLocaleString()} canais</span>
                  <span>{pl.lastSyncAt ? formatDate(pl.lastSyncAt) : "Nunca"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
