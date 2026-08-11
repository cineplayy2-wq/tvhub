import { NextRequest, NextResponse } from "next/server";
import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";

import { auth } from "@/auth";
import { reconcileContentRange } from "@/lib/iptv/range";
import { assertPublicStreamUrl } from "@/lib/iptv/ssrf-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

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
    let upstreamResponse = await fetchUpstream(targetUrl, rangeHeader);

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
