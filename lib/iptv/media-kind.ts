/**
 * É canal ao vivo ou é filme/série?
 *
 * Esta pergunta era respondida em seis lugares diferentes, cada um com a sua
 * versão, e todas começavam pela categoria do grupo:
 *
 *     group.category === "movies" || group.category === "series" || url.includes("/movie/")
 *
 * O problema é que a categoria do grupo é um palpite. Ela sai de
 * `detectCategory`, que lê o NOME do grupo — e a lista do provedor tem
 * "CANAIS | TELECINE", "CANAIS | CINEMA", "FILMES E SÉRIES 24H", todos cheios
 * de canal ao vivo. Qualquer um deles cai em `movies`, e a partir daí o canal
 * passava a ser tratado como filme: entrava no Continuar Assistindo de VOD com
 * barra de progresso, e sumia da aba de Canais.
 *
 * A URL não é palpite. `/movie/`, `/series/` e `/live/` são o caminho que o
 * próprio servidor Xtream usa, e a extensão diz o resto: `.ts` e `.m3u8` são
 * transmissão contínua, `.mp4`/`.mkv` são arquivo. Por isso ela decide
 * primeiro, e a categoria do grupo só entra quando a URL não diz nada — que é
 * o caso de listas antigas com URL sem extensão.
 */

export type MediaKind = "live" | "vod";

/** Contêiner de arquivo: existe do começo ao fim, dá para buscar posição. */
const VOD_CONTAINER = /\.(mp4|mkv|avi|webm|m4v|mov)(\?|$)/i;

/** Transmissão contínua: não tem fim conhecido nem posição para retomar. */
const LIVE_CONTAINER = /\.(ts|m3u8)(\?|$)/i;

export function mediaKindOf(input: {
  streamUrl: string | null | undefined;
  category?: string | null;
}): MediaKind {
  const url = input.streamUrl ?? "";

  // 1. Caminho do Xtream — o sinal mais confiável que existe.
  if (url.includes("/movie/") || url.includes("/series/")) return "vod";
  if (url.includes("/live/")) return "live";

  // 2. Extensão do arquivo.
  if (VOD_CONTAINER.test(url)) return "vod";
  if (LIVE_CONTAINER.test(url)) return "live";

  // 3. Só agora a categoria do grupo, que é inferida do nome e erra.
  const category = input.category ?? "";
  if (category === "movies" || category === "series") return "vod";

  // Sem nada que prove o contrário, canal ao vivo é o padrão da lista.
  return "live";
}

export function isVod(input: { streamUrl: string | null | undefined; category?: string | null }) {
  return mediaKindOf(input) === "vod";
}

export function isLive(input: { streamUrl: string | null | undefined; category?: string | null }) {
  return mediaKindOf(input) === "live";
}

/**
 * Filme ou série? Só faz sentido perguntar para quem já é VOD.
 *
 * Vale a mesma ordem: `/series/` na URL é fato; o `S01E02` no nome é forte o
 * bastante para valer mais que a categoria do grupo, porque episódio solto
 * aparece direto em grupo marcado como "movies".
 */
const EPISODE_MARK = /\b(?:S\s?\d{1,2}\s?E\s?\d{1,3}|T\s?\d{1,2}\s?E\s?\d{1,3}|\d{1,2}x\d{2,3})\b/i;

export function isSeriesItem(input: {
  streamUrl: string | null | undefined;
  name?: string | null;
  category?: string | null;
}): boolean {
  const url = input.streamUrl ?? "";
  if (url.includes("/series/")) return true;
  if (url.includes("/movie/")) return false;
  if (input.name && EPISODE_MARK.test(input.name)) return true;
  return input.category === "series";
}
