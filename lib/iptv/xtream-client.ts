import "server-only";

import { parseM3u, type ParsedChannel, type ParsedM3u } from "./m3u-parser";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
};

type XtreamCategory = {
  category_id: string;
  category_name: string;
  parent_id: number;
};

type XtreamStream = {
  num?: number;
  name?: string;
  stream_type?: string;
  stream_id?: number | string;
  series_id?: number | string;
  stream_icon?: string;
  cover?: string;
  epg_channel_id?: string;
  category_id?: string;
};

type XtreamAuth = {
  user_info: {
    username: string;
    password: string;
    auth: number;
  };
};

function toArray<T>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object") {
    if (Array.isArray(data.streams)) return data.streams;
    if (Array.isArray(data.results)) return data.results;
    return Object.values(data);
  }
  return [];
}

/**
 * Client para APIs Xtream Codes com resiliência total a formatos de resposta de diferentes painéis.
 */
export async function fetchXtreamPlaylist(
  server: string,
  username: string,
  password: string,
): Promise<ParsedM3u> {
  const baseUrl = server.replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/player_api.php`;

  // Autenticação
  const authRes = await fetch(
    `${apiUrl}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    { headers: DEFAULT_HEADERS, next: { revalidate: 0 } },
  );

  if (!authRes.ok) {
    throw new Error(`Xtream: falha na autenticação (HTTP ${authRes.status})`);
  }

  const auth: XtreamAuth = await authRes.json();

  if (auth?.user_info?.auth !== 1) {
    throw new Error("Xtream: usuário ou senha incorretos.");
  }

  const groupSet = new Set<string>();
  const channels: ParsedChannel[] = [];

  // 1. Buscar categorias e streams de TV AO VIVO
  try {
    const categoriesRes = await fetch(
      `${apiUrl}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`,
      { headers: DEFAULT_HEADERS, next: { revalidate: 0 } },
    );
    const categoriesRaw = categoriesRes.ok ? await categoriesRes.json() : [];
    const categories: XtreamCategory[] = toArray(categoriesRaw);
    const categoryMap = new Map(categories.map((c) => [String(c.category_id), c.category_name]));

    const streamsRes = await fetch(
      `${apiUrl}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`,
      { headers: DEFAULT_HEADERS, next: { revalidate: 0 } },
    );

    if (streamsRes.ok) {
      const streamsRaw = await streamsRes.json();
      const streams: XtreamStream[] = toArray(streamsRaw);
      for (const stream of streams) {
        if (!stream.name || !stream.stream_id) continue;
        const groupTitle = categoryMap.get(String(stream.category_id)) ?? "TV ao Vivo";
        groupSet.add(groupTitle);

        const streamUrl = `${baseUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${stream.stream_id}.m3u8`;

        channels.push({
          name: stream.name,
          streamUrl,
          logoUrl: stream.stream_icon || null,
          tvgId: stream.epg_channel_id || null,
          tvgName: stream.name,
          groupTitle,
          quality: detectQualityFromName(stream.name),
          language: null,
          country: null,
        });
      }
    }
  } catch {
    //
  }

  // 2. Buscar VOD (Filmes)
  try {
    const vodCategoriesRes = await fetch(
      `${apiUrl}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_categories`,
      { headers: DEFAULT_HEADERS, next: { revalidate: 0 } },
    );
    const vodCategoriesRaw = vodCategoriesRes.ok ? await vodCategoriesRes.json() : [];
    const vodCategories: XtreamCategory[] = toArray(vodCategoriesRaw);
    const vodCategoryMap = new Map(vodCategories.map((c) => [String(c.category_id), c.category_name]));

    const vodStreamsRes = await fetch(
      `${apiUrl}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_streams`,
      { headers: DEFAULT_HEADERS, next: { revalidate: 0 } },
    );

    if (vodStreamsRes.ok) {
      const vodStreamsRaw = await vodStreamsRes.json();
      const vodStreams: XtreamStream[] = toArray(vodStreamsRaw);
      for (const stream of vodStreams) {
        if (!stream.name || !stream.stream_id) continue;
        const groupTitle = vodCategoryMap.get(String(stream.category_id)) ?? "Filmes";
        groupSet.add(groupTitle);

        const streamUrl = `${baseUrl}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${stream.stream_id}.m3u8`;

        channels.push({
          name: stream.name,
          streamUrl,
          logoUrl: stream.stream_icon || null,
          tvgId: null,
          tvgName: stream.name,
          groupTitle,
          quality: detectQualityFromName(stream.name),
          language: null,
          country: null,
        });
      }
    }
  } catch {
    //
  }

  // 3. Buscar Series (Séries)
  try {
    const seriesCategoriesRes = await fetch(
      `${apiUrl}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_categories`,
      { headers: DEFAULT_HEADERS, next: { revalidate: 0 } },
    );
    const seriesCategoriesRaw = seriesCategoriesRes.ok ? await seriesCategoriesRes.json() : [];
    const seriesCategories: XtreamCategory[] = toArray(seriesCategoriesRaw);
    const seriesCategoryMap = new Map(seriesCategories.map((c) => [String(c.category_id), c.category_name]));

    const seriesStreamsRes = await fetch(
      `${apiUrl}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series`,
      { headers: DEFAULT_HEADERS, next: { revalidate: 0 } },
    );

    if (seriesStreamsRes.ok) {
      const seriesRaw = await seriesStreamsRes.json();
      const seriesList: XtreamStream[] = toArray(seriesRaw);
      for (const series of seriesList) {
        if (!series.name) continue;
        const groupTitle = seriesCategoryMap.get(String(series.category_id)) ?? "Séries";
        groupSet.add(groupTitle);

        const streamId = series.series_id || series.stream_id;
        const streamUrl = `${baseUrl}/series/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.m3u8`;

        channels.push({
          name: series.name,
          streamUrl,
          logoUrl: series.cover || series.stream_icon || null,
          tvgId: null,
          tvgName: series.name,
          groupTitle,
          quality: detectQualityFromName(series.name),
          language: null,
          country: null,
        });
      }
    }
  } catch {
    //
  }

  // Fallback para download M3U direto via get.php se player_api retornar 0 canais
  if (channels.length === 0) {
    const m3uUrl = `${baseUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=m3u8`;
    const m3uRes = await fetch(m3uUrl, { headers: DEFAULT_HEADERS, next: { revalidate: 0 } });
    if (m3uRes.ok) {
      const text = await m3uRes.text();
      return parseM3u(text);
    }
  }

  return {
    channels,
    groups: Array.from(groupSet).sort(),
  };
}

function detectQualityFromName(name: string): string | null {
  const upper = name.toUpperCase();
  if (upper.includes("4K") || upper.includes("UHD")) return "4K";
  if (upper.includes("FHD") || upper.includes("FULL HD")) return "FHD";
  if (upper.includes(" HD") || upper.startsWith("HD ") || upper.includes("[HD]")) return "HD";
  if (upper.includes(" SD") || upper.includes("[SD]")) return "SD";
  return null;
}
