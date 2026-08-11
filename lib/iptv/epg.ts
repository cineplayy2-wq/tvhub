import { prisma } from "@/lib/prisma";

/**
 * Leitura e conferência de fontes de EPG (XMLTV).
 *
 * O ponto delicado aqui é memória: um XMLTV de operadora passa fácil de 100MB
 * e o contêiner roda com 320MB. Então nada de baixar o arquivo inteiro — a
 * leitura é em fluxo, com dois freios:
 *
 *   1. Num XMLTV as tags `<channel>` vêm todas ANTES das `<programme>`. Assim
 *      que aparece a primeira `<programme`, já temos a grade completa de
 *      canais e o download é abortado.
 *   2. Teto rígido de bytes, para o caso de um arquivo malformado que nunca
 *      chegue às `<programme>`.
 *
 * Só o suficiente para responder "essa URL de EPG casa com a minha lista?".
 */

const TETO_BYTES = 24 * 1024 * 1024;
const TEMPO_LIMITE_MS = 25_000;

export type ResultadoEpg = {
  ok: boolean;
  erro?: string;
  /** Quantos canais o XMLTV declara */
  canaisNoEpg: number;
  /** Quantos tvg-id distintos a lista do cliente tem */
  canaisNaLista: number;
  /** Quantos tvg-id da lista existem no EPG */
  casaram: number;
  /** Percentual de cobertura da lista */
  cobertura: number;
  /** Alguns tvg-id da lista que o EPG não cobre, para diagnóstico */
  exemplosSemCobertura: string[];
  bytesLidos: number;
  /** true = parou no teto de bytes antes de achar as `<programme>` */
  truncado: boolean;
};

/** Resultado de erro já preenchido, para quem precisa recusar antes de baixar. */
export function falhaEpg(erro: string): ResultadoEpg {
  return {
    ok: false,
    erro,
    canaisNoEpg: 0,
    canaisNaLista: 0,
    casaram: 0,
    cobertura: 0,
    exemplosSemCobertura: [],
    bytesLidos: 0,
    truncado: false,
  };
}

/** `<channel id="globo.br">` — pega o id mesmo com outros atributos antes. */
const RE_CANAL = /<channel\b[^>]*\bid\s*=\s*["']([^"']+)["']/gi;

function normalizar(id: string) {
  return id.trim().toLowerCase();
}

/**
 * Refaz um fluxo colocando de volta o pedaço já lido para farejar o gzip.
 *
 * Um `.gz` servido como octet-stream não é descomprimido pelo fetch, então
 * precisamos olhar os dois primeiros bytes — e depois devolvê-los ao fluxo.
 */
function refluir(
  primeiro: Uint8Array,
  leitor: ReadableStreamDefaultReader<Uint8Array>,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controlador) {
      controlador.enqueue(primeiro);
    },
    async pull(controlador) {
      const { done, value } = await leitor.read();
      if (done) controlador.close();
      else controlador.enqueue(value);
    },
    cancel(motivo) {
      void leitor.cancel(motivo);
    },
  });
}

/** Baixa o XMLTV em fluxo e devolve os ids de canal que ele declara. */
export async function lerCanaisDoXmltv(url: string): Promise<{
  ids: Set<string>;
  bytesLidos: number;
  truncado: boolean;
}> {
  const abortador = new AbortController();
  const relogio = setTimeout(() => abortador.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(url, {
      signal: abortador.signal,
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": "HUBFLIX-EPG/1.0" },
    });

    if (!resposta.ok) {
      throw new Error(`servidor respondeu ${resposta.status}`);
    }
    if (!resposta.body) {
      throw new Error("resposta sem corpo");
    }

    const leitor = resposta.body.getReader();
    const primeiro = await leitor.read();
    if (primeiro.done || !primeiro.value) {
      throw new Error("arquivo vazio");
    }

    // 0x1f 0x8b é a assinatura do gzip
    const ehGzip = primeiro.value[0] === 0x1f && primeiro.value[1] === 0x8b;
    let fluxo = refluir(primeiro.value, leitor);
    if (ehGzip) {
      // O tipo do DOM declara `writable: WritableStream<BufferSource>`, largo
      // demais para casar com `ReadableStream<Uint8Array>`. Em tempo de
      // execução é exatamente o que entra e sai.
      fluxo = fluxo.pipeThrough(
        new DecompressionStream("gzip") as unknown as ReadableWritablePair<
          Uint8Array,
          Uint8Array
        >,
      );
    }

    const ids = new Set<string>();
    const decodificador = new TextDecoder("utf-8");
    const leitorFinal = fluxo.getReader();

    let bytesLidos = 0;
    let sobra = "";
    let truncado = false;
    let achouProgramacao = false;

    while (!achouProgramacao) {
      const { done, value } = await leitorFinal.read();
      if (done) break;

      bytesLidos += value.byteLength;
      const trecho = sobra + decodificador.decode(value, { stream: true });

      RE_CANAL.lastIndex = 0;
      let achado: RegExpExecArray | null;
      while ((achado = RE_CANAL.exec(trecho)) !== null) {
        ids.add(normalizar(achado[1]));
      }

      // Toda `<channel>` já passou: o resto do arquivo é só programação.
      if (/<programme\b/i.test(trecho)) {
        achouProgramacao = true;
        break;
      }

      if (bytesLidos >= TETO_BYTES) {
        truncado = true;
        break;
      }

      // Guarda o fim do trecho para não perder uma tag partida entre pedaços.
      sobra = trecho.slice(-2048);
    }

    void leitorFinal.cancel().catch(() => {});
    return { ids, bytesLidos, truncado };
  } finally {
    clearTimeout(relogio);
  }
}

/** tvg-id distintos da lista, direto no SQL — 150 mil linhas não cabem na memória. */
async function tvgIdsDaLista(playlistId: string): Promise<string[]> {
  const linhas = await prisma.$queryRaw<Array<{ tvgId: string }>>`
    SELECT DISTINCT "tvgId"
    FROM "M3uChannel"
    WHERE "playlistId" = ${playlistId}
      AND "tvgId" IS NOT NULL
      AND "tvgId" <> ''
  `;
  return linhas.map((l) => normalizar(l.tvgId));
}

/**
 * Confere uma URL de EPG contra a lista do cliente.
 *
 * Nunca lança: devolve `ok: false` com a mensagem, porque isso alimenta um
 * botão de teste no painel e um erro de rede não pode derrubar a página.
 */
export async function testarFonteEpg(
  url: string,
  playlistId: string,
): Promise<ResultadoEpg> {
  try {
    const [{ ids, bytesLidos, truncado }, daLista] = await Promise.all([
      lerCanaisDoXmltv(url),
      tvgIdsDaLista(playlistId),
    ]);

    const semCobertura = daLista.filter((id) => !ids.has(id));
    const casaram = daLista.length - semCobertura.length;

    return {
      ok: true,
      canaisNoEpg: ids.size,
      canaisNaLista: daLista.length,
      casaram,
      cobertura: daLista.length ? Math.round((casaram / daLista.length) * 100) : 0,
      exemplosSemCobertura: semCobertura.slice(0, 8),
      bytesLidos,
      truncado,
    };
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.name === "AbortError"
          ? `o servidor do EPG não respondeu em ${TEMPO_LIMITE_MS / 1000}s`
          : erro.message
        : "falha desconhecida ao ler o EPG";
    return falhaEpg(mensagem);
  }
}
