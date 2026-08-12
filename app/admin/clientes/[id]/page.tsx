import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockUserButton } from "@/components/admin/block-user-button";
import {
  PaymentStatusPill,
  SubscriptionPill,
  UserStatusPill,
} from "@/components/admin/status-pill";
import { PlanoDoCliente } from "@/components/admin/plano-do-cliente";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { prisma } from "@/lib/prisma";
import { getCustomer } from "@/lib/queries/admin";
import { formatDate, formatPrice, parseDeviceLabel } from "@/lib/utils";
import { CheckCircle, AlertTriangle, RefreshCw, Database, Film, Tv, Radio } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const customer = await getCustomer(params.id);
  if (!customer) notFound();

  const planosAtivos = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, priceCents: true, interval: true, deviceLimit: true },
  });

  return (
    <div className="px-8 py-10 space-y-8">
      <Link
        href="/admin/clientes"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground inline-flex items-center gap-1"
      >
        ← Voltar para Clientes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {customer.name ?? "Sem nome"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{customer.email}</p>
          <div className="mt-3 flex items-center gap-2">
            <UserStatusPill status={customer.status} />
            <SubscriptionPill status={customer.subscription?.status} />
          </div>
        </div>

        <BlockUserButton
          userId={customer.id}
          isBlocked={customer.status !== "ACTIVE"}
          size="md"
        />
      </div>

      {customer.blockedReason && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4">
          <p className="text-sm text-foreground">
            <span className="font-medium">Motivo do bloqueio:</span>{" "}
            {customer.blockedReason}
          </p>
          {customer.blockedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Em {formatDate(customer.blockedAt)}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- Assinatura ---------- */}
        <section className="rounded-xl border border-border/80 bg-surface/50 p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Assinatura & Plano
          </h2>

          {customer.subscription ? (
            <dl className="space-y-3 text-sm">
              <Row label="Plano" value={customer.subscription.plan.name} />
              <Row
                label="Valor"
                value={formatPrice(customer.subscription.plan.priceCents)}
              />
              <Row
                label="Telas simultâneas"
                value={String(customer.subscription.plan.deviceLimit)}
              />
              <Row
                label="Período atual"
                value={
                  customer.subscription.currentPeriodEnd
                    ? `até ${formatDate(customer.subscription.currentPeriodEnd)}`
                    : "—"
                }
              />
              <Row
                label="Próxima cobrança"
                value={
                  customer.subscription.cancelAtPeriodEnd
                    ? "Cancelamento agendado"
                    : customer.subscription.nextChargeAt
                      ? formatDate(customer.subscription.nextChargeAt)
                      : "—"
                }
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este cliente não possui assinatura ativa.
            </p>
          )}

          <div className="mt-5 border-t border-border/60 pt-5">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {customer.subscription ? "Trocar plano" : "Atribuir plano"}
            </p>
            <PlanoDoCliente
              userId={customer.id}
              planos={planosAtivos}
              planoAtualId={customer.subscription?.plan.id}
              temAssinatura={Boolean(customer.subscription)}
            />
          </div>
        </section>

        {/* ---------- Conta & Perfis ---------- */}
        <section className="rounded-xl border border-border/80 bg-surface/50 p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Conta & Perfis ({customer.profiles.length})
          </h2>

          <dl className="space-y-3 text-sm">
            <Row label="Data de Cadastro" value={formatDate(customer.createdAt)} />
            <Row
              label="Último login"
              value={
                customer.lastLoginAt ? formatDate(customer.lastLoginAt) : "Nunca"
              }
            />
          </dl>

          <div className="mt-5 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perfis de Consumo</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {customer.profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-elevated/40 p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <ProfileAvatar
                      id={profile.id}
                      name={profile.name}
                      isKids={profile.isKids}
                      size="sm"
                      className="h-7 w-7 rounded-full text-xs font-bold"
                    />
                    <div>
                      <span className="block text-xs font-bold text-foreground">{profile.name}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {profile.isKids ? "Perfil Infantil" : "Perfil Adulto"}
                      </span>
                    </div>
                  </div>
                  {profile.pinHash && (
                    <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                      PIN
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border/80 bg-surface/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              IPTV — permissões do cliente
            </h2>
            <Link
              href={`/admin/iptv/${customer.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-surface-hover"
            >
              <Database className="h-3.5 w-3.5" /> Módulo +18 e categorias →
            </Link>
          </div>

          <dl className="space-y-3 text-sm">
            <Row
              label="Módulo adulto"
              value={customer.adultUnlocked ? "Liberado" : "Bloqueado"}
            />
            <Row
              label="Catálogo"
              value="Compartilhado — veja /admin/iptv para fontes e sync"
            />
          </dl>
        </section>

        {/* ---------- Sessões de Reprodução Recentes ---------- */}
        <section className="rounded-xl border border-border/80 bg-surface/50 p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Sessões de Reprodução ({customer.streamSessions.length})
          </h2>

          {customer.streamSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma sessão de reprodução iniciada.
            </p>
          ) : (
            <ul className="space-y-2.5 divide-y divide-border/40">
              {customer.streamSessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-4 pt-2 text-xs"
                >
                  <div>
                    <span className="font-semibold text-foreground">
                      {session.deviceLabel ?? parseDeviceLabel(null)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatDate(session.startedAt)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-muted-foreground block">
                      {session.ipAddress ?? "127.0.0.1"}
                    </span>
                    {session.isActive ? (
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Online Agora</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Finalizada</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
