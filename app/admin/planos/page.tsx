import { Check, CreditCard, ShieldCheck, Sparkles, Tv, Users } from "lucide-react";
import { PlanoForm } from "@/components/admin/plano-form";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPlanosPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="px-8 py-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Planos & Assinaturas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os planos pré-configurados oferecidos aos clientes da plataforma.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300">
          <ShieldCheck className="h-4 w-4" />
          <span>Sistema de Pagamento PIX Pré-configurado (Modo Manual Ativo)</span>
        </div>
      </div>

      <PlanoForm
        planos={plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          interval: p.interval,
          deviceLimit: p.deviceLimit,
          maxProfiles: p.maxProfiles,
          trialDays: p.trialDays,
          features: p.features,
          isActive: p.isActive,
        }))}
      />

      {/* Grid de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="relative flex flex-col rounded-2xl border border-white/10 bg-surface/60 p-6 shadow-lg backdrop-blur-xl transition-all hover:border-primary/50"
          >
            {plan.slug === "anual" && (
              <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-0.5 text-[10px] font-extrabold uppercase text-white shadow-md">
                Mais Popular
              </span>
            )}

            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground min-h-[36px]">
                {plan.description || "Acesso completo a filmes, séries e canais ao vivo."}
              </p>
            </div>

            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-3xl font-black text-foreground">
                {formatPrice(plan.priceCents)}
              </span>
              <span className="text-xs text-muted-foreground">
                / {plan.interval === "YEAR" ? "ano" : "mês"}
              </span>
              {plan.compareAtPriceCents && (
                <span className="ml-2 text-xs text-muted-foreground line-through">
                  {formatPrice(plan.compareAtPriceCents)}
                </span>
              )}
            </div>

            {/* Regras e Limites */}
            <div className="space-y-2.5 border-t border-white/[0.08] pt-4 mb-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Tv className="h-4 w-4 text-primary" />
                <span>
                  <strong>{plan.deviceLimit}</strong> telas simultâneas
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>
                  Até <strong>{plan.maxProfiles}</strong> perfis de usuário
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Qualidade Máxima: <strong>{plan.maxQuality}</strong></span>
              </div>
            </div>

            {/* Recursos / Bullets */}
            <div className="space-y-2 border-t border-white/[0.08] pt-4 mb-6 flex-1 text-xs">
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-foreground/90">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status:</span>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold uppercase text-emerald-400">
                {plan.isActive ? "Ativo no Cliente" : "Inativo"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Resumo de Configurações dos Planos */}
      <div className="rounded-2xl border border-white/10 bg-surface/40 p-6 shadow-md">
        <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <span>Políticas de Cobrança & Atribuição de Planos</span>
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Os planos acimas estão pré-configurados e vinculados às contas dos clientes. O cliente seleciona o plano durante o cadastro ou no perfil e o sistema garante o limite de telas em tempo real via Redis. O gateway de pagamento PIX pode ser ativado diretamente em Configurações.
        </p>
      </div>
    </div>
  );
}
