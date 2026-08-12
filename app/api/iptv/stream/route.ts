import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";

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

  dns.lookup(hostname, { family: 4 }, (err, address, family) => {
    if (!err && address) {
      dnsCache.set(hostname, { address, family, ate: agora + CACHE_DNS_MS });
    }
    responderLookup(callback, err, address, family, querLista);
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
  keepAliveMsecs: 30_000,
  maxSockets: 128,
  maxFreeSockets: 32,
  timeout: 60_000,
});

const agenteHttps = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 128,
  maxFreeSockets: 32,
  timeout: 60_000,
});

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

      const req = httpModule.get(
        currentUrl,
        {
          headers: {
            "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
            Accept: "*/*",
            Connection: "keep-alive",
            ...(rangeHeader ? { Range: rangeHeader } : {}),
          },
          timeout: 45000,
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
          resolve(res);
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

async function streamToBuffer(stream: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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

  try {
    const rangeHeader = request.headers.get("range");

    /**
     * Insiste antes de devolver erro.
     *
     * DNS e conexão falham de forma passageira sob carga — o `EAI_AGAIN` que
     * derrubava streams aqui é literalmente "tente de novo". Sem esta
     * insistência, um soluço de rede de meio segundo vira 502 e o assinante vê
     * o vídeo morrer, mesmo com o provedor inteiro funcionando.
     */
    let upstreamResponse: http.IncomingMessage | null = null;
    let ultimoErro: unknown = null;

    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        upstreamResponse = await fetchUpstream(targetUrl, rangeHeader);
        break;
      } catch (erro) {
        ultimoErro = erro;
        if (!ehFalhaPassageira(erro)) throw erro;
        // Nome pode ter mudado de endereço: descarta o cache antes de repetir.
        try {
          dnsCache.delete(new URL(targetUrl).hostname);
        } catch {}
        await new Promise((r) => setTimeout(r, 250 * (tentativa + 1)));
      }
    }

    if (!upstreamResponse) throw ultimoErro ?? new Error("Falha ao conectar no upstream");

    let statusCode = upstreamResponse.statusCode ?? 502;

    // Se a extensão era .m3u8 e o servidor deu 404, tenta a versão .ts equivalente
    if (statusCode === 404 && targetUrl.endsWith(".m3u8") && !forceRaw) {
      const tsTarget = targetUrl.replace(/\.m3u8$/i, ".ts");
      try {
        const tsResponse = await fetchUpstream(tsTarget, rangeHeader);
        if (tsResponse.statusCode && tsResponse.statusCode < 400) {
          upstreamResponse = tsResponse;
          statusCode = tsResponse.statusCode;
        }
      } catch {}
    }

    if (statusCode >= 400) {
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

    const isM3u8Requested =
      !forceRaw &&
      (rawContentType.includes("mpegurl") ||
        rawContentType.includes("m3u8") ||
        targetUrl.includes(".m3u8") ||
        targetUrl.includes(".m3u"));

    if (isM3u8Requested) {
      const buffer = await streamToBuffer(upstreamResponse);
      const manifestText = buffer.toString("utf-8");

      // Se o servidor retornou um arquivo M3U8 válido iniciando com #EXTM3U
      if (manifestText.trim().startsWith("#EXTM3U")) {
        const baseUrl = new URL(targetUrl);
        const lines = manifestText.split("\n");

        const rewrittenLines = lines.map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;
          try {
            const absoluteSegmentUrl = new URL(trimmed, baseUrl).toString();
            return `/api/iptv/stream?url=${encodeURIComponent(absoluteSegmentUrl)}`;
          } catch {
            return line;
          }
        });

        const rewrittenManifest = rewrittenLines.join("\n");
        responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
        responseHeaders.set("Content-Length", Buffer.byteLength(rewrittenManifest).toString());

        return new NextResponse(rewrittenManifest, {
          status: statusCode,
          headers: responseHeaders,
        });
      }

      // Se o provedor IPTV retornou um stream binário MPEG-TS direto (em vez de um texto M3U8):
      // Criamos um manifesto HLS virtual dinâmico para que o Hls.js decodifique o sinal sem erros!
      const virtualTsUrl = `/api/iptv/stream?url=${encodeURIComponent(targetUrl)}&raw=1`;
      const virtualManifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
${virtualTsUrl}
`;

      responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
      responseHeaders.set("Content-Length", Buffer.byteLength(virtualManifest).toString());

      return new NextResponse(virtualManifest, {
        status: 200,
        headers: responseHeaders,
      });
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

    if (upstreamResponse.headers["accept-ranges"]) {
      responseHeaders.set(
        "Accept-Ranges",
        upstreamResponse.headers["accept-ranges"]
      );
    }

    const webStream = Readable.toWeb(upstreamResponse) as ReadableStream;

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
