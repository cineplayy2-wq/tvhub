import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes do Tailwind resolvendo conflitos (`p-2` + `p-4` => `p-4`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 2990 => "R$ 29,90". Preços são sempre inteiros em centavos. */
export function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** 19700 / 12 => "R$ 16,42" — preço mensal equivalente do plano anual. */
export function formatMonthlyEquivalent(cents: number, months = 12) {
  return formatPrice(Math.round(cents / months));
}

/** Desconto do anual sobre 12x o mensal, arredondado. */
export function discountPercent(priceCents: number, compareAtCents: number) {
  if (compareAtCents <= 0) return 0;
  return Math.round((1 - priceCents / compareAtCents) * 100);
}

/** 7245 => "2h 0min" · 5400 => "1h 30min" · 480 => "8min" */
export function formatDuration(seconds: number) {
  if (!seconds || seconds < 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  return `${hours}h ${minutes}min`;
}

/** 3661 => "1:01:01" · 125 => "2:05" — timer do player. */
export function formatTimecode(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "Coração de Ferro: A Origem" => "coracao-de-ferro-a-origem" */
export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

/** Chave de progresso: episódio quando série, título quando filme. Ver WatchProgress. */
export function watchItemKey(titleId: string, episodeId?: string | null) {
  return episodeId ?? titleId;
}

/** Rótulo legível do device a partir do User-Agent, para a tela de sessões ativas. */
export function parseDeviceLabel(userAgent: string | null | undefined) {
  if (!userAgent) return "Dispositivo desconhecido";

  const os =
    /Windows/i.test(userAgent) ? "Windows"
    : /Android/i.test(userAgent) ? "Android"
    : /iPhone|iPad|iPod/i.test(userAgent) ? "iOS"
    : /Mac OS X/i.test(userAgent) ? "macOS"
    : /Linux/i.test(userAgent) ? "Linux"
    : "Outro";

  const browser =
    /Edg\//i.test(userAgent) ? "Edge"
    : /OPR\/|Opera/i.test(userAgent) ? "Opera"
    : /Chrome\//i.test(userAgent) ? "Chrome"
    : /Safari\//i.test(userAgent) ? "Safari"
    : /Firefox\//i.test(userAgent) ? "Firefox"
    : "Navegador";

  return `${browser} · ${os}`;
}

/** Removes emojis, quality tags, dubbing tags, resolution clutter and clean name */
export function cleanMediaTitle(rawName: string): string {
  if (!rawName) return "";
  let cleaned = rawName
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{2000}-\u{206F}\u{2100}-\u{214F}]/gu, "")
    .replace(/[⚽|✔️|★|✨|🔞|❌|⛹|🍿|📺|💬|📡|🎭|🎬|✝️|🎵|🎥|📰|🧸|⚡|🥊|🏆|🏎️|🏀|💖|🐾]/g, "")
    .replace(/\b(FULL\s*HD|ULTRA\s*HD|WEB[\s.-]?DL|BLU[\s-]?RAY|H[\s.]?26[45])\b/gi, "")
    .replace(/\b(4K|FHD|HD|SD|720P|1080P|2160P|HEVC|H\.?265|UHD|HDR|60FPS|50FPS|BLURAY|WEBDL)\b/gi, "")
    .replace(/\b(DUBLADO|LEGENDADO|DUB|LEG|DUBL|LEGEN|LEG\/DUB)\b/gi, "")
    .replace(/\b(OPCAO\s*\d+|OPÇÃO\s*\d+|BACKUP|RESERVA|ALT)\b/gi, "")
    .replace(/[¹²³⁴\d]+\s*$/g, "")
    .replace(/^[-:|/\s~]+|[-:|/\s~]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || rawName.trim();
}

/**
 * Limpa títulos de séries removendo marcações de Temporada/Episódio
 * (S01E01, T1 E2, 1x01, EP12).
 */
export function cleanSeriesTitle(rawName: string): string {
  let cleaned = cleanMediaTitle(rawName);

  const seasonEpRegex = /\s*[-:_]?\s*\b(?:S\d+\s*E\d+|T\d+\s*E\d+|S\d+|T\d+|\d+x\d+|EP?\s*\.?\s*\d+|Temporada\s*\d+|Temp\s*\d+)\b.*/i;
  if (seasonEpRegex.test(cleaned)) {
    cleaned = cleaned.replace(seasonEpRegex, "").trim();
  }

  return cleaned || rawName.trim();
}

export function tmdbSrcSet(
  url: string | null | undefined,
  widths: number[],
): string | undefined {
  if (!url || !url.includes("image.tmdb.org/t/p/")) return undefined;

  const base = url.replace(/\/t\/p\/[^/]+\//, "/t/p/{size}/");
  if (!base.includes("{size}")) return undefined;

  return widths.map((width) => `${base.replace("{size}", `w${width}`)} ${width}w`).join(", ");
}

export function normalizeTitleKey(rawName: string): string {
  return cleanMediaTitle(rawName)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(o|a|os|as|um|uma|de|do|da|dos|das|the|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchStemFor(rawName: string, maxWords = 3): string {
  const words = cleanMediaTitle(rawName).split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ").trim();
}

export function qualityRank(quality: string | null | undefined): number {
  switch ((quality ?? "").toUpperCase()) {
    case "4K":
      return 4;
    case "FHD":
      return 3;
    case "HD":
      return 2;
    case "SD":
      return 1;
    default:
      return 0;
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await task(items[index], index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

/**
 * Junta as variantes do mesmo canal num item só.
 */
export function agruparVariantes<
  T extends { id: string; name: string; quality?: string | null },
>(canais: T[]): T[] {
  const porChave = new Map<string, { indice: number; melhor: T }>();

  for (const canal of canais) {
    const chave = cleanMediaTitle(canal.name).toLowerCase();
    if (!chave) continue;

    const existente = porChave.get(chave);
    if (!existente) {
      porChave.set(chave, { indice: porChave.size, melhor: canal });
      continue;
    }

    if (qualityRank(canal.quality) > qualityRank(existente.melhor.quality)) {
      existente.melhor = canal;
    }
  }

  return [...porChave.values()]
    .sort((a, b) => a.indice - b.indice)
    .map(({ melhor }) => ({ ...melhor, name: cleanMediaTitle(melhor.name) }));
}

/** Agrupa canais e séries eliminando duplicatas de variantes (SD, HD, FHD, 4K, servidores) em um único card */
export function dedupeChannels<T extends { name: string; id: string; streamUrl?: string; group?: { category?: string | null } | null }>(channels: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of channels) {
    const isSeries = item.group?.category === "series" || (item.streamUrl && item.streamUrl.includes("/series/")) || /\bS\d+E\d+\b/i.test(item.name);
    const cleanName = isSeries ? cleanSeriesTitle(item.name) : cleanMediaTitle(item.name);
    const cleanKey = cleanName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (!cleanKey) continue;
    if (!seen.has(cleanKey)) {
      seen.add(cleanKey);
      result.push({
        ...item,
        name: cleanName,
      });
    }
  }

  return result;
}
