import Redis from "ioredis";

/**
 * Singleton do Redis — mesma razão do Prisma: o Hot Reload do Next abriria
 * um socket novo a cada save.
 *
 * Este cliente é a fonte da verdade da trava de 2 telas simultâneas.
 * A lógica de sessões vive em lib/stream-session.ts (Módulo 6); aqui ficam
 * só a conexão e o namespace de chaves.
 */
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient() {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error(
      "REDIS_URL não configurada. O controle de telas simultâneas depende dela.",
    );
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    // Evita que uma indisponibilidade momentânea do Redis derrube a request:
    // o handler decide o fallback (ver política em lib/stream-session.ts).
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  client.on("error", (err) => {
    console.error("[redis] erro de conexão:", err.message);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Namespace único de chaves. Centralizado para evitar colisão silenciosa
 * entre módulos e para permitir varredura por padrão (`SCAN MATCH`).
 */
export const redisKeys = {
  /** Set com os sessionIds ativos de uma conta. Fonte da contagem de telas. */
  userStreams: (userId: string) => `stream:user:${userId}`,
  /** Hash com metadados da sessão de reprodução. Expira por TTL (heartbeat). */
  stream: (sessionId: string) => `stream:session:${sessionId}`,
  /** Canal pub/sub para notificar um device que ele foi derrubado. */
  streamEvents: (userId: string) => `stream:events:${userId}`,
  /** Cache das trilhas do catálogo ("Em Alta", "Lançamentos"). */
  catalogRow: (key: string) => `cache:row:${key}`,
  /** Rate limit genérico por identificador (IP ou userId). */
  rateLimit: (scope: string, id: string) => `rl:${scope}:${id}`,
  /** Cache de respostas do TMDB. Nunca inclua a api_key na chave. */
  tmdb: (path: string) => `cache:tmdb:${path}`,
} as const;
