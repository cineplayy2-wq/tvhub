import "server-only";

import { headers } from "next/headers";
import { redis } from "@/lib/redis";

/**
 * Região aproximada do assinante, para destacar canais do estado dele.
 *
 * Feito no SERVIDOR, não no navegador. O widget que existia chamava
 * `ipapi.co` direto do cliente, o que entrega o IP de cada assinante a um
 * terceiro e some quando um bloqueador de anúncios está ativo. Aqui o IP sai
 * do cabeçalho que o Traefik já encaminha e a resposta fica em cache no Redis.
 *
 * Falha para `null` em qualquer erro: sem região, a trilha regional
 * simplesmente não aparece. Nunca quebra a página.
 */

export type Region = {
  /** Sigla do estado, ex.: "SP". */
  state: string;
  city: string | null;
  country: string;
};

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

function clientIp(): string | null {
  const forwarded = headers().get("x-forwarded-for");
  // x-forwarded-for vem como cadeia; o cliente é o primeiro
  const ip = forwarded?.split(",")[0]?.trim() ?? headers().get("x-real-ip");
  if (!ip) return null;

  // IP privado ou loopback = desenvolvimento local, não há o que geolocalizar
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("127.") ||
    ip === "::1"
  ) {
    return null;
  }
  return ip;
}

export async function detectRegion(): Promise<Region | null> {
  const ip = clientIp();
  if (!ip) return null;

  const cacheKey = `geo:${ip}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached === "null" ? null : (JSON.parse(cached) as Region);
  } catch {
    // Redis fora só custa o cache, não a funcionalidade
  }

  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(3500),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(String(response.status));

    const data = (await response.json()) as {
      region_code?: string;
      city?: string;
      country_code?: string;
      error?: boolean;
    };

    if (data.error || !data.region_code) throw new Error("sem região");

    const region: Region = {
      state: data.region_code,
      city: data.city ?? null,
      country: data.country_code ?? "BR",
    };

    try {
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(region));
    } catch {
      /* idem */
    }

    return region;
  } catch {
    // Cacheia a falha por 1h: sem isto, todo request de um IP sem resposta
    // paga 3,5s de timeout e trava a renderização da home.
    try {
      await redis.setex(cacheKey, 3600, "null");
    } catch {
      /* idem */
    }
    return null;
  }
}

/** Nomes dos estados, para casar com o texto do nome do canal. */
export const STATE_NAMES: Record<string, string[]> = {
  AC: ["acre"],
  AL: ["alagoas"],
  AM: ["amazonas", "manaus"],
  AP: ["amapa", "amapá"],
  BA: ["bahia", "salvador"],
  CE: ["ceara", "ceará", "fortaleza"],
  DF: ["distrito federal", "brasilia", "brasília"],
  ES: ["espirito santo", "espírito santo", "vitoria", "vitória"],
  GO: ["goias", "goiás", "goiania", "goiânia"],
  MA: ["maranhao", "maranhão", "sao luis", "são luís"],
  MG: ["minas", "minas gerais", "belo horizonte"],
  MS: ["mato grosso do sul", "campo grande"],
  MT: ["mato grosso", "cuiaba", "cuiabá"],
  PA: ["para", "pará", "belem", "belém"],
  PB: ["paraiba", "paraíba", "joao pessoa", "joão pessoa"],
  PE: ["pernambuco", "recife"],
  PI: ["piaui", "piauí", "teresina"],
  PR: ["parana", "paraná", "curitiba"],
  RJ: ["rio de janeiro", "rio"],
  RN: ["rio grande do norte", "natal"],
  RO: ["rondonia", "rondônia"],
  RR: ["roraima"],
  RS: ["rio grande do sul", "porto alegre"],
  SC: ["santa catarina", "florianopolis", "florianópolis"],
  SE: ["sergipe", "aracaju"],
  SP: ["sao paulo", "são paulo", "sp"],
  TO: ["tocantins", "palmas"],
};

/** Termos de busca para achar canais da região no nome. */
export function regionSearchTerms(region: Region): string[] {
  const terms = new Set<string>([region.state.toLowerCase()]);
  for (const name of STATE_NAMES[region.state.toUpperCase()] ?? []) {
    terms.add(name);
  }
  if (region.city) terms.add(region.city.toLowerCase());
  return [...terms];
}
