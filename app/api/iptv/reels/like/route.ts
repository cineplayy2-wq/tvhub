import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { redis } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { reelId } = await request.json();
    if (!reelId) {
      return NextResponse.json({ error: "reelId é obrigatório" }, { status: 400 });
    }

    const likesKey = `reel:likes:${reelId}`;
    const userLikeKey = `reel:user:${user.id}:${reelId}`;

    const alreadyLiked = await redis.get(userLikeKey);
    let count: number;

    if (alreadyLiked) {
      // Uncurtir (toggle)
      await redis.del(userLikeKey);
      const decr = await redis.decr(likesKey);
      count = Math.max(0, decr);
    } else {
      // Curtir
      await redis.set(userLikeKey, "1");
      count = await redis.incr(likesKey);
    }

    return NextResponse.json({
      success: true,
      liked: !alreadyLiked,
      count,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao processar curtida" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const reelId = searchParams.get("reelId");

    if (!reelId) {
      return NextResponse.json({ count: 0, liked: false });
    }

    const likesKey = `reel:likes:${reelId}`;
    const userLikeKey = user?.id ? `reel:user:${user.id}:${reelId}` : null;

    const [rawCount, liked] = await Promise.all([
      redis.get(likesKey),
      userLikeKey ? redis.get(userLikeKey) : null,
    ]);

    const realCount = Number(rawCount) || 0;

    return NextResponse.json({
      count: realCount,
      liked: Boolean(liked),
    });
  } catch {
    return NextResponse.json({ count: 0, liked: false });
  }
}
