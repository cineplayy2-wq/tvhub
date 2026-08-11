/**
 * DeepSeek AI Client for HUBFLIX
 * Handles AI content auto-categorization and the CineAI Recommendation Assistant
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "sk-0613a39080294b46bef589aba9effab8";
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1";

export interface AiCategorizationResult {
  groupName: string;
  category: "movies" | "series" | "sports" | "kids" | "news" | "music" | "documentaries" | "adult" | "live";
  reason: string;
}

/**
 * Call DeepSeek AI to categorize a list of M3U group names and channel samples
 */
export async function categorizeGroupsWithAi(
  groupsWithSamples: Array<{ name: string; sampleChannel: string }>
): Promise<Record<string, string>> {
  if (!DEEPSEEK_API_KEY) return {};

  try {
    const prompt = `Você é um especialista em classificação de listas IPTV do Brasil e Portugal.
Dada a lista de nomes de grupos e exemplos de canais abaixo, você deve categorizar CADA grupo estritamente em um dos seguintes IDs de categoria:
- "movies" (Filmes, Lançamentos, VOD, Telecine, Netflix)
- "series" (Séries, Doramas, Animes, Novelas, Globoplay)
- "sports" (Futebol, Premiere, SporTV, ESPN, Combate, CazéTV, NBA, UFC, Motores)
- "kids" (Infantil, Animação, Barbie, Disney, Desenhos 24H, Nick Jr, Heróis)
- "news" (Jornalismo, Notícias, GloboNews, CNN)
- "music" (Música, Shows, Clipes, MTV)
- "documentaries" (Documentários, Discovery, History, NatGeo)
- "adult" (Adulto, +18, XXX, OnlyFans)
- "live" (TV aberta, Canais Regionais, Variedades ao vivo)

Entrada:
${JSON.stringify(groupsWithSamples, null, 2)}

Responda APENAS um JSON VÁLIDO no formato:
{
  "classificacoes": [
    { "groupName": "NOME_DO_GRUPO", "category": "ID_DA_CATEGORIA" }
  ]
}`;

    const res = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("DeepSeek API error:", await res.text());
      return {};
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return {};

    const parsed = JSON.parse(content);
    const result: Record<string, string> = {};
    if (Array.isArray(parsed.classificacoes)) {
      for (const item of parsed.classificacoes) {
        if (item.groupName && item.category) {
          result[item.groupName] = item.category;
        }
      }
    }
    return result;
  } catch (err) {
    console.error("AI categorization exception:", err);
    return {};
  }
}

export interface AiRecommendationRequest {
  userPrompt: string;
  availableChannels: Array<{
    id: string;
    name: string;
    category: string;
    groupName?: string;
    logoUrl?: string | null;
  }>;
}

export interface AiRecommendationResponse {
  message: string;
  recommendations: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
}

/**
 * CineAI Interactive Assistant - Chat with user & recommend content
 */
export async function askCineAiAssistant(
  userPrompt: string,
  availableChannels: Array<{ id: string; name: string; category: string; groupName?: string }>
): Promise<AiRecommendationResponse> {
  try {
    const contextPrompt = `Você é o "CineAI", o assistente virtual super amigável, inteligente e especializado da plataforma HUBFLIX.
Sua missão é entender os gostos do cliente (filmes, séries, esportes ao vivo, desenhos para crianças) e indicar o que assistir de forma carismática e útil.

Você tem acesso ao catálogo atual do usuário (amostra de conteúdos disponíveis na conta dele):
${JSON.stringify(availableChannels.slice(0, 80), null, 2)}

Mensagem do Usuário: "${userPrompt}"

Instruções:
1. Responda em português de forma empolgante, sofisticada e amigável.
2. Selecione de 1 a 4 conteúdos da lista acima que MELHOR se adaptam ao pedido do cliente.
3. Se o usuário perguntar por um esporte (ex: Brasileirão), indique canais como Premiere ou SporTV. Se for crianças, indique Barbie, Disney ou Desenhos 24H.
4. Forneça o campo "recommendations" com a ID exata do item e o motivo curto da indicação.

Responda APENAS em formato JSON válido:
{
  "message": "Sua resposta amigável para o cliente...",
  "recommendations": [
    { "id": "ID_DO_ITEM", "name": "NOME_DO_ITEM", "reason": "Motivo da indicação..." }
  ]
}`;

    const res = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: contextPrompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      throw new Error(`DeepSeek API status ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from AI");

    const parsed = JSON.parse(content);
    return {
      message: parsed.message || "Aqui estão algumas opções incríveis para você!",
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (err) {
    console.error("CineAI Error:", err);
    return {
      message: "Olá! Posso te ajudar a encontrar os melhores filmes, séries, desenhos ou jogos ao vivo! O que você gostaria de assistir agora?",
      recommendations: [],
    };
  }
}
