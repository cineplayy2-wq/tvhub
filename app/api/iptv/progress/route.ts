import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getActiveProfile } from "@/lib/auth/session";
import { saveWatchProgress } from "@/lib/iptv/watch-progress-service";

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

    const body = await req.json();
    const { titleName, channelId, tmdbId, tmdbMediaType, positionSeconds, durationSeconds } = body;

    if (!titleName || typeof positionSeconds !== "number") {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    await saveWatchProgress({
      profileId: activeProfile.id,
      titleName,
      channelId: channelId || "",
      tmdbId: typeof tmdbId === "number" ? tmdbId : undefined,
      tmdbMediaType: typeof tmdbMediaType === "string" ? tmdbMediaType : undefined,
      positionSeconds,
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : 0,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Watch progress API error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
