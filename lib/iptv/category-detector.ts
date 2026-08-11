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

  // Se a URL explicitamente apontar para mídias VOD
  if (streamUrl.includes("/series/")) return "series";
  if (streamUrl.includes("/movie/")) return "movies";

  const combined = `${groupName} ${channelName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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

  // 3. Séries / Animes / Doramas
  if (
    combined.includes("serie") ||
    combined.includes("series") ||
    combined.includes("dorama") ||
    combined.includes("anime") ||
    combined.includes("novela") ||
    combined.includes("temporada")
  ) {
    return "series";
  }

  // 4. Filmes & Mídias VOD
  if (
    combined.includes("filme") ||
    combined.includes("movie") ||
    combined.includes("vod") ||
    combined.includes("cinema") ||
    combined.includes("cine") ||
    combined.includes("telecine") ||
    combined.includes("lancamento") ||
    combined.includes("legendado") ||
    combined.includes("dublado") ||
    combined.includes("acao") ||
    combined.includes("comedia") ||
    combined.includes("drama") ||
    combined.includes("terror") ||
    combined.includes("horror") ||
    combined.includes("suspense") ||
    combined.includes("ficcao") ||
    combined.includes("romance") ||
    combined.includes("prime video") ||
    combined.includes("netflix") ||
    combined.includes("paramount") ||
    combined.includes("apple tv") ||
    combined.includes("hbo") ||
    combined.includes("max")
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
