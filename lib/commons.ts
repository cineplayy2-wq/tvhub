/**
 * Resolução de mídia no Wikimedia Commons.
 *
 * Três coisas vêm daqui, todas por API e nenhuma escrita à mão:
 *
 *  1. FONTE LEVE. O arquivo original é cópia de arquivamento — "A Viagem à Lua"
 *     tem 2,3 GB a 24 Mbps. O Commons mantém derivadas transcodificadas
 *     (240p/480p/720p em VP9) e é uma delas que serve ao assinante. Servir o
 *     original é o que fazia o player não conseguir tocar.
 *
 *  2. CAPA. `thumburl` devolve um quadro do próprio filme como JPG. Acervo de
 *     domínio público quase nunca tem pôster, e card sem imagem parece defeito.
 *
 *  3. LICENÇA. Declarada por arquivo e verificável. Nada entra sem bater.
 *
 * Nada é hospedado na nossa infraestrutura: guardamos apenas a URL, e o
 * navegador do assinante busca direto no CDN da Wikimedia.
 */

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/** Só estas licenças passam. Qualquer outra coisa é recusada. */
const ACCEPTED_LICENSE = /^(public domain|cc0|cc[ -]by([ -]sa)?([ -][\d.]+)?)/i;

/**
 * Ordem de preferência das derivadas.
 * 480p é o ponto de equilíbrio: roda em conexão modesta e ainda é assistível
 * em tela cheia. 240p só como último recurso antes do original.
 */
const PREFERRED = ["480p.vp9.webm", "720p.vp9.webm", "360p.webm", "240p.vp9.webm"];

export type CommonsMedia = {
  /** URL da derivada leve (ou do original, se não houver derivada). */
  src: string;
  /** Quadro do filme servindo de capa. */
  posterUrl: string | null;
  backdropUrl: string | null;
  durationSeconds: number | null;
  license: string;
  /** true quando não havia derivada e caímos no arquivo original. */
  usingOriginal: boolean;
  originalBytes: number;
};

type Derivative = {
  src: string;
  type?: string;
  transcodekey?: string;
  bandwidth?: number;
};

/** Parâmetros de rastreio da Wikimedia: não repassar ao assinante. */
function clean(url: string) {
  return url.split("?")[0];
}

export async function resolveCommonsMedia(
  fileTitle: string,
): Promise<CommonsMedia | null> {
  const url = new URL(COMMONS_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", fileTitle);
  url.searchParams.set("prop", "videoinfo");
  url.searchParams.set("viprop", "url|size|derivatives|extmetadata");
  // Pede a miniatura já no tamanho que o card usa
  url.searchParams.set("viurlwidth", "640");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          missing?: string;
          videoinfo?: {
            url: string;
            size?: number;
            duration?: number;
            thumburl?: string;
            derivatives?: Derivative[];
            extmetadata?: Record<string, { value?: string }>;
          }[];
        }
      >;
    };
  };

  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;

  const info = page.videoinfo?.[0];
  if (!info?.url) return null;

  const license = (
    info.extmetadata?.LicenseShortName?.value ??
    info.extmetadata?.License?.value ??
    ""
  ).trim();

  // Sem licença reconhecida não entra. Não existe "provavelmente livre".
  if (!ACCEPTED_LICENSE.test(license)) return null;

  const derivatives = info.derivatives ?? [];

  let chosen: Derivative | undefined;
  for (const key of PREFERRED) {
    chosen = derivatives.find((d) => d.transcodekey === key);
    if (chosen) break;
  }

  // Nenhuma derivada conhecida: pega a de menor banda que não seja o original
  if (!chosen) {
    chosen = derivatives
      .filter((d) => d.transcodekey)
      .sort((a, b) => (a.bandwidth ?? 0) - (b.bandwidth ?? 0))[0];
  }

  const thumb = info.thumburl ? clean(info.thumburl) : null;

  return {
    src: clean(chosen?.src ?? info.url),
    posterUrl: thumb,
    // A mesma miniatura em largura maior serve de fundo na Hero e no detalhe
    backdropUrl: thumb ? thumb.replace("/640px-", "/1280px-") : null,
    durationSeconds: info.duration ? Math.round(info.duration) : null,
    license,
    usingOriginal: !chosen,
    originalBytes: info.size ?? 0,
  };
}
