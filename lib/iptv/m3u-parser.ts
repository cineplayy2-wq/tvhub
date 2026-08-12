import "server-only";

import { createInterface } from "readline";
import { Readable } from "stream";

export type ParsedChannel = {
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  tvgId: string | null;
  tvgName: string | null;
  groupTitle: string;
  quality: string | null;
  language: string | null;
  country: string | null;
};

export type ParsedM3u = {
  channels: ParsedChannel[];
  groups: string[];
};

// Flexible attribute regexes (supporting quoted or unquoted attributes)
const GROUP_TITLE_REGEX = /group-title=(?:"([^"]*)"|'([^']*)'|([^,; \t]+))/i;
const GROUP_NAME_REGEX = /group-name=(?:"([^"]*)"|'([^']*)'|([^,; \t]+))/i;
const TVG_LOGO_REGEX = /tvg-logo=(?:"([^"]*)"|'([^']*)'|([^,; \t]+))/i;
const TVG_ID_REGEX = /tvg-id=(?:"([^"]*)"|'([^']*)'|([^,; \t]+))/i;
const TVG_NAME_REGEX = /tvg-name=(?:"([^"]*)"|'([^']*)'|([^,; \t]+))/i;

function extractAttr(line: string, regex: RegExp): string | null {
  const match = line.match(regex);
  if (!match) return null;
  const val = match[1] || match[2] || match[3];
  return val ? val.trim() : null;
}

function detectQuality(name: string): string | null {
  const upper = name.toUpperCase();
  if (upper.includes("4K") || upper.includes("UHD")) return "4K";
  if (upper.includes("FHD") || upper.includes("FULL HD")) return "FHD";
  if (upper.includes(" HD") || upper.startsWith("HD ") || upper.includes("|HD|") || upper.includes("[HD]")) return "HD";
  if (upper.includes(" SD") || upper.includes("|SD|") || upper.includes("[SD]")) return "SD";
  return null;
}

function detectLanguage(name: string, group: string): string | null {
  const combined = `${name} ${group}`.toUpperCase();
  if (/\b(PT|POR|PORTUGU[EÊ]S|DUBLADO|DUB|NACIONAL)\b/.test(combined)) return "PT";
  if (/\b(EN|ENG|ENGLISH|INGL[EÊ]S|LEGENDADO|LEG)\b/.test(combined)) return "EN";
  if (/\b(ES|ESP|ESPA[NÑ]OL|ESPANHOL)\b/.test(combined)) return "ES";
  if (/\b(FR|FRA|FRAN[CÇ]AIS|FRANC[EÊ]S)\b/.test(combined)) return "FR";
  return null;
}

function detectCountry(name: string, group: string): string | null {
  const combined = `${name} ${group}`;
  if (/🇧🇷|\bBR\b|\bBRASIL\b/i.test(combined)) return "BR";
  if (/🇺🇸|\bUS\b|\bUSA\b|\bEUA\b/i.test(combined)) return "US";
  if (/🇵🇹|\bPORTUGAL\b/i.test(combined)) return "PT";
  return null;
}

function fallbackGroupFromUrl(url: string): string {
  if (url.includes("/movie/")) return "Filmes VOD";
  if (url.includes("/series/")) return "Séries VOD";
  return "Canais ao Vivo";
}

/**
 * Lê uma M3U em fluxo e entrega pares `chave do nome -> URL` em lotes.
 *
 * Existe para a lista de backup, e a entrega é por lote de propósito: nada
 * fica acumulado aqui dentro.
 *
 * Duas versões já morreram nesse caminho. `parseM3uStream` materializa um
 * objeto por canal (nome, logo, tvg-id, grupo, qualidade, idioma, país) e
 * estourou os 240MB de heap do contêiner — derrubando o app dos assinantes,
 * porque é o mesmo processo. Guardar só um `Map` de nome→URL baixou o pico
 * para ~150MB, ainda inviável: a lista de backup tem 200 mil canais e o app
 * já ocupa boa parte do heap.
 *
 * Por isso o consumidor recebe lotes e decide onde guardá-los — na prática,
 * numa tabela de estágio no Postgres, onde memória não é problema.
 *
 * A chave sai do `normalizar` recebido, que precisa ser a MESMA função usada
 * nos canais já gravados; caso contrário nada casa.
 */
export type ItemDeBackup = {
  /** Nome normalizado — casa com M3uChannel.nameKey */
  chave: string;
  nome: string;
  url: string;
  grupo: string;
  logoUrl?: string | null;
  tvgId?: string | null;
  tvgName?: string | null;
  quality?: string | null;
  language?: string | null;
  country?: string | null;
};

export async function streamM3uUrlPairs(
  streamInput: ReadableStream | Readable,
  normalizar: (nome: string) => string,
  aoLote: (lote: ItemDeBackup[]) => Promise<void>,
  tamanhoLote = 2000,
  maxItems = 400000,
): Promise<number> {
  const readable =
    streamInput instanceof Readable
      ? streamInput
      : Readable.fromWeb(streamInput as any);

  const rl = createInterface({ input: readable, crlfDelay: Infinity });

  let currentInfo: string | null = null;
  let currentExtGrp: string | null = null;
  let lote: ItemDeBackup[] = [];
  let total = 0;

  for await (const lineRaw of rl) {
    const line = lineRaw.trim();
    if (!line) continue;

    if (/^#EXTINF/i.test(line)) {
      currentInfo = line;
      currentExtGrp = null;
      continue;
    }
    if (/^#EXTGRP:/i.test(line)) {
      currentExtGrp = line.substring(8).trim();
      continue;
    }
    if (line.startsWith("#")) continue;

    if (line.includes("://") || line.includes(".") || line.startsWith("/") || currentInfo) {
      const nome = currentInfo ? extractChannelName(currentInfo) : extractNameFromUrl(line);
      let grupo =
        (currentInfo
          ? extractAttr(currentInfo, GROUP_TITLE_REGEX) || extractAttr(currentInfo, GROUP_NAME_REGEX)
          : null) ?? currentExtGrp;
      if (!grupo || grupo.toLowerCase() === "geral" || grupo.toLowerCase() === "undefined") {
        grupo = fallbackGroupFromUrl(line);
      }

      const logoUrl = currentInfo ? extractAttr(currentInfo, TVG_LOGO_REGEX) : null;
      const tvgId = currentInfo ? extractAttr(currentInfo, TVG_ID_REGEX) : null;
      const tvgName = currentInfo ? extractAttr(currentInfo, TVG_NAME_REGEX) : null;
      const quality = detectQuality(nome);
      const language = detectLanguage(nome, grupo);
      const country = detectCountry(nome, grupo);

      currentInfo = null;
      currentExtGrp = null;

      const chave = normalizar(nome);
      if (!chave) continue;

      lote.push({
        chave,
        nome,
        url: line,
        grupo,
        logoUrl,
        tvgId,
        tvgName,
        quality,
        language,
        country,
      });
      total++;

      if (lote.length >= tamanhoLote) {
        await aoLote(lote);
        lote = [];
      }

      if (total >= maxItems) {
        rl.close();
        readable.destroy();
        break;
      }
    }
  }

  if (lote.length > 0) await aoLote(lote);
  return total;
}

/**
 * Stream M3U parser supporting up to 150,000 channels.
 */
export async function parseM3uStream(
  streamInput: ReadableStream | Readable,
  maxItems = 150000,
): Promise<ParsedM3u> {
  const readable =
    streamInput instanceof Readable
      ? streamInput
      : Readable.fromWeb(streamInput as any);

  const rl = createInterface({
    input: readable,
    crlfDelay: Infinity,
  });

  const channels: ParsedChannel[] = [];
  const groupSet = new Set<string>();

  let currentInfo: string | null = null;
  let currentExtGrp: string | null = null;

  for await (const lineRaw of rl) {
    const line = lineRaw.trim();
    if (!line) continue;

    if (/^#EXTINF/i.test(line)) {
      currentInfo = line;
      currentExtGrp = null;
      continue;
    }

    if (/^#EXTGRP:/i.test(line)) {
      currentExtGrp = line.substring(8).trim();
      continue;
    }

    if (!line.startsWith("#") && (line.includes("://") || line.includes(".") || line.startsWith("/") || currentInfo)) {
      const name = currentInfo ? extractChannelName(currentInfo) : extractNameFromUrl(line);
      let groupTitle =
        (currentInfo ? extractAttr(currentInfo, GROUP_TITLE_REGEX) || extractAttr(currentInfo, GROUP_NAME_REGEX) : null) ??
        currentExtGrp;

      if (!groupTitle || groupTitle.toLowerCase() === "geral" || groupTitle.toLowerCase() === "undefined") {
        groupTitle = fallbackGroupFromUrl(line);
      }

      groupSet.add(groupTitle);

      channels.push({
        name,
        streamUrl: line,
        logoUrl: currentInfo ? extractAttr(currentInfo, TVG_LOGO_REGEX) : null,
        tvgId: currentInfo ? extractAttr(currentInfo, TVG_ID_REGEX) : null,
        tvgName: currentInfo ? extractAttr(currentInfo, TVG_NAME_REGEX) : null,
        groupTitle,
        quality: detectQuality(name),
        language: detectLanguage(name, groupTitle),
        country: detectCountry(name, groupTitle),
      });

      currentInfo = null;
      currentExtGrp = null;

      if (channels.length >= maxItems) {
        rl.close();
        readable.destroy();
        break;
      }
    }
  }

  return {
    channels,
    groups: Array.from(groupSet).sort(),
  };
}

export function parseM3u(content: string): ParsedM3u {
  if (!content) return { channels: [], groups: [] };

  const lines = content.split(/\r?\n/);
  const channels: ParsedChannel[] = [];
  const groupSet = new Set<string>();

  let currentInfo: string | null = null;
  let currentExtGrp: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^#EXTINF/i.test(line)) {
      currentInfo = line;
      currentExtGrp = null;
      continue;
    }

    if (/^#EXTGRP:/i.test(line)) {
      currentExtGrp = line.substring(8).trim();
      continue;
    }

    if (!line.startsWith("#") && (line.includes("://") || line.includes(".") || line.startsWith("/") || currentInfo)) {
      const name = currentInfo ? extractChannelName(currentInfo) : extractNameFromUrl(line);
      let groupTitle =
        (currentInfo ? extractAttr(currentInfo, GROUP_TITLE_REGEX) || extractAttr(currentInfo, GROUP_NAME_REGEX) : null) ??
        currentExtGrp;

      if (!groupTitle || groupTitle.toLowerCase() === "geral" || groupTitle.toLowerCase() === "undefined") {
        groupTitle = fallbackGroupFromUrl(line);
      }

      groupSet.add(groupTitle);

      channels.push({
        name,
        streamUrl: line,
        logoUrl: currentInfo ? extractAttr(currentInfo, TVG_LOGO_REGEX) : null,
        tvgId: currentInfo ? extractAttr(currentInfo, TVG_ID_REGEX) : null,
        tvgName: currentInfo ? extractAttr(currentInfo, TVG_NAME_REGEX) : null,
        groupTitle,
        quality: detectQuality(name),
        language: detectLanguage(name, groupTitle),
        country: detectCountry(name, groupTitle),
      });

      currentInfo = null;
      currentExtGrp = null;
    }
  }

  return {
    channels,
    groups: Array.from(groupSet).sort(),
  };
}

function extractChannelName(line: string): string {
  const commaIndex = line.lastIndexOf(",");
  if (commaIndex !== -1) {
    const name = line.substring(commaIndex + 1).trim();
    if (name) return name;
  }
  const tvgName = extractAttr(line, TVG_NAME_REGEX);
  if (tvgName) return tvgName;
  return "Canal";
}

function extractNameFromUrl(url: string): string {
  try {
    const parts = url.split("/");
    const last = parts[parts.length - 1].split("?")[0];
    return decodeURIComponent(last) || "Stream";
  } catch {
    return "Stream";
  }
}
