import type {
  AgeRating,
  ContentType,
  Episode,
  Genre,
  Plan,
  Profile,
  Title,
  UserRole,
} from "@prisma/client";

// ==========================================================
// CATÁLOGO
// ==========================================================

/** Card do carrossel — só o que a UI precisa, sem trafegar sinopse inteira. */
export type TitleCard = Pick<
  Title,
  | "id"
  | "slug"
  | "name"
  | "type"
  | "posterUrl"
  | "backdropUrl"
  | "releaseYear"
  | "ageRating"
  | "durationSeconds"
>;

/** Título com progresso do perfil, usado na trilha "Continuar assistindo". */
export type TitleCardWithProgress = TitleCard & {
  progress: {
    positionSeconds: number;
    durationSeconds: number;
    percent: number;
    episodeId: string | null;
    episodeLabel: string | null;
  };
};

export type TitleDetail = Title & {
  genres: Genre[];
  episodes: Episode[];
};

/** Uma linha do dashboard. `kind` decide como o card é renderizado. */
export type CatalogRow = {
  key: string;
  title: string;
  kind: "default" | "progress";
  items: TitleCard[] | TitleCardWithProgress[];
};

export type HeroTitle = Pick<
  Title,
  | "id"
  | "slug"
  | "name"
  | "synopsis"
  | "type"
  | "backdropUrl"
  | "logoUrl"
  | "ageRating"
  | "releaseYear"
  | "durationSeconds"
> & { genres: Pick<Genre, "name" | "slug">[] };

// ==========================================================
// SESSÃO / PERFIL
// ==========================================================

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  /** Derivado da assinatura vigente — evita consultar o banco a cada render. */
  hasActiveSubscription: boolean;
  deviceLimit: number;
};

export type ProfileSummary = Pick<
  Profile,
  "id" | "name" | "avatarUrl" | "isKids" | "maxAgeRating"
> & { hasPin: boolean };

// ==========================================================
// PLAYBACK / TRAVA DE TELAS
// ==========================================================

/** Resposta de POST /api/playback/start. */
export type PlaybackGrant =
  | {
      allowed: true;
      sessionId: string;
      /** URL HLS assinada, com expiração. */
      src: string;
      startAtSeconds: number;
      heartbeatIntervalMs: number;
    }
  | {
      allowed: false;
      reason: "DEVICE_LIMIT" | "NO_SUBSCRIPTION" | "AGE_RESTRICTED" | "NOT_READY";
      /** Sessões em uso, para o usuário escolher qual derrubar. */
      activeDevices: ActiveDevice[];
    };

export type ActiveDevice = {
  sessionId: string;
  deviceLabel: string;
  titleName: string | null;
  startedAt: string;
  /** Marca o device que está fazendo a requisição. */
  isCurrent: boolean;
};

/** Evento enviado ao player via SSE quando a sessão é derrubada. */
export type StreamEvent =
  | { type: "revoked"; sessionId: string; reason: string }
  | { type: "ping" };

// ==========================================================
// PLANOS
// ==========================================================

export type PlanCard = Pick<
  Plan,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "priceCents"
  | "compareAtPriceCents"
  | "interval"
  | "features"
  | "deviceLimit"
  | "maxProfiles"
> & { isHighlighted: boolean };

// ==========================================================
// UTILITÁRIOS
// ==========================================================

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type { AgeRating, ContentType, UserRole };
