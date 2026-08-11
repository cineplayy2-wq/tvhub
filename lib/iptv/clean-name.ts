/**
 * Limpeza de nomes vindos de M3U.
 *
 * Lista de canal chega poluída: "[L] Filme Bom (2019) 4K DUBLADO |PT|".
 * Exibir isso cru é metade do motivo de a tela parecer amadora — e buscar
 * esse texto no TMDB não casa com nada.
 */

/** Marcadores técnicos que aparecem no nome e não são parte do título. */
const NOISE =
  /\b(4K|UHD|FHD|HD|SD|H265|H264|HEVC|DUBLADO|LEGENDADO|DUAL|DUB|LEG|MULTI|AO VIVO|LIVE|24H|VIP|PT|BR|EN|ES|PPV|ALT|BACKUP|TESTE)\b/gi;

/** Padrão de episódio: S01E02, 1x02, T01E02. */
const EPISODE = /\b(?:S\s?\d{1,2}\s?E\s?\d{1,3}|T\s?\d{1,2}\s?E\s?\d{1,3}|\d{1,2}x\d{1,3})\b/i;

export function cleanChannelName(raw: string): string {
  return (
    raw
      // Blocos entre colchetes e parênteses são quase sempre metadados
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\|[^|]*\|/g, " ")
      .replace(NOISE, " ")
      // Sobras de pontuação nas bordas
      .replace(/[·|:_-]+\s*$/g, " ")
      .replace(/^\s*[·|:_-]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim() || raw.trim()
  );
}

/**
 * Nome usado na busca do TMDB: além da limpeza, remove o episódio e o ano,
 * que fazem a busca falhar quando vão junto do título.
 */
export function tmdbQueryFromChannel(raw: string): string {
  return cleanChannelName(raw)
    .replace(EPISODE, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Título da série sem o episódio — usado para agrupar temporadas. */
export function seriesNameFromChannel(raw: string): string {
  const cleaned = cleanChannelName(raw);
  const index = cleaned.search(EPISODE);
  return (index > 0 ? cleaned.slice(0, index) : cleaned).trim();
}

/** Extrai S01E02 quando existir, para exibir como rótulo. */
export function episodeLabelFromChannel(raw: string): string | null {
  const match = raw.match(EPISODE);
  if (!match) return null;
  const digits = match[0].match(/\d{1,3}/g);
  if (!digits || digits.length < 2) return null;
  return `T${Number(digits[0])}:E${Number(digits[1])}`;
}
