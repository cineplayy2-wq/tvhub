import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  checkUserScreensLimit,
  allocatePoolLine,
  touchStreamSession,
  releaseStreamSession,
} from "@/lib/iptv/pool-service";

export const dynamic = "force-dynamic";

// Heartbeat / Registro de Sessão
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, profileId, channelId, titleId, episodeId, deviceLabel } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId é obrigatório" }, { status: 400 });
    }

    // Valida o limite de 2 telas simultâneas por usuário
    const check = await checkUserScreensLimit(session.user.id, sessionId);
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: "Limite de 2 telas simultâneas atingido",
          code: "SCREEN_LIMIT_EXCEEDED",
          activeCount: check.activeCount,
        },
        { status: 429 },
      );
    }

    // Aloca linha no Pool se ainda não foi alocada ou renova o heartbeat
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || undefined;

    const line = await allocatePoolLine(session.user.id, sessionId, {
      profileId,
      channelId,
      titleId,
      episodeId,
      deviceLabel,
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      activeScreens: check.activeCount,
      lineAllocated: line?.label || "Padrão",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Falha ao registrar sessão" }, { status: 500 });
  }
}

// Encerramento de Sessão
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (sessionId) {
      await releaseStreamSession(sessionId, "STOPPED");
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
