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
    /**
     * Entrada negativa é guardada com endereço vazio (ver o `catch` abaixo).
     * Devolvê-la como sucesso entregava string vazia ao socket, que morria com
     * "Invalid IP address" — um erro que não diz nada sobre o DNS e manda o
     * chamador procurar problema no lugar errado.
     */
    const erroCache: NodeJS.ErrnoException | null = guardado.address
      ? null
      : Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
          code: "ENOTFOUND",
        });

    process.nextTick(() =>
      responderLookup(callback, erroCache, guardado.address, guardado.family, querLista),
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
 * Falha temporária de DNS ou de rede: insistir resolve, desistir não.
 *
 * `ENOTFOUND` e `ENODATA` saíram desta lista de propósito. Eles não são
 * soluço: são o DNS afirmando que aquele nome não tem endereço. Insistir três
 * vezes com espera entre elas só gasta tempo para chegar na mesma resposta.
 * `EAI_AGAIN`, esse sim, é falha temporária de resolução e continua valendo a
 * pena repetir.
 */
function ehFalhaPassageira(erro: unknown) {
  const codigo = (erro as NodeJS.ErrnoException)?.code;
  return (
    codigo === "EAI_AGAIN" ||
    codigo === "ECONNRESET" ||
    codigo === "ETIMEDOUT" ||
    codigo === "ECONNREFUSED"
  );
}

/** O DNS afirma que este nome não tem endereço — não é lentidão, é ausência. */
function ehHostInexistente(erro: unknown) {
  const codigo = (erro as NodeJS.ErrnoException)?.code;
  return codigo === "ENOTFOUND" || codigo === "ENODATA";
}

/**
 * Domínios que o DNS já disse não existir.
 *
 * Serve para um caso concreto e caro: quando um dos provedores sai do ar, o
 * catálogo fica cheio de endereços apontando para um domínio que não resolve
 * mais — inclusive como reserva de canais cuja URL principal está boa. O
 * player então percorre a escada inteira de reservas, e cada degrau pagava
 * resolução de DNS antes de falhar. Multiplicado pelas repetições por fonte,
 * um canal morto consumia dezenas de segundos antes de mostrar qualquer coisa.
 *
 * Guardando o nome por alguns minutos, o segundo degrau em diante falha na
 * hora e o player chega rápido na fonte que presta.
 */
const CACHE_HOST_MORTO_MS = 5 * 60 * 1000;
const hostsMortos = new Map<string, number>();

function marcarHostMorto(hostname: string) {
  hostsMortos.set(hostname, Date.now() + CACHE_HOST_MORTO_MS);
}

function hostEstaMorto(hostname: string) {
  const ate = hostsMortos.get(hostname);
  if (ate === undefined) return false;
  if (ate > Date.now()) return true;
  hostsMortos.delete(hostname);
  return false;
}

/**
 * Resposta do provedor junto da URL que REALMENTE a serviu.
 *
 * `urlFinal` é o que sobra depois de seguir os redirecionamentos, e não é
 * detalhe: os painéis de IPTV mandam o manifesto para outro host ("balanceador"
 * com token), e as linhas de segmento dentro dele são relativas à RAIZ
 * (`/hls/989_3900.ts`). Resolver esses caminhos contra a URL pedida aponta para
 * o host antigo, que responde 404 em todos os segmentos — o manifesto carrega,
 * nenhum pedaço de vídeo carrega, e o canal fica preto. Vídeo sob demanda não
 * passa por aqui porque `.mp4` não tem manifesto: por isso só os canais caíram.
 */
type RespostaUpstream = { res: http.IncomingMessage; urlFinal: string };

function fetchUpstream(
  currentUrl: string,
  rangeHeader: string | null,
  redirectCount = 0
): Promise<RespostaUpstream> {
  if (redirectCount > 8) {
    return Promise.reject(new Error("Muitos redirecionamentos no upstream"));
  }

  return new Promise<RespostaUpstream>((resolve, reject) => {
    try {
      const parsedUrl = new URL(currentUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const httpModule = isHttps ? https : http;

      const req = httpModule.get(
        currentUrl,
        {
          headers: {
            "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
            Accept: "*/*",
            Connection: "keep-alive",
            ...(rangeHeader ? { Range: rangeHeader } : {}),
          },
          timeout: 15000,
          lookup: lookupComCache,
          agent: isHttps ? agenteHttps : agenteHttp,
        },
        (res) => {
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
          resolve({ res, urlFinal: currentUrl });
        }
      );

      req.on("error", reject);
      req.on("timeout", () => {
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

    function cleanup() {
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

    function onData(chunk: Buffer) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      totalRead += buf.length;

      const currentBuffer = Buffer.concat(chunks);
      const textSample = currentBuffer.toString("utf-8", 0, Math.min(currentBuffer.length, 512));

      if (textSample.trim().startsWith("#EXTM3U")) {
        if (totalRead < 262144 && !stream.complete) {
          return;
        }
        finish(true, currentBuffer.toString("utf-8"));
        return;
      }

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

    function onError() {
      finish(false, undefined, Buffer.concat(chunks));
    }

    stream.on("data", onData);
    stream.on("end", onEnd);
    stream.on("error", onError);
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const referer = request.headers.get("referer");
  const isSiteReferer =
    referer &&
    (referer.includes("tvhub") ||
      referer.includes("170.238.45.225") ||
      referer.includes("localhost"));

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

  let hostAlvo = "";
  try {
    hostAlvo = new URL(targetUrl).hostname;
  } catch {}

  // Já sabemos que este nome não resolve: responder na hora deixa o player
  // seguir para a próxima fonte sem pagar DNS de novo.
  if (hostAlvo && hostEstaMorto(hostAlvo)) {
    return new NextResponse(`Servidor de origem indisponível: ${hostAlvo}`, {
      status: 502,
    });
  }

  try {
    const rangeHeader = request.headers.get("range");

    let upstream: RespostaUpstream | null = null;
    let ultimoErro: unknown = null;

    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        upstream = await fetchUpstream(targetUrl, rangeHeader);
        break;
      } catch (erro) {
        ultimoErro = erro;
        if (ehHostInexistente(erro)) {
          if (hostAlvo) marcarHostMorto(hostAlvo);
          throw erro;
        }
        if (!ehFalhaPassageira(erro)) throw erro;
        try {
          dnsCache.delete(new URL(targetUrl).hostname);
        } catch {}
        await new Promise((r) => setTimeout(r, 200 * (tentativa + 1)));
      }
    }

    if (!upstream) throw ultimoErro ?? new Error("Falha ao conectar no upstream");

    let upstreamResponse = upstream.res;
    /** Base para resolver segmentos e adivinhar o tipo: o que serviu, não o que pedimos. */
    let urlEfetiva = upstream.urlFinal;
    let statusCode = upstreamResponse.statusCode ?? 502;

    if (statusCode === 404 && targetUrl.endsWith(".m3u8") && !forceRaw) {
      const tsTarget = targetUrl.replace(/\.m3u8$/i, ".ts");
      try {
        const tsUpstream = await fetchUpstream(tsTarget, rangeHeader);
        if (tsUpstream.res.statusCode && tsUpstream.res.statusCode < 400) {
          upstreamResponse = tsUpstream.res;
          // Sem isto o TS recuperado continuava sendo anunciado como manifesto.
          urlEfetiva = tsUpstream.urlFinal;
          statusCode = tsUpstream.res.statusCode;
        }
      } catch {}
    }

    if (statusCode >= 400) {
      upstreamResponse.destroy();
      return new NextResponse(`Erro upstream: ${statusCode}`, {
        status: statusCode,
      });
    }

    /**
     * Desliga do provedor assim que o espectador desiste.
     *
     * Transmissão ao vivo não termina sozinha: se ninguém cortar, este proxy
     * fica puxando vídeo do provedor até o teto de uma hora do `maxDuration`,
     * mesmo com a aba já fechada. E como o player troca de fonte e remonta o
     * motor algumas vezes até engatar, sobravam várias dessas conexões
     * penduradas por espectador. Painel de IPTV limita conexões simultâneas
     * por conta — passado o limite, o provedor recusa as próximas, e o sintoma
     * que chega ao usuário é canal que demora a abrir e trava.
     */
    const encerrarUpstream = () => {
      if (!upstreamResponse.destroyed) upstreamResponse.destroy();
    };
    request.signal.addEventListener("abort", encerrarUpstream, { once: true });

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
        urlEfetiva.includes(".m3u8") ||
        targetUrl.endsWith(".m3u"));

    let peekResult: { isM3u8: boolean; manifestText?: string; peekBuffer?: Buffer } = { isM3u8: false };

    if (isM3u8Requested) {
      peekResult = await peekUpstream(upstreamResponse);
      if (peekResult.isM3u8 && peekResult.manifestText) {
        const baseUrl = new URL(urlEfetiva);
        const lines = peekResult.manifestText.split("\n");

        const peloProxy = (endereco: string) => {
          const absoluta = new URL(endereco, baseUrl).toString();
          return `/api/iptv/stream?url=${encodeURIComponent(absoluta)}`;
        };

        const rewrittenLines = lines.map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          /**
           * Linhas de tag também carregam endereço, dentro de URI="...".
           *
           * São a chave de criptografia (#EXT-X-KEY), o cabeçalho de
           * inicialização do fMP4 (#EXT-X-MAP) e as faixas alternativas de
           * áudio e legenda (#EXT-X-MEDIA) — esta última é corriqueira em
           * canal ao vivo com áudio original e dublado. Deixá-las passar
           * intactas devolve um endereço http:// para uma página https://, que
           * o navegador bloqueia por conteúdo misto. O canal até começa e
           * morre no primeiro trecho criptografado, ou fica mudo.
           */
          if (trimmed.startsWith("#")) {
            return line.replace(/URI="([^"]+)"/gi, (inteiro, endereco: string) => {
              try {
                return `URI="${peloProxy(endereco)}"`;
              } catch {
                return inteiro;
              }
            });
          }

          try {
            return peloProxy(trimmed);
          } catch {
            return line;
          }
        });

        const rewrittenManifest = rewrittenLines.join("\n");
        responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
        responseHeaders.set("Content-Length", Buffer.byteLength(rewrittenManifest).toString());

        // O manifesto já foi lido por inteiro; segurar o socket aberto só
        // consome uma das poucas conexões que o provedor concede por conta.
        encerrarUpstream();

        return new NextResponse(rewrittenManifest, {
          status: statusCode,
          headers: responseHeaders,
        });
      }
    }

    const semQuery = urlEfetiva.split("?")[0];
    const contentType =
      rawContentType ||
      (semQuery.endsWith(".ts")
        ? "video/mp2t"
        : semQuery.endsWith(".m3u8")
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

    if (upstreamResponse.headers["accept-ranges"]) {
      responseHeaders.set(
        "Accept-Ranges",
        upstreamResponse.headers["accept-ranges"]
      );
    }

    let finalNodeStream: http.IncomingMessage | PassThrough = upstreamResponse;

    if (peekResult.peekBuffer && peekResult.peekBuffer.length > 0) {
      const pass = new PassThrough();
      pass.write(peekResult.peekBuffer);
      upstreamResponse.resume();
      upstreamResponse.pipe(pass);
      finalNodeStream = pass;
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
