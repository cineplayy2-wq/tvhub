import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { redis } from "@/lib/redis";
import { CorpoGrandeDemais, lerJsonLimitado } from "@/lib/http-guard";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Curtida é um clique: 120/min já está muito acima do humano, e impede que
    // um laço infle o contador e encha o Redis de chaves.
    const limite = await rateLimit("reel-like", user.id, 120, 60);
    if (!limite.allowed) {
      return NextResponse.json({ error: "Muitas curtidas seguidas" }, { status: 429 });
    }

    let corpo: { reelId?: unknown };
    try {
      corpo = await lerJsonLimitado<{ reelId?: unknown }>(request);
    } catch (erro) {
      const status = erro instanceof CorpoGrandeDemais ? 413 : 400;
      return NextResponse.json({ error: "Requisição inválida" }, { status });
    }

    /**
     * O id vira CHAVE do Redis.
     *
     * Sem teto de tamanho e sem formato aceito, qualquer string entra: dá para
     * gravar lixo ilimitado no cache e, com `:` no valor, colidir com o espaço
     * de nomes de outras chaves do app.
     */
    const reelId =
      typeof corpo.reelId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(corpo.reelId)
        ? corpo.reelId
        : null;

    if (!reelId) {
      return NextResponse.json({ error: "reelId inválido" }, { status: 400 });
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
      // Curtir. Com validade: sem TTL a chave por usuário/reel fica no Redis
      // para sempre, e o número dela cresce com usuários × conteúdo — memória
      // que nunca volta, num Redis compartilhado com outra stack.
      await redis.set(userLikeKey, "1", "EX", 90 * 24 * 60 * 60);
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
