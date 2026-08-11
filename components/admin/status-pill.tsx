import { cn } from "@/lib/utils";

type Tone = "success" | "danger" | "warning" | "neutral" | "info";

const TONES: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
  neutral: "bg-surface-elevated text-muted",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Mapas centralizados: o mesmo status precisa ter a mesma cor em toda tela,
// senão o admin aprende a ler a cor errado.

export function UserStatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    ACTIVE: { tone: "success", label: "Ativo" },
    BLOCKED: { tone: "danger", label: "Bloqueado" },
    SUSPENDED: { tone: "warning", label: "Suspenso" },
  };
  const item = map[status] ?? { tone: "neutral" as Tone, label: status };
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>;
}

export function SubscriptionPill({ status }: { status?: string | null }) {
  if (!status) return <StatusPill tone="neutral">Sem assinatura</StatusPill>;

  const map: Record<string, { tone: Tone; label: string }> = {
    ACTIVE: { tone: "success", label: "Ativa" },
    TRIALING: { tone: "info", label: "Teste" },
    PAST_DUE: { tone: "warning", label: "Em atraso" },
    UNPAID: { tone: "danger", label: "Não paga" },
    CANCELED: { tone: "neutral", label: "Cancelada" },
    INCOMPLETE: { tone: "warning", label: "Incompleta" },
  };
  const item = map[status] ?? { tone: "neutral" as Tone, label: status };
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>;
}

export function ContentStatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    PUBLISHED: { tone: "success", label: "Publicado" },
    DRAFT: { tone: "warning", label: "Rascunho" },
    ARCHIVED: { tone: "neutral", label: "Arquivado" },
  };
  const item = map[status] ?? { tone: "neutral" as Tone, label: status };
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>;
}

export function VideoStatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    READY: { tone: "success", label: "Pronto" },
    PROCESSING: { tone: "info", label: "Processando" },
    PENDING: { tone: "neutral", label: "Sem vídeo" },
    ERROR: { tone: "danger", label: "Erro" },
  };
  const item = map[status] ?? { tone: "neutral" as Tone, label: status };
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>;
}

export function PaymentStatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    PAID: { tone: "success", label: "Pago" },
    PENDING: { tone: "warning", label: "Aguardando" },
    EXPIRED: { tone: "neutral", label: "Expirado" },
    FAILED: { tone: "danger", label: "Falhou" },
    REFUNDED: { tone: "info", label: "Estornado" },
    CHARGEBACK: { tone: "danger", label: "Chargeback" },
  };
  const item = map[status] ?? { tone: "neutral" as Tone, label: status };
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>;
}
