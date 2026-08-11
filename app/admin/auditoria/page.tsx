import Link from "next/link";
import { Activity, Clock, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 25;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Auditoria & Logs do Sistema
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Histórico detalhado de ações administrativas, autenticação 2FA e alterações de contas.
        </p>
      </div>

      {/* Cards de Métricas de Auditoria */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="rounded-2xl border border-white/10 bg-surface/60 p-5 shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Total de Eventos Registrados</p>
              <h2 className="text-2xl font-black text-foreground">{total}</h2>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface/60 p-5 shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Status da Trilha de Auditoria</p>
              <h2 className="text-xl font-bold text-emerald-400">Ativa & Segura</h2>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface/60 p-5 shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Última Atividade</p>
              <h2 className="text-xs font-bold text-foreground truncate">
                {logs[0] ? formatDate(logs[0].createdAt) : "Nenhuma ação recente"}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Audit Log */}
      {logs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-surface/40 p-12 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">Nenhum registro de auditoria encontrado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">As ações dos administradores e eventos de segurança serão listados aqui.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface/60 shadow-lg">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-surface/80 text-muted-foreground font-bold">
                <th className="px-4 py-3">Data / Hora</th>
                <th className="px-4 py-3">Administrador</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Alvo</th>
                <th className="px-4 py-3">Endereço IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {log.actor ? (
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        {log.actor.name || log.actor.email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sistema / Automação</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground/80">
                    {log.targetType}:{log.targetId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {log.ipAddress || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
