/**
 * Catálogo de conteúdo legalmente redistribuível.
 *
 * REGRA DESTE ARQUIVO: nenhuma URL escrita à mão.
 *
 * A primeira versão deste catálogo tinha URLs que eu montei por dedução, e
 * 24 de 28 eram inexistentes. Agora só há duas formas de entrar:
 *
 *  - `commonsFile`: título de arquivo no Wikimedia Commons. O importador
 *    resolve URL, duração, formato e LICENÇA pela API. Se a licença não for
 *    domínio público ou Creative Commons, o item é recusado.
 *
 *  - `sourceUrl`: só para fonte de primeira mão já verificada por requisição.
 *
 * Por que Commons e não Internet Archive: o Archive é upload de usuário, e a
 * busca por título devolve mirror de YouTube e vídeo de Twitter. Não há como
 * automatizar sem despejar conteúdo de origem desconhecida no catálogo.
 * No Commons cada arquivo carrega licença declarada e verificável.
 *
 * BASE JURÍDICA para o domínio público — Lei 9.610/98, art. 44: obra
 * audiovisual é protegida por 70 anos a partir de 1º de janeiro do ano
 * seguinte à divulgação. Divulgação até 1954 = domínio público no Brasil.
 * A regra dos EUA é outra: "Night of the Living Dead" (1968) é livre lá e
 * segue protegida aqui até 2039. Por isso nada pós-1954 entra.
 *
 * As sinopses são originais, escritas para este catálogo.
 */

export type OpenTitle = {
  slug: string;
  name: string;
  originalName?: string;
  year: number;
  director: string;
  country: string;
  synopsis: string;
  genres: string[];
  ageRating: "L" | "TEN" | "TWELVE" | "FOURTEEN" | "SIXTEEN" | "EIGHTEEN";

  /** Título do arquivo no Commons, incluindo o prefixo "File:". */
  commonsFile?: string;
  /** URL direta de fonte de primeira mão, já verificada. */
  sourceUrl?: string;
  /** Duração conhecida em segundos. O Commons costuma informar a real. */
  durationSeconds?: number;
  /** Licença, quando a fonte não é o Commons. */
  license?: string;
  attribution?: string;

  tmdbQuery: string;
  /**
   * Mudo e animação sem diálogo não precisam. É por isso que o catálogo
   * pende para esses dois: legenda é obra derivada com direito próprio, e as
   * de fansub têm origem que ninguém consegue auditar.
   */
  needsSubtitlesPtBr?: boolean;
};

/**
 * Clássicos mudos do Wikimedia Commons.
 *
 * Todos com nome de arquivo confirmado por consulta à API antes de entrar
 * aqui. Mudos: sem diálogo falado, então nenhum depende de legenda pt-BR.
 * Todos anteriores a 1932 — domínio público no Brasil com folga.
 */
export const COMMONS_CLASSICS: OpenTitle[] = [
  {
    slug: "nosferatu-1922",
    name: "Nosferatu",
    originalName: "Nosferatu, eine Symphonie des Grauens",
    year: 1922,
    director: "F. W. Murnau",
    country: "DE",
    synopsis:
      "Um corretor viaja aos Cárpatos para fechar negócio com um conde recluso. O que embarca de volta no navio não é um passageiro.",
    genres: ["terror", "suspense"],
    ageRating: "FOURTEEN",
    commonsFile: "File:Nosferatu (1922).webm",
    tmdbQuery: "Nosferatu 1922",
    needsSubtitlesPtBr: false,
  },
  {
    slug: "a-viagem-a-lua-1902",
    name: "A Viagem à Lua",
    originalName: "Le Voyage dans la Lune",
    year: 1902,
    director: "Georges Méliès",
    country: "FR",
    synopsis:
      "Um grupo de astrônomos se lança à Lua dentro de uma cápsula disparada por canhão. O primeiro filme a entender que cinema não precisa obedecer à física.",
    genres: ["ficcao-cientifica", "acao"],
    ageRating: "L",
    commonsFile: "File:Le Voyage dans la Lune (1902).webm",
    tmdbQuery: "Le Voyage dans la Lune",
    needsSubtitlesPtBr: false,
  },
  {
    slug: "o-gabinete-do-dr-caligari-1920",
    name: "O Gabinete do Dr. Caligari",
    originalName: "Das Cabinet des Dr. Caligari",
    year: 1920,
    director: "Robert Wiene",
    country: "DE",
    synopsis:
      "Um hipnotizador de feira exibe um sonâmbulo que dorme há vinte e três anos. Quando os assassinatos começam, a cidade inteira parece ter sido desenhada torta de propósito.",
    genres: ["terror", "suspense"],
    ageRating: "FOURTEEN",
    commonsFile: "File:The Cabinet of Dr. Caligari (1920).webm",
    tmdbQuery: "Das Cabinet des Dr. Caligari",
    needsSubtitlesPtBr: false,
  },
  {
    slug: "o-garoto-1921",
    name: "O Garoto",
    originalName: "The Kid",
    year: 1921,
    director: "Charles Chaplin",
    country: "US",
    synopsis:
      "Um vagabundo encontra um bebê abandonado e decide criá-lo. Cinco anos depois, o Estado aparece para desfazer a única família que os dois já tiveram.",
    genres: ["comedia", "drama"],
    ageRating: "L",
    commonsFile: "File:The Kid (1921).webm",
    tmdbQuery: "The Kid 1921 Chaplin",
    needsSubtitlesPtBr: false,
  },
  {
    slug: "o-general-1926",
    name: "O General",
    originalName: "The General",
    year: 1926,
    director: "Buster Keaton",
    country: "US",
    synopsis:
      "Um maquinista recusado pelo exército persegue sozinho a locomotiva roubada que leva junto a mulher que ele ama. Tudo em cena é real, inclusive a ponte que desaba.",
    genres: ["comedia", "acao"],
    ageRating: "L",
    commonsFile: "File:The General (1926).webm",
    tmdbQuery: "The General 1926",
    needsSubtitlesPtBr: false,
  },
  {
    slug: "encouracado-potemkin-1925",
    name: "O Encouraçado Potemkin",
    originalName: "Bronenosets Potyomkin",
    year: 1925,
    director: "Sergei Eisenstein",
    country: "RU",
    synopsis:
      "A tripulação de um navio de guerra se recusa a comer carne podre e a recusa vira motim. A escadaria de Odessa transformou montagem em arma política.",
    genres: ["drama", "acao"],
    ageRating: "FOURTEEN",
    commonsFile: "File:Battleship Potemkin (1925).webm",
    tmdbQuery: "Battleship Potemkin",
    needsSubtitlesPtBr: false,
  },
];

/**
 * Animação CC-BY da Blender Foundation.
 * URLs verificadas por requisição direta ao servidor deles.
 */
export const CC_ANIMATION: OpenTitle[] = [
  {
    slug: "tears-of-steel",
    name: "Tears of Steel",
    year: 2012,
    director: "Ian Hubert",
    country: "NL",
    synopsis:
      "Em Amsterdã destruída por máquinas, um grupo de cientistas aposta que reconstruir uma lembrança pode desfazer o erro que começou a guerra.",
    genres: ["ficcao-cientifica", "acao"],
    ageRating: "TWELVE",
    durationSeconds: 734,
    // Verificado: HTTP 206. Formato .mov exige transcodificação para HLS.
    sourceUrl: "https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov",
    license: "CC BY 3.0",
    attribution: "© Blender Foundation | mango.blender.org",
    tmdbQuery: "Tears of Steel",
    needsSubtitlesPtBr: true,
  },
  {
    slug: "sintel",
    name: "Sintel",
    year: 2010,
    director: "Colin Levy",
    country: "NL",
    synopsis:
      "Uma jovem solitária cria um filhote de dragão ferido e o perde para caçadores. A busca que ela inicia atravessa anos, continentes e a própria pessoa que ela era.",
    genres: ["ficcao-cientifica", "drama"],
    ageRating: "TEN",
    durationSeconds: 888,
    // Verificado no índice do servidor. .mkv exige transcodificação.
    sourceUrl: "https://download.blender.org/durian/movies/Sintel.2010.1080p.mkv",
    license: "CC BY 3.0",
    attribution: "© Blender Foundation | durian.blender.org",
    tmdbQuery: "Sintel",
    needsSubtitlesPtBr: true,
  },
];

/**
 * Infantil — animação anterior a 1955, domínio público no Brasil.
 *
 * Nomes de arquivo confirmados por consulta à API antes de entrar aqui.
 * Sem diálogo falado: nenhum precisa de legenda, o que resolve de vez o
 * gargalo que impede escalar o resto do catálogo.
 *
 * Descartados na verificação: os "Felix the Cat S01Exx" que a busca devolveu
 * são da série de TV de 1958 — ainda protegida no Brasil até 2029.
 */
export const KIDS_ANIMATION: OpenTitle[] = [
  {
    slug: "steamboat-willie-1928",
    name: "O Vapor Willie",
    originalName: "Steamboat Willie",
    year: 1928,
    director: "Walt Disney e Ub Iwerks",
    country: "US",
    synopsis:
      "Um rato pilota um barco a vapor, apronta com a carga e transforma cada animal a bordo em instrumento musical. O curta que sincronizou som e desenho e mudou a animação.",
    genres: ["infantil", "comedia"],
    ageRating: "L",
    commonsFile: "File:Steamboat Willie (1928) by Walt Disney.webm",
    tmdbQuery: "Steamboat Willie 1928",
    needsSubtitlesPtBr: false,
  },
  {
    slug: "gertie-o-dinossauro-1914",
    name: "Gertie, o Dinossauro",
    originalName: "Gertie the Dinosaur",
    year: 1914,
    director: "Winsor McCay",
    country: "US",
    synopsis:
      "Um desenhista aposta que consegue dar vida a um dinossauro. Gertie obedece, desobedece e faz birra — o primeiro personagem animado com personalidade própria.",
    genres: ["infantil", "comedia"],
    ageRating: "L",
    commonsFile: "File:Winsor McCay (1914)Gertie the Dinosaur.webm",
    tmdbQuery: "Gertie the Dinosaur",
    needsSubtitlesPtBr: false,
  },
  {
    slug: "branca-de-neve-1916",
    name: "Branca de Neve",
    originalName: "Snow White",
    year: 1916,
    director: "J. Searle Dawley",
    country: "US",
    synopsis:
      "A versão silenciosa do conto dos irmãos Grimm que encantou um garoto chamado Walt Disney e o levou, vinte anos depois, a fazer a sua própria.",
    genres: ["infantil", "drama"],
    ageRating: "L",
    commonsFile: "File:Snow White (1916).webm",
    tmdbQuery: "Snow White 1916",
    needsSubtitlesPtBr: false,
  },
  {
    slug: "lets-sing-with-popeye-1934",
    name: "Cantando com Popeye",
    originalName: "Let's Sing With Popeye",
    year: 1934,
    director: "Dave Fleischer",
    country: "US",
    synopsis:
      "O marinheiro mais teimoso do cinema convida a plateia a cantar junto, no estilo bola-quicando dos irmãos Fleischer.",
    genres: ["infantil", "comedia"],
    ageRating: "L",
    commonsFile: "File:Let's Sing With Popeye (1934).webm",
    tmdbQuery: "Let's Sing With Popeye",
    needsSubtitlesPtBr: false,
  },
];

export const OPEN_CATALOG = [
  ...COMMONS_CLASSICS,
  ...KIDS_ANIMATION,
  ...CC_ANIMATION,
];
