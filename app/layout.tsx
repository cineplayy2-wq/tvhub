import type { Metadata, Viewport } from "next";
import { Anton, Poppins } from "next/font/google";
import "./globals.css";
import { DeviceTierProvider } from "@/components/iptv/device-tier-provider";
import { SITE } from "@/lib/constants";

/**
 * Poppins é a tipografia do manual da marca. Pesos limitados aos que o
 * projeto usa de fato — cada peso extra é uma fonte a mais para baixar, e
 * isso pesa justamente no aparelho fraco.
 */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

/**
 * Display de pôster: condensada e pesada, usada só no hero, nos números e nos
 * tickers. Fora daí manda a Poppins — display em texto corrido vira ruído.
 * O next/font baixa e hospeda no build, então não há requisição a CDN externo
 * nem salto de layout ao carregar.
 */
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

/**
 * Metadados da marca e de compartilhamento.
 *
 * `metadataBase` é obrigatório para o Next montar URL absoluta das imagens —
 * sem ele, WhatsApp, Instagram e X recebem caminho relativo e não mostram
 * prévia nenhuma. As artes vêm de app/opengraph-image.png e app/icon.png,
 * que o Next descobre pela convenção de arquivo.
 */
/**
 * URL pública, resolvida em TEMPO DE EXECUÇÃO.
 *
 * `NEXT_PUBLIC_APP_URL` não serve aqui: variáveis `NEXT_PUBLIC_` são
 * substituídas no build, e o build deste projeto roda na máquina de
 * desenvolvimento — o valor que ia embutido era `http://localhost:3000`, e
 * com ele o WhatsApp buscava a imagem de compartilhamento no localhost de
 * quem recebeu o link, ou seja, prévia nenhuma.
 *
 * `AUTH_URL` é variável de servidor, lida a cada requisição no container.
 */
const publicUrl =
  process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? SITE.url;

export const metadata: Metadata = {
  metadataBase: new URL(publicUrl),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "pt_BR",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: publicUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
};

/**
 * `themeColor` vive em `viewport`, não em `metadata` — no Next 14 o campo
 * antigo é ignorado com aviso. É o que pinta a barra do navegador no Android
 * e a status bar do PWA com o preto da marca.
 */
export const viewport: Viewport = {
  themeColor: "#0D0D14",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${poppins.variable} ${anton.variable} font-sans`}>
        <DeviceTierProvider>{children}</DeviceTierProvider>
      </body>
    </html>
  );
}
