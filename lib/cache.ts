import "server-only";

import { redis } from "@/lib/redis";

/**
 * Cache de leitura em Redis.
 *
 * Regra única para toda consulta cara da área logada. Falha em silêncio nos
 * dois sentidos: Redis fora do ar custa desempenho, nunca a página.
 *
 * Não use isto para dado que precisa ser exato no instante (saldo, sessão
 * ativa). Serve para vitrine: uma trilha meia hora desatualizada não incomoda
 * ninguém, uma home que demora seis segundos incomoda todo mundo.
 */

/**
 * Teto do que vale a pena guardar.
 *
 * O Redis desta instalação roda com `maxmemory 32mb` e `noeviction`: um valor
 * grande demais não só é recusado como ocupa memória do processo Node só para
 * ser serializado. Acima deste tamanho o resultado é devolvido sem cachear.
 */
const MAX_CACHED_BYTES = 512 * 1024;

/**
 * Consultas idênticas em voo ao mesmo tempo compartilham a mesma promessa.
 *
 * A home renderiza várias trilhas em paralelo (cada uma no seu `Suspense`) e
 * mais de uma pede a mesma consulta. Sem isto, com o cache frio, a consulta
 * roda duas ou três vezes simultaneamente e o pico de memória multiplica —
 * que foi exatamente o que derrubou o container em produção.
 */
const inFlight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  build: () => Promise<T>,
): Promise<T> {
  const cacheKey = `cache:${key}`;

  try {
    const hit = await redis.get(cacheKey);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    /* segue sem cache */
  }

  const running = inFlight.get(cacheKey);
  if (running) return running as Promise<T>;

  const task = (async () => {
    const value = await build();

    try {
      const payload = JSON.stringify(value);
      if (payload.length <= MAX_CACHED_BYTES) {
        await redis.setex(cacheKey, ttlSeconds, payload);
      }
    } catch {
      /* idem */
    }

    return value;
  })();

  inFlight.set(cacheKey, task);

  try {
    return await task;
  } finally {
    inFlight.delete(cacheKey);
  }
}

/** TTLs nomeados, para não espalhar números mágicos pelas consultas. */
export const TTL = {
  /** Vitrines que dependem do TMDB: ele atualiza "em alta" uma vez por dia. */
  showcase: 60 * 30,
  /** Agregações da lista do assinante: mudam só quando a M3U sincroniza. */
  playlist: 60 * 15,
} as const;

/**
 * Descarta os caches derivados de uma playlist.
 * Chamado após a sincronização, senão o assinante veria a lista antiga.
 */
export async function invalidatePlaylistCache(playlistId: string) {
  try {
    const keys: string[] = [];
    let cursor = "0";

    do {
      const [next, batch] = await redis.scan(
        cursor,
        "MATCH",
        `cache:*${playlistId}*`,
        "COUNT",
        200,
      );
      cursor = next;
      keys.push(...batch);
    } while (cursor !== "0");

    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Cache preso é só desatualização temporária; o TTL resolve sozinho
  }
}
