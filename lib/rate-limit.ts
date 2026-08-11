import "server-only";

import { redis, redisKeys } from "@/lib/redis";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Janela fixa por escopo + identificador.
 *
 * FAIL-OPEN por decisão explícita: se o Redis cair, o login continua
 * funcionando (sem proteção) em vez de trancar todos os assinantes fora.
 * Para a trava de 2 telas a decisão é a oposta — lá o Redis é a fonte da
 * verdade e não pode ser contornado.
 */
export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = redisKeys.rateLimit(scope, identifier);

  try {
    const count = await redis.incr(key);

    // Só o primeiro hit define o TTL; os seguintes não estendem a janela
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (count > limit) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    }

    return { allowed: true, remaining: limit - count, retryAfterSeconds: 0 };
  } catch (error) {
    console.warn(
      `[rate-limit] Redis indisponível, liberando "${scope}":`,
      error instanceof Error ? error.message : error,
    );
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Limpa o contador — usado após um login bem-sucedido. */
export async function resetRateLimit(scope: string, identifier: string) {
  try {
    await redis.del(redisKeys.rateLimit(scope, identifier));
  } catch {
    // Contador residual só custa uma janela de espera; não vale falhar por isso
  }
}
