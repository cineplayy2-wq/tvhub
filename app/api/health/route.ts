import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Healthcheck do container.
 *
 * Deliberadamente raso: responde se o processo Node está de pé, e só isso.
 * Se checasse Postgres ou Redis, uma oscilação de 5s no banco faria o Swarm
 * matar e recriar o app — trocando uma indisponibilidade curta por uma longa.
 * Dependências externas são problema de observabilidade, não de liveness.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", uptime: Math.round(process.uptime()) });
}
