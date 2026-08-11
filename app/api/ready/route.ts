import { existsSync } from "node:fs";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DRAIN_FLAG = process.env.TVHUB_DRAIN_FLAG || "/tmp/tvhub-draining";

/**
 * Readiness — quem responde ao Traefik.
 *
 * Diferente do /api/health (liveness, observado pelo Swarm), este endpoint
 * existe para dizer "pare de me mandar requisição nova". O server-entry.js
 * grava a flag de dreno assim que recebe SIGTERM, e a partir daí a resposta
 * é 503: o Traefik reprova no healthcheck e tira esta task da rotação alguns
 * segundos ANTES de o listener fechar de fato.
 *
 * Os dois precisam ser endpoints separados. Se o liveness também reprovasse
 * durante o dreno, o Swarm mataria a task no meio da drenagem — cortando
 * exatamente os streams que a drenagem existe para preservar.
 */
export async function GET() {
  if (existsSync(DRAIN_FLAG)) {
    return NextResponse.json(
      { status: "draining" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { status: "ready" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
