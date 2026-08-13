import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getViewablePlaylist } from "@/lib/queries/iptv";
import { getDailyReelsFeed } from "@/lib/queries/reels";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(30, Math.max(5, Number(searchParams.get("pageSize")) || 15));

    const playlist = await getViewablePlaylist(user.id);
    const feed = await getDailyReelsFeed(playlist?.id, page, pageSize);

    return NextResponse.json({
      items: feed.items,
      hasMore: feed.hasMore,
      page,
    });
  } catch (error) {
    console.error("[ReelsFeed API Error]", error);
    return NextResponse.json({ items: [], hasMore: false, page: 1 }, { status: 500 });
  }
}
