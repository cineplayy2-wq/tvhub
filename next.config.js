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
