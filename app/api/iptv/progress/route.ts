import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getActiveProfile } from "@/lib/auth/session";
import { saveWatchProgress } from "@/lib/iptv/watch-progress-service";
import { CorpoGrandeDemais, lerJsonLimitado } from "@/lib/http-guard";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const activeProfile = await getActiveProfile(user.id);
    if (!activeProfile?.id) {
      return NextResponse.json({ error: "Perfil não selecionado" }, { status: 400 });
    }

    /**
     * O player grava a cada 8 segundos por espectador. O teto é generoso para
     * o uso legítimo e fecha a porta para um laço em JavaScript escrevendo no
     * banco sem limite — o Postgres divide a VPS com outro sistema.
     */
    const limite = await rateLimit("progress", activeProfile.id, 60, 60);
    if (!limite.allowed) {
      return NextResponse.json({ error: "Muitas gravações" }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = await lerJsonLimitado<Record<string, unknown>>(req);
    } catch (erro) {
      const status = erro instanceof CorpoGrandeDemais ? 413 : 400;
      return NextResponse.json({ error: "Requisição inválida" }, { status });
    }

    const { titleName, channelId, tmdbId, tmdbMediaType, positionSeconds, durationSeconds } =
      body as {
        titleName?: unknown;
        channelId?: unknown;
        tmdbId?: unknown;
        tmdbMediaType?: unknown;
        positionSeconds?: unknown;
        durationSeconds?: unknown;
      };

    if (
      typeof titleName !== "string" ||
      !titleName.trim() ||
      typeof positionSeconds !== "number" ||
      !Number.isFinite(positionSeconds) ||
      positionSeconds < 0
    ) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    await saveWatchProgress({
      profileId: activeProfile.id,
      // Corta o título: ele vira chave de progresso e não tem por que ter
      // mais que isso. Sem corte, um nome de 10 MB entra direto no banco.
      titleName: titleName.slice(0, 300),
      channelId: typeof channelId === "string" ? channelId.slice(0, 64) : "",
      tmdbId: typeof tmdbId === "number" && Number.isFinite(tmdbId) ? tmdbId : undefined,
      tmdbMediaType:
        typeof tmdbMediaType === "string" ? tmdbMediaType.slice(0, 16) : undefined,
      positionSeconds: Math.floor(positionSeconds),
      durationSeconds:
        typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
          ? Math.max(0, Math.floor(durationSeconds))
          : 0,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Watch progress API error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
