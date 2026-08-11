import type { AgeRating } from "@prisma/client";

export const SITE = {
  name: "HUBFLIX",
  tagline: "O cinema que te conecta.",
  description:
    "Filmes e séries em Full HD, 2 telas ao mesmo tempo e zero anúncios em todos os planos. Pagamento por PIX, sem fidelidade e sem cartão salvo.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

// ==========================================================
// TRAVA DE TELAS SIMULTÂNEAS
// ==========================================================

export const STREAM = {
  /** Fallback quando o plano não define deviceLimit. Plan.deviceLimit manda. */
  DEFAULT_DEVICE_LIMIT: 2,
  /** Intervalo em que o player confirma que ainda está tocando. */
  HEARTBEAT_INTERVAL_MS: 15_000,
  /**
   * TTL da chave no Redis. Precisa ser > 2 heartbeats: um único heartbeat
   * perdido (rede oscilando) não pode derrubar a sessão do usuário.
   */
  SESSION_TTL_SECONDS: 45,
  /** Tolerância antes de marcar HEARTBEAT_TIMEOUT no banco. */
  GRACE_PERIOD_SECONDS: 60,
} as const;

// ==========================================================
// CATÁLOGO
// ==========================================================

/** Trilhas dinâmicas do dashboard. Colunas curadas vêm de Collection. */
export const CATALOG_ROWS = [
  { key: "continue", title: "Continuar assistindo" },
  { key: "trending", title: "Em alta" },
  { key: "new", title: "Lançamentos" },
  { key: "watchlist", title: "Minha lista" },
] as const;

export const AGE_RATING_LABEL: Record<AgeRating, string> = {
  L: "L",
  TEN: "10",
  TWELVE: "12",
  FOURTEEN: "14",
  SIXTEEN: "16",
  EIGHTEEN: "18",
};

/** Ordem crescente de restrição — usada para filtrar catálogo por perfil. */
export const AGE_RATING_ORDER: AgeRating[] = [
  "L",
  "TEN",
  "TWELVE",
  "FOURTEEN",
  "SIXTEEN",
  "EIGHTEEN",
];

/** Cor do selo de classificação indicativa (padrão brasileiro). */
export const AGE_RATING_COLOR: Record<AgeRating, string> = {
  L: "bg-emerald-600",
  TEN: "bg-sky-500",
  TWELVE: "bg-amber-500",
  FOURTEEN: "bg-orange-500",
  SIXTEEN: "bg-red-600",
  EIGHTEEN: "bg-neutral-950 ring-1 ring-white/30",
};

// ==========================================================
// PERFIS
// ==========================================================

export const PROFILE = {
  MAX_PER_ACCOUNT: 4,
  /** Teto de classificação aplicado a perfis infantis. */
  KIDS_MAX_AGE_RATING: "TWELVE" as AgeRating,
  PIN_LENGTH: 4,
} as const;

// ==========================================================
// PLAYER
// ==========================================================

export const PLAYER = {
  /** Inatividade até esconder os controles. */
  CONTROLS_HIDE_MS: 3_000,
  /** Frequência de gravação do "continuar assistindo" no banco. */
  PROGRESS_SAVE_INTERVAL_MS: 10_000,
  /** Acima disso o título conta como assistido e sai de "continuar assistindo". */
  COMPLETED_THRESHOLD: 0.92,
  /** Abaixo disso não vale registrar progresso (usuário só espiou). */
  MIN_PROGRESS_SECONDS: 30,
  SEEK_STEP_SECONDS: 10,
} as const;
