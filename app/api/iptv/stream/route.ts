import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { Readable, PassThrough } from "node:stream";

import { auth } from "@/auth";
import { reconcileContentRange } from "@/lib/iptv/range";
import { assertPublicStreamUrl } from "@/lib/iptv/ssrf-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

/**
 * Cache de DNS do proxy.
 *
 * O Node não guarda resolução de nome: cada requisição consulta de novo. Em
 * HLS isso é brutal — cada espectador pede um segmento a cada ~10 segundos, e
 * cada segmento é uma consulta. Com algumas pessoas assistindo, o resolvedor
 * do contêiner começa a devolver `EAI_AGAIN` e o proxy responde 502: o vídeo
 * morre no meio sem que o provedor tenha falhado nada.
 *
 * Cinco minutos é curto o bastante para acompanhar troca de servidor do
 * provedor e longo o bastante para tirar o DNS do caminho crítico.
 */
const CACHE_DNS_MS = 5 * 60 * 1000;
const dnsCache = new Map<string, { address: string; family: number; ate: number }>();

/**
 * O formato da resposta depende de `options.all`.
 *
 * A partir do Node 20 o `autoSelectFamily` vem ligado e o socket chama o
 * lookup com `all: true`, esperando uma LISTA de endereços. Devolver o endereço
 * solto nesse caso faz o socket receber `undefined` e derrubar tudo com
 * "Invalid IP address" — foi assim que a primeira versão deste cache tirou o
 * player do ar por inteiro.
 */
function responderLookup(
  callback: unknown,
  erro: NodeJS.ErrnoException | null,
  address: string,
  family: number,
  querLista: boolean,
) {
  const cb = callback as (e: NodeJS.ErrnoException | null, a: unknown, f?: number) => void;
  if (querLista) cb(erro, erro ? [] : [{ address, family }]);
  else cb(erro, address, family);
}

const resolverCustom = new dns.Resolver();
try {
  resolverCustom.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {}

const lookupComCache: NonNullable<http.RequestOptions["lookup"]> = (
  hostname,
  options,
  callback,
) => {
  const querLista = Boolean((options as dns.LookupAllOptions)?.all);
  const agora = Date.now();
  const guardado = dnsCache.get(hostname);

  if (guardado && guardado.ate > agora) {
    process.nextTick(() =>
      responderLookup(callback, null, guardado.address, guardado.family, querLista),
    );
    return;
  }

  // Tenta resolver primeiro via DNS público direto (8.8.8.8/1.1.1.1) para ignorar gargalo de EAI_AGAIN do Docker
  resolverCustom.resolve4(hostname, (errCustom, addresses) => {
    if (!errCustom && addresses && addresses.length > 0) {
      const address = addresses[0];
      dnsCache.set(hostname, { address, family: 4, ate: agora + CACHE_DNS_MS });
      responderLookup(callback, null, address, 4, querLista);
      return;
    }

    dns.lookup(hostname, { family: 4 }, (err, address, family) => {
      if (!err && address) {
        dnsCache.set(hostname, { address, family, ate: agora + CACHE_DNS_MS });
      } else if (err) {
        // Se deu erro temporário, guarda por 5s para evitar rajada de getaddrinfo que trava o libuv
        dnsCache.set(hostname, { address: "", family: 4, ate: agora + 5000 });
      }
      responderLookup(callback, err, address, family, querLista);
    });
  });
};

/**
 * Conexões reaproveitadas para o servidor de IPTV.
 *
 * Sem agente próprio, o Node abre uma conexão TCP nova a cada requisição e
 * joga fora ao terminar. Em HLS isso é caro: cada espectador busca um segmento
 * a cada ~10 segundos, e cada busca pagava handshake completo antes do primeiro
 * byte de vídeo. Reaproveitando, o segundo segmento em diante começa a chegar
 * imediatamente — é o que tira o engasgo entre um pedaço e outro.
 *
 * `maxSockets` alto porque o gargalo aqui é o provedor, não nós; e o
 * `keepAlive` de 30s cobre com folga o intervalo entre segmentos.
 */
const agenteHttp = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60_000,
  maxSockets: 256,
  maxFreeSockets: 64,
  timeout: 30_000,
});

const agenteHttps = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60_000,
  maxSockets: 256,
  maxFreeSockets: 64,
  timeout: 30_000,
});

/**
 * Larga uma resposta do provedor sem deixar o socket pendurado.
 *
 * Esta função é o conserto do defeito que derrubava o app inteiro depois de
 * um tempo de uso — não um canal, TODOS.
 *
 * O agente HTTP tem teto de 256 sockets. Toda resposta que a gente abandona
 * sem drenar nem destruir continua ocupando uma vaga: o Node não tem como
 * saber que ninguém mais vai ler aquilo. Havia três lugares assim, e o pior
 * deles rodava em TODA abertura de canal — o player pede `.m3u8` primeiro,
 * o provedor responde 404, e a resposta 404 era simplesmente esquecida.
 *
 * A conta é direta: algumas centenas de aberturas de canal e o pool esgota.
 * A partir daí toda requisição nova de vídeo entra numa fila esperando um
 * socket que nunca vaga — e o sintoma é exatamente "parou de rodar geral",
 * até o contêiner reiniciar e zerar o pool.
 *
 * `resume()` antes de `destroy()` é de propósito: drenar devolve o socket ao
 * pool de keep-alive para ser reaproveitado, que é melhor que matá-lo. O
 * `destroy()` cobre o caso de a resposta ser grande demais para valer a pena.
 */
function descartarUpstream(res: http.IncomingMessage | null | undefined) {
  if (!res) return;
  try {
    res.resume();
    res.destroy();
  } catch {}
}

/** Falha temporária de DNS ou de rede: insistir resolve, desistir não. */
function ehFalhaPassageira(erro: unknown) {
  const codigo = (erro as NodeJS.ErrnoException)?.code;
  return (
    codigo === "EAI_AGAIN" ||
    codigo === "ENOTFOUND" ||
    codigo === "ECONNRESET" ||
    codigo === "ETIMEDOUT" ||
    codigo === "ECONNREFUSED"
  );
}

/**
 * Prazo para o provedor RESPONDER. Não vale depois que a resposta começa.
 *
 * Esta distinção é o conserto de um filme que congelava no meio.
 *
 * `timeout` no `http.get` não é prazo de conexão: é prazo de socket OCIOSO, e
 * ele continua valendo enquanto o socket existir. Num filme, o navegador
 * enche o buffer e PARA de ler. A contrapressão sobe pela pilha — a resposta
 * para de escoar, o `IncomingMessage` pausa, a janela TCP fecha e o provedor
 * para de mandar bytes. O socket fica ocioso porque está tudo funcionando.
 *
 * Quinze segundos depois o `timeout` disparava e chamava `req.destroy()`,
 * matando a conexão no meio do filme. O `<video>` não recebia erro — para ele
 * o arquivo simplesmente TERMINOU ali. Tocava o que estava no buffer e
 * congelava. Quarenta minutos, cinquenta, uma hora: dependia só de quando o
 * ciclo de contrapressão se alinhava.
 *
 * Por isso o cronômetro é desarmado assim que os cabeçalhos chegam. A partir
 * dali, ficar ocioso é comportamento correto, e quem encerra a conexão é o
 * cliente indo embora — tratado no `GET` com o sinal de cancelamento.
 */
const PRAZO_PARA_RESPONDER_MS = 15_000;

function fetchUpstream(
  currentUrl: string,
  rangeHeader: string | null,
  redirectCount = 0
): Promise<http.IncomingMessage> {
  if (redirectCount > 8) {
    return Promise.reject(new Error("Muitos redirecionamentos no upstream"));
  }

  return new Promise<http.IncomingMessage>((resolve, reject) => {
    try {
      const parsedUrl = new URL(currentUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const httpModule = isHttps ? https : http;

      /** Já veio resposta? Depois disso, socket ocioso é normal. */
      let respondeu = false;

      const req = httpModule.get(
        currentUrl,
        {
          headers: {
            "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
            Accept: "*/*",
            Connection: "keep-alive",
            ...(rangeHeader ? { Range: rangeHeader } : {}),
          },
          timeout: PRAZO_PARA_RESPONDER_MS,
          lookup: lookupComCache,
          agent: isHttps ? agenteHttps : agenteHttp,
        },
        (res) => {
          respondeu = true;

          // Desarma o cronômetro de ociosidade — ver a nota acima.
          req.setTimeout(0);
          res.socket?.setTimeout(0);

          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const redirectTarget = new URL(
              res.headers.location,
              currentUrl
            ).toString();
            res.resume();
            try {
              assertPublicStreamUrl(redirectTarget);
            } catch (err) {
              reject(err);
              return;
            }
            fetchUpstream(redirectTarget, rangeHeader, redirectCount + 1)
              .then(resolve)
              .catch(reject);
            return;
          }
          resolve(res);
        }
      );

      req.on("error", (erro) => {
        // Erro depois da resposta pertence ao fluxo, não à conexão: a promessa
        // já foi resolvida e rejeitá-la de novo não faria nada além de gerar
        // rejeição não tratada.
        if (!respondeu) reject(erro);
      });

      req.on("timeout", () => {
        if (respondeu) return;
        req.destroy();
        reject(new Error("Timeout ao conectar com o servidor de IPTV"));
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Inspeciona os primeiros bytes do stream para identificar se é um manifesto M3U8 (#EXTM3U)
 * sem travar a conexão em transmissões de vídeo ao vivo (MPEG-TS/MP4).
 */
async function peekUpstream(
  stream: http.IncomingMessage,
): Promise<{ isM3u8: boolean; manifestText?: string; peekBuffer?: Buffer }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let totalRead = 0;
    let resolved = false;
    let dataTimer: ReturnType<typeof setTimeout> | null = null;

    function cleanup() {
      if (dataTimer) clearTimeout(dataTimer);
      stream.removeListener("data", onData);
      stream.removeListener("end", onEnd);
      stream.removeListener("error", onError);
    }

    function finish(isM3u8: boolean, manifestText?: string, peekBuffer?: Buffer) {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ isM3u8, manifestText, peekBuffer });
    }

    function onError() {
      finish(false);
    }

    function onData(chunk: Buffer) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      totalRead += buf.length;

      const currentBuffer = Buffer.concat(chunks);
      const textSample = currentBuffer.toString("utf-8", 0, Math.min(currentBuffer.length, 1024));

      if (textSample.trim().startsWith("#EXTM3U")) {
        const fullText = currentBuffer.toString("utf-8");

        /**
         * Manifesto é arquivo de texto pequeno: espera-se o `end`.
         *
         * A versão anterior devolvia em duas situações que não provam nada
         * sobre o manifesto estar completo: ao ver `#EXT-X-STREAM-INF` (que é
         * a PRIMEIRA linha de uma lista mestre, não a última) ou 15ms depois
         * do último pedaço. Numa rede lenta, o manifesto chegava cortado no
         * meio de uma linha — e o player recebia uma playlist truncada, com
         * segmentos faltando ou uma URL pela metade. O canal abria e engasgava
         * logo depois, sem erro que explicasse.
         *
         * Agora só o fim de verdade encerra: `#EXT-X-ENDLIST` (VOD), o
         * encerramento da resposta, ou o teto de tamanho — que existe para o
         * caso de o provedor mandar algo que só PARECE manifesto e não termina.
         */
        if (fullText.includes("#EXT-X-ENDLIST") || stream.complete || totalRead >= 262144) {
          finish(true, fullText);
          return;
        }

        // Rede travou no meio do download do manifesto: devolve o que veio em
        // vez de segurar a requisição para sempre.
        if (dataTimer) clearTimeout(dataTimer);
        dataTimer = setTimeout(() => {
          finish(true, Buffer.concat(chunks).toString("utf-8"));
        }, 8000);
        return;
      }

      // Não é M3U8 (é stream de vídeo binário MPEG-TS / MP4): pausa e devolve os bytes lidos sem desperdício
      stream.pause();
      finish(false, undefined, currentBuffer);
    }

    function onEnd() {
      const finalBuffer = Buffer.concat(chunks);
      const text = finalBuffer.toString("utf-8");
      if (text.trim().startsWith("#EXTM3U")) {
        finish(true, text);
      } else {
        finish(false, undefined, finalBuffer);
      }
    }

    stream.on("data", onData);
    stream.on("end", onEnd);
    stream.on("error", onError);
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const referer = request.headers.get("referer");
  const userAgent = request.headers.get("user-agent") || "";

  const isNativeMediaEngine =
    !referer ||
    /AppleCoreMedia|CoreMedia|ExoPlayer|Dalvik|stagefright|AVPlayer|okhttp|GStreamer|FFmpeg|Safari|Chrome/i.test(
      userAgent,
    );

  const isSiteReferer =
    isNativeMediaEngine ||
    (referer &&
      (referer.includes("tvhub") ||
        referer.includes("170.238.45.225") ||
        referer.includes("nip.io") ||
        referer.includes("localhost")));

  if (!session?.user && !isSiteReferer) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");
  const forceRaw = searchParams.get("raw") === "1";

  if (!targetUrl) {
    return new NextResponse("URL do stream não informada", { status: 400 });
  }

  try {
    assertPublicStreamUrl(targetUrl);
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "Destino bloqueado",
      { status: 403 },
    );
  }

  try {
    const rangeHeader = request.headers.get("range");

    let upstreamResponse: http.IncomingMessage | null = null;
    let ultimoErro: unknown = null;

    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        upstreamResponse = await fetchUpstream(targetUrl, rangeHeader);
        break;
      } catch (erro) {
        ultimoErro = erro;
        if (!ehFalhaPassageira(erro)) throw erro;
        try {
          dnsCache.delete(new URL(targetUrl).hostname);
        } catch {}
        await new Promise((r) => setTimeout(r, 200 * (tentativa + 1)));
      }
    }

    if (!upstreamResponse) throw ultimoErro ?? new Error("Falha ao conectar no upstream");

    let statusCode = upstreamResponse.statusCode ?? 502;

    if (statusCode === 404 && !forceRaw) {
      let altTarget: string | null = null;
      if (targetUrl.endsWith(".m3u8")) altTarget = targetUrl.replace(/\.m3u8$/i, ".ts");
      else if (targetUrl.endsWith(".ts")) altTarget = targetUrl.replace(/\.ts$/i, ".m3u8");
      else if (targetUrl.endsWith(".mp4")) altTarget = targetUrl.replace(/\.mp4$/i, ".mkv");
      else if (targetUrl.endsWith(".mkv")) altTarget = targetUrl.replace(/\.mkv$/i, ".mp4");
      else if (targetUrl.includes("/movie/") || targetUrl.includes("/series/")) {
        altTarget = `${targetUrl}.mp4`;
      }

      if (altTarget) {
        try {
          const altResponse = await fetchUpstream(altTarget, rangeHeader);
          if (altResponse.statusCode && altResponse.statusCode < 400) {
            // A resposta 404 original não serve mais para nada — e é ela que
            // estava vazando em toda abertura de canal.
            descartarUpstream(upstreamResponse);
            upstreamResponse = altResponse;
            statusCode = altResponse.statusCode;
          } else {
            descartarUpstream(altResponse);
          }
        } catch {}
      }
    }

    if (statusCode >= 400) {
      descartarUpstream(upstreamResponse);
      return new NextResponse(`Erro upstream: ${statusCode}`, {
        status: statusCode,
      });
    }

    const rawContentType = upstreamResponse.headers["content-type"] || "";
    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
    responseHeaders.set("X-Accel-Buffering", "no");

    const isM3u8Requested =
      !forceRaw &&
      (rawContentType.includes("mpegurl") ||
        rawContentType.includes("m3u8") ||
        targetUrl.includes(".m3u8") ||
        targetUrl.endsWith(".m3u"));

    let peekResult: { isM3u8: boolean; manifestText?: string; peekBuffer?: Buffer } = { isM3u8: false };

    if (isM3u8Requested) {
      peekResult = await peekUpstream(upstreamResponse);
      if (peekResult.isM3u8 && peekResult.manifestText) {
        const baseUrl = new URL(targetUrl);
        const lines = peekResult.manifestText.split("\n");

        const porProxy = (bruta: string) => {
          const absoluta = new URL(bruta, baseUrl).toString();
          return `/api/iptv/stream?url=${encodeURIComponent(absoluta)}`;
        };

        /**
         * Tags que carregam URI e PRECISAM passar pela proxy também.
         *
         * A versão anterior pulava toda linha iniciada por `#`, e é justamente
         * lá que moram dois endereços essenciais:
         *
         * - `#EXT-X-KEY:URI="..."` — a chave AES-128. Sem reescrever, o
         *   navegador busca a chave em http a partir de uma página https:
         *   conteúdo misto, bloqueado, e o canal criptografado nunca abre.
         * - `#EXT-X-MAP:URI="..."` — o segmento de inicialização do fMP4.
         *   Sem ele o fluxo não decodifica nada; e HLS em fMP4 é cada vez mais
         *   comum nas listas.
         *
         * Ambos falhavam calados, o que os tornava difíceis de atribuir: o
         * canal simplesmente "não abria".
         */
        const TAGS_COM_URI = /^(#EXT-X-KEY|#EXT-X-MAP|#EXT-X-SESSION-KEY|#EXT-X-PART|#EXT-X-PRELOAD-HINT|#EXT-X-RENDITION-REPORT|#EXT-X-I-FRAME-STREAM-INF|#EXT-X-MEDIA)[:,]/i;

        const rewrittenLines = lines.map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          if (trimmed.startsWith("#")) {
            if (!TAGS_COM_URI.test(trimmed)) return line;
            // Troca só o valor do atributo URI="...", preservando o resto da
            // tag (METHOD, IV, BYTERANGE e companhia).
            return line.replace(/URI="([^"]+)"/gi, (inteiro, uri: string) => {
              try {
                return `URI="${porProxy(uri)}"`;
              } catch {
                return inteiro;
              }
            });
          }

          try {
            return porProxy(trimmed);
          } catch {
            return line;
          }
        });

        const rewrittenManifest = rewrittenLines.join("\n");
        responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
        responseHeaders.set("Content-Length", Buffer.byteLength(rewrittenManifest).toString());

        // O manifesto já está inteiro em memória; a conexão não serve mais.
        // Sem isto, cada atualização de playlist (a cada poucos segundos, por
        // espectador) deixava um socket presos no pool.
        descartarUpstream(upstreamResponse);

        return new NextResponse(rewrittenManifest, {
          status: statusCode,
          headers: responseHeaders,
        });
      }
    }

    const contentType =
      rawContentType ||
      (targetUrl.endsWith(".ts")
        ? "video/mp2t"
        : targetUrl.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : "video/mp4");

    responseHeaders.set("Content-Type", contentType);

    const upstreamLength = upstreamResponse.headers["content-length"];
    const upstreamRange = upstreamResponse.headers["content-range"];

    if (upstreamLength) responseHeaders.set("Content-Length", upstreamLength);

    if (upstreamRange) {
      responseHeaders.set(
        "Content-Range",
        reconcileContentRange(upstreamRange, upstreamLength, rangeHeader),
      );
    }

    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges, Content-Type",
    );

    let finalNodeStream: http.IncomingMessage | PassThrough = upstreamResponse;

    if (peekResult.peekBuffer && peekResult.peekBuffer.length > 0) {
      const pass = new PassThrough();
      pass.write(peekResult.peekBuffer);
      upstreamResponse.resume();
      upstreamResponse.pipe(pass);
      finalNodeStream = pass;
    }

    /**
     * O espectador saiu: encerra a conexão com o provedor.
     *
     * Sem isto, fechar a aba ou trocar de canal deixava o socket do provedor
     * aberto para sempre — ninguém mais lia daquele fluxo, mas ele continuava
     * ocupando uma vaga no agente, que tem teto de 256. Numa noite de uso
     * normal as vagas iam acabando, e a partir daí toda requisição NOVA de
     * vídeo ficava na fila esperando um socket que nunca vagava. O sintoma
     * disso não é um canal que falha: é o app inteiro parando de abrir vídeo,
     * até o contêiner reiniciar.
     *
     * Cada troca de fonte do player abre uma conexão nova, então o vazamento
     * andava rápido justamente para quem estava com dificuldade de assistir.
     */
    const encerrarUpstream = () => {
      try {
        upstreamResponse.destroy();
      } catch {}
    };

    if (request.signal.aborted) {
      encerrarUpstream();
    } else {
      request.signal.addEventListener("abort", encerrarUpstream, { once: true });
      // Fim natural do fluxo também solta o ouvinte: em transmissão ao vivo o
      // mesmo espectador abre e fecha muitos fluxos numa sessão só, e o sinal
      // dura o que durar a requisição.
      finalNodeStream.once("close", () =>
        request.signal.removeEventListener("abort", encerrarUpstream),
      );
    }

    const webStream = Readable.toWeb(finalNodeStream) as ReadableStream;

    return new NextResponse(webStream, {
      status: statusCode,
      headers: responseHeaders,
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Erro interno no proxy de stream";
    console.error("[stream-proxy]", msg);
    return new NextResponse(msg, { status: 502 });
  }
}
