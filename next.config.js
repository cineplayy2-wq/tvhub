/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Bibliotecas de vídeo compiladas junto com o app.
   *
   * O Next não transpila `node_modules` por padrão, e tanto mpegts.js quanto
   * hls.js publicam sintaxe moderna (optional chaining). Numa TV de 2015 esse
   * arquivo não faz parse e o player simplesmente não abre — sem erro visível,
   * só uma tela preta. Aqui eles passam pelo mesmo alvo do browserslist.
   */
  transpilePackages: [
    "mpegts.js",
    "hls.js",
    // Usadas por praticamente todo componente (cn, ícones, animação).
    // tailwind-merge publica optional chaining: sem transpilar, o app
    // inteiro deixa de carregar em navegador anterior ao Chrome 80.
    "tailwind-merge",
    "clsx",
    "class-variance-authority",
    "lucide-react",
    "framer-motion",
  ],

  // Empacota servidor + só as dependências realmente usadas.
  // A VPS tem 1 GB livre e não aguenta `next build`; o build sai daqui pronto.
  output: "standalone",

  images: {
    // `domains` está deprecado e não aceita curinga. remotePatterns aceita.
    remotePatterns: [
      // TMDB (The Movie Database) artes e postêres em HD
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "**.tmdb.org" },
      // Bunny Stream / Bunny CDN (thumbnails e artes do VOD)
      { protocol: "https", hostname: "**.b-cdn.net" },
      // Mux (caso o provider escolhido seja Mux)
      { protocol: "https", hostname: "image.mux.com" },
      // Wikimedia Commons: capas extraídas do próprio vídeo (domínio público)
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // Arte de demonstração usada apenas no seed de desenvolvimento
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],

  },

  async headers() {
    /**
     * CSP deliberadamente PARCIAL.
     *
     * Falta `script-src` e `style-src` de propósito: o Next injeta script e
     * estilo em linha em toda página, então travar essas duas exigiria nonce
     * por requisição — mudança grande, e num app que já está frágil em
     * produção o risco de deixar a tela em branco supera o ganho.
     *
     * As diretivas abaixo são as de melhor relação proteção/risco, e nenhuma
     * delas depende de como o Next monta a página:
     *
     * - `frame-ancestors`: bloqueia clickjacking (versão moderna do
     *   X-Frame-Options, que fica junto para navegador antigo).
     * - `base-uri`: impede que um `<base>` injetado reescreva o destino de
     *   TODOS os caminhos relativos da página, inclusive os do player.
     * - `form-action`: impede que um formulário injetado poste a senha do
     *   assinante em servidor de terceiro.
     * - `object-src`: mata `<embed>` e `<object>`, que não são usados aqui e
     *   só servem de vetor.
     *
     * `img-src` aceita qualquer origem porque a arte dos canais vem dos hosts
     * do provedor, que mudam sem aviso. `frame-src` libera o YouTube por causa
     * dos trailers em Dicas. `media-src` é só a própria origem: todo vídeo
     * passa pela proxy (ver Manual do Player, §5).
     */
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' blob:",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          { key: "Content-Security-Policy", value: csp },
          /**
           * HSTS: o navegador passa a recusar http neste domínio.
           *
           * Fecha o downgrade que o cookie `secure` sozinho não cobre — a
           * PRIMEIRA requisição, antes de qualquer cookie existir.
           *
           * Sem `preload` de propósito: entrar na lista embutida dos
           * navegadores é praticamente irreversível, e este domínio ainda está
           * em mudança de infraestrutura.
           */
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        // Endpoints autenticados nunca podem ser cacheados por proxy/CDN.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
