import type { Config } from "tailwindcss";

/**
 * Paleta HUBFLIX, amostrada da própria logo.
 *
 * A versão anterior usava #6C1DFF — hue 261, saturação 100%. A película da
 * marca (public/brand/wordmark.png) vive em hue 282-288 com saturação entre
 * 48% e 69%: um roxo de tinta, não de LED. Meio ponto de hue já se nota lado a
 * lado; 40 pontos de saturação faziam a interface parecer de outro produto.
 *
 * Os três tons abaixo saem direto dessa amostragem — #7C2A9E é o miolo da
 * película, #611E7C a parte na sombra, #8F37B4 a parte iluminada. O `accent`
 * é o roxo claro do "X" da logo, e existe porque a primária, sendo escura o
 * bastante para carregar texto branco (7.8:1), não tem contraste para virar
 * texto sobre o fundo (2.5:1). Rótulo e ícone soltos usam `accent` (5.5:1).
 *
 * Os neutros acompanham a mesma hue: fundo azulado sob roxo avermelhado deixa
 * a tela com duas temperaturas brigando.
 *
 * O vermelho fica reservado para AO VIVO e alertas — nunca para marca.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // --- Neutros (hue 280, a mesma da marca) ---
        background: "#0C0A12",
        surface: {
          DEFAULT: "#16131D",
          hover: "#1B1724",
          elevated: "#241F30",
        },
        border: {
          DEFAULT: "#2B2536",
          strong: "#3B3349",
        },
        foreground: "#F5F3F7",
        muted: {
          DEFAULT: "#A099AF",
          // Mínimo que ainda passa em AA para texto normal sobre #0C0A12
          foreground: "#847C93",
        },

        // Banda editorial invertida. Quebra o preto contínuo e cria ritmo —
        // é o recurso que mais separa uma landing "moderna" de uma monótona.
        // Não é light mode: a área logada e o player seguem escuros.
        invert: {
          DEFAULT: "#ECEFF3",
          foreground: "#0A0B0D",
          muted: "#5A6272",
          border: "#D3D9E1",
        },

        // --- Primária (amostrada da película da logo) ---
        primary: {
          DEFAULT: "#7C2A9E",
          hover: "#8F37B4",
          active: "#611E7C",
          foreground: "#FFFFFF",
        },
        /**
         * Roxo claro do "X" da logo. É o tom que se lê SOBRE o fundo escuro —
         * a primária não serve para texto solto, só para superfície.
         */
        accent: "#B569D2",

        // --- Estados ---
        success: "#3FBF7F",
        danger: "#E5484D",
        warning: "#F5A524",
        info: "#5B8DEF",
      },

      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Impact", "sans-serif"],
      },

      fontSize: {
        // Escala fluida com clamp: sem breakpoints, o título nunca estoura no
        // celular nem fica tímido no monitor grande. O meio (vw) faz a
        // interpolação; os extremos travam o mínimo e o máximo legíveis.
        "display-sm": ["clamp(2.5rem, 8vw, 4.5rem)", { lineHeight: "0.95" }],
        "display-md": ["clamp(3.5rem, 13vw, 11rem)", { lineHeight: "0.88" }],
        "display-lg": ["clamp(4.5rem, 18vw, 16rem)", { lineHeight: "0.82" }],
        "stat": ["clamp(3rem, 10vw, 7rem)", { lineHeight: "0.9" }],
      },

      letterSpacing: {
        // Títulos grandes precisam de tracking negativo para não parecerem soltos
        display: "-0.03em",
        tightest: "-0.05em",
      },

      boxShadow: {
        // Halo do card em foco no carrossel
        glow: "0 0 0 1px #7C2A9E, 0 0 32px -8px rgba(124,42,158, 0.55)",
        card: "0 12px 40px -12px rgba(0, 0, 0, 0.85)",
      },

      transitionTimingFunction: {
        // Curva usada em modais e no auto-hide dos controles do player
        smooth: "cubic-bezier(0.32, 0.72, 0, 1)",
      },

      animation: {
        "fade-in": "fadeIn 0.4s ease-out both",
        "slide-up": "slideUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) both",
        "scale-in": "scaleIn 0.25s cubic-bezier(0.32, 0.72, 0, 1) both",
        shimmer: "shimmer 1.6s linear infinite",
        marquee: "marquee 48s linear infinite",
        "marquee-fast": "marquee 26s linear infinite",
        "marquee-reverse": "marqueeReverse 34s linear infinite",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // A lista é renderizada duas vezes; -50% fecha o loop sem emenda
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        marqueeReverse: {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
