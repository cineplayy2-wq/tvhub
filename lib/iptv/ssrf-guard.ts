import "server-only";

import { isIP } from "node:net";

/**
 * Barreira contra SSRF no proxy de streaming.
 *
 * Sem isto, `/api/iptv/stream?url=` aceita qualquer endereço e o servidor
 * busca e devolve — inclusive `http://127.0.0.1:8069` (o Odoo interno),
 * `tvhub_postgres:5432` ou metadados de cloud. Na VPS que roda um ERP em
 * produção, isso vaza a rede interna para qualquer um na internet.
 *
 * Regra: só http/https, e nenhum destino que resolva para faixa privada,
 * loopback, link-local ou hostname interno do Swarm.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  // Serviços internos da stack — nomes que o DNS do Swarm resolve
  "postgres",
  "redis",
  "tvhub_postgres",
  "tvhub_redis",
  "traefik",
  "odoo",
  "odoo_web",
  "odoo_mydb",
]);

/**
 * Faixas IPv4 que nunca devem ser alcançadas a partir do proxy.
 *
 * Exportada porque a checagem do NOME não basta. Validar só o texto da URL
 * barra `http://10.0.0.5`, mas não barra `http://interno.exemplo.com` que
 * RESOLVE para 10.0.0.5 — e não barra rebinding, onde a primeira resolução
 * devolve um endereço público e a segunda, no momento de conectar, devolve um
 * privado. A defesa completa exige olhar o endereço RESOLVIDO, e é isso que o
 * `lookup` da proxy faz com esta função.
 */
export function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 || // 10.0.0.0/8
    a === 127 || // loopback
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 169 && b === 254) || // link-local / metadados de cloud
    a === 0
  );
}

/** IPv6 que não pode ser alcançado: loopback, link-local e uso único local. */
export function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "::1" ||
    h === "::" ||
    h.startsWith("fe80") ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    // IPv4 mapeado em IPv6 (::ffff:10.0.0.5) contorna a checagem v4 crua
    (h.startsWith("::ffff:") && isPrivateIpv4(h.slice(7)))
  );
}

/** Um endereço JÁ RESOLVIDO pode ser alcançado pela proxy? */
export function enderecoResolvidoEhPermitido(address: string, family: number): boolean {
  if (!address) return false;
  if (family === 6) return !isPrivateIpv6(address);
  return !isPrivateIpv4(address);
}

export function assertPublicStreamUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL inválida.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Protocolo não permitido.");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new Error("Destino interno bloqueado.");
  }

  // IP literal: barra as faixas privadas antes mesmo de conectar
  if (isIP(host) === 4 && isPrivateIpv4(host)) {
    throw new Error("Destino em rede privada bloqueado.");
  }
  if (isIP(host) === 6 && (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd"))) {
    throw new Error("Destino em rede privada bloqueado.");
  }

  // Hostname sem ponto (ex.: "gateway") só existe em rede interna
  if (isIP(host) === 0 && !host.includes(".")) {
    throw new Error("Destino interno bloqueado.");
  }

  return url;
}
