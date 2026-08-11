import type { Config } from "tailwindcss";

/**
 * Paleta HUBFLIX, do manual da marca.
 *
 * Roxo #6C1DFF sobre quase-preto #0D0D14. O neutro puxa levemente para o roxo
 * (não para o azul, como na paleta anterior): fundo frio sob primária fria
 * mantém a arte do pôster como único ponto quente da tela.
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
        // --- Neutros ---
        background: "#0D0D14",
        surface: {
          DEFAULT: "#15151F",
          hover: "#1A1A23",
          elevated: "#22222E",
        },
        border: {
          DEFAULT: "#2A2A38",
          strong: "#3A3A4C",
        },
        foreground: "#F5F5F7",
        muted: {
          DEFAULT: "#9E9EAF",
          // Mínimo que ainda passa em AA para texto normal sobre #0D0D14
          foreground: "#7E7E92",
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

        // --- Primária ---
        primary: {
          DEFAULT: "#6C1DFF",
          hover: "#8A2BE2",
          active: "#5A16D6",
          foreground: "#FFFFFF",
        },
        /** Roxo claro do manual, para realce sobre fundo escuro. */
        accent: "#B15CFF",

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
        glow: "0 0 0 1px #6C1DFF, 0 0 32px -8px rgba(108, 29, 255, 0.55)",
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
