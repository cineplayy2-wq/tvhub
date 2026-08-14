import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { askCineAiAssistant } from "@/lib/ai/client";
import { CorpoGrandeDemais, lerJsonLimitado, sanitizarParaLlm } from "@/lib/http-guard";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    /**
     * Rate limit por usuário — esta rota gasta DINHEIRO.
     *
     * Cada chamada vira uma requisição paga à DeepSeek. Sem teto, uma sessão
     * autenticada em laço esvazia o crédito da conta em minutos; não precisa
     * nem de má-fé, um retry mal escrito no cliente faz o mesmo. Vinte por
     * hora cobre uso humano com folga.
     */
    const limite = await rateLimit("ai", user.id, 20, 60 * 60);
    if (!limite.allowed) {
      return NextResponse.json(
        {
          message: "Você fez muitas perguntas seguidas. Tente de novo em alguns minutos.",
          recommendations: [],
        },
        { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } },
      );
    }

    let corpo: { prompt?: unknown };
    try {
      corpo = await lerJsonLimitado<{ prompt?: unknown }>(req);
    } catch (erro) {
      const status = erro instanceof CorpoGrandeDemais ? 413 : 400;
      return NextResponse.json({ error: "Requisição inválida" }, { status });
    }

    const prompt =
      typeof corpo.prompt === "string" ? sanitizarParaLlm(corpo.prompt) : "";
    if (!prompt) {
      return NextResponse.json({ error: "Pergunta inválida" }, { status: 400 });
    }

    // Get user playlist
    const playlist = await prisma.m3uPlaylist.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!playlist) {
      return NextResponse.json({
        message: "Sua lista IPTV ainda não foi sincronizada. Adicione uma lista no painel para receber indicações personalizadas!",
        recommendations: [],
      });
    }

    // Fetch sample channels matching query keywords or popular content
    const sampleChannels = await prisma.m3uChannel.findMany({
      where: {
        playlistId: playlist.id,
        isActive: true,
        group: { isHidden: false, category: { not: "adult" } },
      },
      take: 100,
      orderBy: { relevanceScore: "desc" },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        group: { select: { name: true, category: true } },
      },
    });

    const formattedChannels = sampleChannels.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.group?.category || "live",
      groupName: c.group?.name || "",
      logoUrl: c.logoUrl,
    }));

    const aiResponse = await askCineAiAssistant(prompt, formattedChannels);

    // Enrich recommendations with actual channel logoUrl & stream details
    const channelMap = new Map(sampleChannels.map((c) => [c.id, c]));
    const enrichedRecs = aiResponse.recommendations.map((rec) => {
      const match = channelMap.get(rec.id);
      return {
        ...rec,
        logoUrl: match?.logoUrl || null,
        category: match?.group?.category || "live",
      };
    });

    return NextResponse.json({
      message: aiResponse.message,
      recommendations: enrichedRecs,
    });
  } catch (err: any) {
    console.error("CineAI API Route Error:", err);
    return NextResponse.json(
      {
        message: "Desculpe, tive um pequeno imprevisto ao consultar o catálogo. Posso te ajudar a pesquisar filmes, séries ou futebol ao vivo!",
        recommendations: [],
      },
      { status: 500 }
    );
  }
}
