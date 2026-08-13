/**
 * Mesmos termos de `isAdultContent`, em expressão regular do Postgres.
 *
 * Existe porque a união com a lista secundária classifica os grupos dentro do
 * banco, onde não dá para chamar a função em JS. Manter os dois lados alinhados
 * é obrigatório: foi a divergência entre eles que deixou 3.317 canais adultos
 * visíveis no catálogo, inclusive para perfil infantil.
 */
export const PADRAO_ADULTO =
  "(adult|\\+ ?18|18 ?\\+|xxx|onlyfans|privacy|bella da semana|playboy|venus|sexy|eroti|hentai|brazzers|hustler|fap tv|penthouse|redlight|exxxotica|kinoxxx|porn)";

/** Detecta se um canal ou grupo contém conteúdo adulto (+18) por palavras-chave */
export function isAdultContent(channelName: string, groupName: string = ""): boolean {
  const combined = `${channelName} ${groupName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    combined.includes("adult") ||
    combined.includes("+18") ||
    combined.includes("18+") ||
    combined.includes("xxx") ||
    combined.includes("onlyfans") ||
    combined.includes("privacy") ||
    combined.includes("bella da semana") ||
    combined.includes("playboy") ||
    combined.includes("venus") ||
    combined.includes("sexy") ||
    combined.includes("eroti") ||
    combined.includes("hentai") ||
    combined.includes("brazzers") ||
    combined.includes("hustler") ||
    combined.includes("fap tv") ||
    combined.includes("penthouse") ||
    combined.includes("redlight") ||
    combined.includes("exxxotica") ||
    combined.includes("kinoxxx")
  );
}

/**
 * Detecta a categoria normalizada a partir do nome do grupo e do canal de forma inteligente.
 * Suporta convenções das principais listas de IPTV do Brasil.
 */
export function detectCategory(groupName: string, channelName = "", streamUrl = ""): string {
  if (isAdultContent(channelName, groupName)) {
    return "adult";
  }

  const combinedGroup = groupName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const combined = `${groupName} ${channelName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const isLiveStreamUrl =
    streamUrl.includes("/live/") ||
    (streamUrl.endsWith(".ts") && !streamUrl.includes("/series/") && !streamUrl.includes("/movie/"));

  // 1. Esportes (Canais de Esportes e Ligas)
  if (
    combined.includes("esporte") ||
    combined.includes("sport") ||
    combined.includes("futebol") ||
    combined.includes("premiere") ||
    combined.includes("espn") ||
    combined.includes("combate") ||
    combined.includes("dazn") ||
    combined.includes("caze") ||
    combined.includes("goat") ||
    combined.includes("ge tv") ||
    combined.includes("copa do brasil") ||
    combined.includes("brasileira") ||
    combined.includes("brasileirao") ||
    combined.includes("nsports") ||
    combined.includes("nba") ||
    combined.includes("nfl") ||
    combined.includes("ufc") ||
    combined.includes("league pass") ||
    combined.includes("bandsports") ||
    combined.includes("tnt sports")
  ) {
    return "sports";
  }

  // 2. Infantil / Animações
  if (
    combined.includes("infantil") ||
    combined.includes("kids") ||
    combined.includes("desenho") ||
    combined.includes("animacao") ||
    combined.includes("cartoon") ||
    combined.includes("gloob") ||
    combined.includes("discovery kids") ||
    combined.includes("boomerang") ||
    combined.includes("nick") ||
    combined.includes("tooncast") ||
    combined.includes("baby tv") ||
    combined.includes("luccas neto") ||
    combined.includes("galinha pintadinha") ||
    combined.includes("peppa") ||
    combined.includes("pocoyo")
  ) {
    return "kids";
  }

  // Se a URL apontar explicitamente para mídias VOD
  if (streamUrl.includes("/series/")) return "series";
  if (streamUrl.includes("/movie/")) return "movies";

  // Se o grupo for explicitamente um canal de TV ao vivo (ex: "CANAIS | NOVELAS", "CANAIS | TELECINE", "TV AO VIVO")
  // ou se for uma URL /live/, não deve ir para filmes/séries mesmo que contenha "novela" ou "telecine" no nome
  if (
    isLiveStreamUrl ||
    combinedGroup.includes("canais") ||
    combinedGroup.includes("tv ao vivo") ||
    combinedGroup.includes("abertos") ||
    combinedGroup.includes("variedades") ||
    combinedGroup.includes("noticias") ||
    combinedGroup.includes("legendado 24h") ||
    combinedGroup.includes("24h")
  ) {
    return "live";
  }

  // 3. Séries / Animes / Doramas (VOD)
  if (
    combinedGroup.includes("serie") ||
    combinedGroup.includes("series") ||
    combinedGroup.includes("dorama") ||
    combinedGroup.includes("anime") ||
    combinedGroup.includes("novela") ||
    combinedGroup.includes("temporada")
  ) {
    return "series";
  }

  // 4. Filmes & Mídias VOD
  if (
    combinedGroup.includes("filme") ||
    combinedGroup.includes("movie") ||
    combinedGroup.includes("vod") ||
    combinedGroup.includes("cinema") ||
    combinedGroup.includes("cine") ||
    combinedGroup.includes("lancamento") ||
    combinedGroup.includes("prime video") ||
    combinedGroup.includes("netflix") ||
    combinedGroup.includes("paramount") ||
    combinedGroup.includes("apple tv") ||
    combinedGroup.includes("hbo max")
  ) {
    return "movies";
  }

  // 5. Notícias / Jornalismo
  if (
    combined.includes("noticia") ||
    combined.includes("jornal") ||
    combined.includes("news") ||
    combined.includes("globonews") ||
    combined.includes("cnn")
  ) {
    return "news";
  }

  // 6. Música / Shows
  if (
    combined.includes("musica") ||
    combined.includes("music") ||
    combined.includes("shows") ||
    combined.includes("mtv")
  ) {
    return "music";
  }

  // 7. Documentários
  if (
    combined.includes("documentario") ||
    combined.includes("natgeo") ||
    combined.includes("history") ||
    combined.includes("discovery")
  ) {
    return "documentaries";
  }

  // 8. TV ao Vivo (Fallback)
  return "live";
}

/** Ícone padrão para cada categoria */
export const CATEGORY_ICONS: Record<string, string> = {
  movies: "🎬",
  series: "📺",
  sports: "⚽",
  kids: "🧸",
  news: "📰",
  music: "🎵",
  documentaries: "🎥",
  entertainment: "🎭",
  religious: "✝️",
  adult: "🔞",
  live: "📡",
};

/** Rótulo humano para cada categoria */
export const CATEGORY_LABELS: Record<string, string> = {
  movies: "Filmes",
  series: "Séries",
  sports: "Esportes",
  kids: "Infantil",
  news: "Notícias",
  music: "Música",
  documentaries: "Documentários",
  entertainment: "Entretenimento",
  religious: "Religioso",
  adult: "Adulto",
  live: "TV ao Vivo",
};
