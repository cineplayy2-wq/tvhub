import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/session";
import { parseM3u } from "@/lib/iptv/m3u-parser";
import { fetchXtreamPlaylist } from "@/lib/iptv/xtream-client";
import { detectCategory } from "@/lib/iptv/category-detector";

/**
 * POST /api/iptv/preview
 *
 * Recebe URL/Xtream/raw e retorna preview dos canais sem salvar.
 */
export async function POST(request: Request) {
  await requireAdmin();

  const body = await request.json();
  const { sourceType, sourceUrl, rawContent, xtreamServer, xtreamUsername, xtreamPassword } = body;

  try {
    let parsed;

    switch (sourceType) {
      case "URL": {
        if (!sourceUrl) {
          return NextResponse.json({ error: "URL não informada" }, { status: 400 });
        }
        const res = await fetch(sourceUrl, { next: { revalidate: 0 } });
        if (!res.ok) {
          return NextResponse.json(
            { error: `Falha ao baixar: HTTP ${res.status}` },
            { status: 400 },
          );
        }
        const text = await res.text();
        parsed = parseM3u(text);
        break;
      }

      case "RAW_TEXT": {
        if (!rawContent) {
          return NextResponse.json({ error: "Conteúdo M3U não informado" }, { status: 400 });
        }
        parsed = parseM3u(rawContent);
        break;
      }

      case "XTREAM": {
        if (!xtreamServer || !xtreamUsername || !xtreamPassword) {
          return NextResponse.json(
            { error: "Credenciais Xtream incompletas" },
            { status: 400 },
          );
        }
        parsed = await fetchXtreamPlaylist(xtreamServer, xtreamUsername, xtreamPassword);
        break;
      }

      default:
        return NextResponse.json({ error: "Tipo de fonte inválido" }, { status: 400 });
    }

    // Enrich groups with categories
    const groups = parsed.groups.map((name) => ({
      name,
      category: detectCategory(name),
      channelCount: parsed.channels.filter((ch) => ch.groupTitle === name).length,
    }));

    return NextResponse.json({
      totalChannels: parsed.channels.length,
      totalGroups: parsed.groups.length,
      groups,
      // Send only first 50 channels for preview
      sampleChannels: parsed.channels.slice(0, 50).map((ch) => ({
        name: ch.name,
        groupTitle: ch.groupTitle,
        logoUrl: ch.logoUrl,
        quality: ch.quality,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao processar a lista",
      },
      { status: 500 },
    );
  }
}
