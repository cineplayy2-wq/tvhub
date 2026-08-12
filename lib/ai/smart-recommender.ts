import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { cleanMediaTitle, dedupeChannels } from "@/lib/utils";

// Sem valor padrão — ver a mesma nota em lib/ai/client.ts. A chave vem só do
// ambiente; a chamada abaixo é pulada quando ela não existe.
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1";

const AI_CACHE_TTL = 86400; // 24 Hours in seconds to preserve API credits!

export interface AiPickedItem {
  id: string;
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  quality: string | null;
  isFavorite: boolean;
  relevanceScore: number;
  aiBadge: string;
  group: { name: string; slug: string; category: string | null } | null;
}

/**
 * Ultra-efficient AI-powered content recommender.
 * Caches recommendations in Redis for 24h per playlist to conserve API tokens.
 */
export async function getAiPickedCurations(playlistId: string): Promise<AiPickedItem[]> {
  const cacheKey = `ai_picked:${playlistId}`;

  // 1. Try Redis cache first (0 API cost!)
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  // 2. Fetch top candidates from user's active playlist
  const candidateChannels = await prisma.m3uChannel.findMany({
    where: {
      playlistId,
      isActive: true,
      group: { isHidden: false, category: { not: "adult" } },
    },
    take: 30,
    orderBy: { relevanceScore: "desc" },
    select: {
      id: true,
      name: true,
      streamUrl: true,
      logoUrl: true,
      quality: true,
      isFavorite: true,
      relevanceScore: true,
      group: { select: { name: true, slug: true, category: true } },
    },
  });

  const dedupedCandidates = dedupeChannels(candidateChannels);
  if (dedupedCandidates.length === 0) return [];

  // 3. Send compact JSON request to DeepSeek AI
  let aiPickedResults: Array<{ id: string; badge: string }> = [];

  try {
    const compactInput = dedupedCandidates.slice(0, 15).map((c) => ({
      id: c.id,
      title: cleanMediaTitle(c.name),
      category: c.group?.category || "live",
    }));

    const prompt = `Você é um curador inteligente de streaming. Escolha até 6 títulos marcantes da lista abaixo para recomendar na tela inicial.
Entrada: ${JSON.stringify(compactInput)}

Para cada escolhido, escreva uma tag curta (máx 4 palavras, ex: "🏆 Sucesso de Bilheteria", "🔥 Mais Comentado", "⚽ Decisão Imperdível", "⭐ Recomendado para Você").

Responda APENAS JSON válido no formato:
{
  "curadoria": [
    { "id": "ID_DO_ITEM", "badge": "TAG_CURTA" }
  ]
}`;

    // Sem chave, nem chama. Antes havia uma chave embutida no código, então a
    // requisição sempre saía autenticada. Agora que ela vem só do ambiente,
    // um pedido sem Authorization voltaria 401 a cada carregamento da home.
    // Deixar `res` nulo faz o fluxo cair no fallback "Seleção Especial" mais
    // abaixo — o mesmo caminho de quando a IA está fora do ar.
    const res = !DEEPSEEK_API_KEY ? null : await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 250,
        response_format: { type: "json_object" },
      }),
    });

    if (res?.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.curadoria)) {
          aiPickedResults = parsed.curadoria;
        }
      }
    }
  } catch (err) {
    console.error("AI Smart Recommender error:", err);
  }

  // 4. Map AI picks to channel objects with badges
  const candidateMap = new Map(dedupedCandidates.map((c) => [c.id, c]));
  const finalItems: AiPickedItem[] = [];

  if (aiPickedResults.length > 0) {
    for (const pick of aiPickedResults) {
      const found = candidateMap.get(pick.id);
      if (found) {
        finalItems.push({
          ...found,
          name: cleanMediaTitle(found.name),
          aiBadge: pick.badge || "⭐ Recomendado por IA",
        });
      }
    }
  }

  // Fallback: if AI call failed, select top 5 deduped candidates
  if (finalItems.length === 0) {
    for (const c of dedupedCandidates.slice(0, 6)) {
      finalItems.push({
        ...c,
        name: cleanMediaTitle(c.name),
        aiBadge: "✨ Seleção Especial",
      });
    }
  }

  // 5. Cache result in Redis for 24 hours (86400s)
  try {
    await redis.setex(cacheKey, AI_CACHE_TTL, JSON.stringify(finalItems));
  } catch {}

  return finalItems;
}
