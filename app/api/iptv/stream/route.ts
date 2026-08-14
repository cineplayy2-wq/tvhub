import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { Readable, PassThrough } from "node:stream";

import { auth } from "@/auth";
import {
  credencialDoUsuario,
  eContaDoCatalogo,
  paresDoCatalogo,
  reescreverCredencial,
} from "@/lib/iptv/credentials";
import {
  checkUserScreensLimit,
  allocatePoolLine,
} from "@/lib/iptv/pool-service";
import { reconcileContentRange } from "@/lib/iptv/range";
import {
  assertPublicStreamUrl,
  enderecoResolvidoEhPermitido,
} from "@/lib/iptv/ssrf-guard";

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
/**
 * `codigo` guarda o erro ORIGINAL das entradas negativas.
 *
 * Não é detalhe de arrumação: o resto deste arquivo trata EAI_AGAIN
 * (passageiro, insiste) e ENOTFOUND (ausência, desiste e marca o host como
 * morto por 5 minutos) de formas opostas. Guardar só "endereço vazio" apagava
 * essa distinção e fazia toda falha temporária ressurgir do cache como
 * ENOTFOUND — ver o comentário no `lookupComCache`.
 */
const dnsCache = new Map<
  string,
  { address: string; family: number; ate: number; codigo?: string }
>();

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

  /**
   * Última barreira de SSRF: o endereço RESOLVIDO.
   *
   * `assertPublicStreamUrl` valida o texto da URL, o que barra
   * `http://10.0.0.5` mas não barra `http://interno.exemplo.com` apontando
   * para o mesmo lugar — e não barra rebinding, onde a primeira resolução
   * devolve um IP público e a segunda, no instante de conectar, devolve um
   * privado.
   *
   * Aqui é o ponto exato onde o nome já virou endereço e o socket ainda não
   * conectou. Bloqueando neste lugar, a rede interna da VPS (o Odoo em
   * produção, o Postgres, o Redis, os metadados do provedor de nuvem) fica
   * inalcançável mesmo para uma URL que passou por todas as checagens
   * anteriores.
   */
  if (!erro && address && !enderecoResolvidoEhPermitido(address, family)) {
    const bloqueio = Object.assign(
      new Error(`Destino resolvido para rede privada: ${address}`),
      { code: "EACCES" },
    ) as NodeJS.ErrnoException;
    if (querLista) cb(bloqueio, []);
    else cb(bloqueio, "", family);
    return;
  }

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
     *
     * O código replicado é o ORIGINAL, não um ENOTFOUND fixo. Fixar ENOTFOUND
     * aqui tirava o player do ar por inteiro, assim:
     *
     *   1. um EAI_AGAIN (falha TEMPORÁRIA de DNS, comum sob carga) gravava a
     *      entrada negativa;
     *   2. a requisição seguinte lia o cache e recebia ENOTFOUND;
     *   3. `ehHostInexistente` via ENOTFOUND e chamava `marcarHostMorto`;
     *   4. por 5 MINUTOS todo play para aquele host devolvia 502 na hora, sem
     *      nem tentar conectar.
     *
     * Como o catálogo inteiro vem de um punhado de hosts do provedor, um
     * soluço de DNS derrubava tudo para todo mundo — e, com os espectadores
     * repetindo, a janela se renovava sozinha antes de expirar.
     */
    const erroCache: NodeJS.ErrnoException | null = guardado.address
      ? null
      : Object.assign(
          new Error(`getaddrinfo ${guardado.codigo ?? "EAI_AGAIN"} ${hostname}`),
          { code: guardado.codigo ?? "EAI_AGAIN" },
        );

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
        // Guarda por 5s para evitar rajada de getaddrinfo que trava o libuv.
        // O código vai junto: é ele que diz, na próxima leitura, se a falha era
        // passageira (insiste) ou ausência de verdade (desiste).
        dnsCache.set(hostname, {
          address: "",
          family: 4,
          ate: agora + 5000,
          codigo: err.code ?? "EAI_AGAIN",
        });
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

/**
 * Fecha uma resposta do provedor que não vai ser usada.
 *
 * `resume()` antes de `destroy()` é de propósito: drenar devolve o socket ao
 * pool de keep-alive para ser reaproveitado, o que é melhor que matá-lo. O
 * `destroy()` cobre o caso de a resposta ser grande demais para valer a pena.
 *
 * Toda resposta abandonada sem isto continua ocupando uma vaga do agente (teto
 * de 256) e uma das poucas conexões que o painel concede por conta.
 */
function descartarUpstream(res: http.IncomingMessage | null | undefined) {
  if (!res) return;
  try {
    if (!res.destroyed) {
      res.resume();
      res.destroy();
    }
  } catch {}
}

// ==========================================================
// FORMATO REAL DA FONTE (memória do que já foi farejado)
// ==========================================================

type FormatoReal = "hls" | "mpegts" | null;

/**
 * Meia hora. O painel não muda o container de um canal no meio do dia, e uma
 * sincronização de catálogo reinicia o processo de qualquer forma.
 */
const CACHE_FORMATO_MS = 30 * 60 * 1000;
const formatoCache = new Map<string, { formato: FormatoReal; ate: number }>();

function formatoEmCache(url: string): FormatoReal | undefined {
  const guardado = formatoCache.get(url);
  if (!guardado) return undefined;
  if (guardado.ate < Date.now()) {
    formatoCache.delete(url);
    return undefined;
  }
  return guardado.formato;
}

function guardarFormato(url: string, formato: FormatoReal) {
  // Teto simples de tamanho: o catálogo tem 150 mil endereços e este mapa não
  // pode virar um vazamento de memória dentro de um contêiner de 320 MB.
  if (formatoCache.size > 5000) formatoCache.clear();
  formatoCache.set(url, { formato, ate: Date.now() + CACHE_FORMATO_MS });
}

/**
 * Dois sinais bastam, e nenhum depende de o provedor mandar cabeçalho certo:
 * manifesto HLS começa obrigatoriamente com `#EXTM3U`; MPEG-TS começa com o
 * byte de sincronismo 0x47.
 */
function farejarFormato(res: http.IncomingMessage): Promise<FormatoReal> {
  return new Promise((resolve) => {
    let pronto = false;
    const encerrar = (f: FormatoReal) => {
      if (pronto) return;
      pronto = true;
      clearTimeout(prazo);
      resolve(f);
    };

    // Provedor que aceita a conexão e não manda byte nenhum não pode segurar
    // a sonda para sempre.
    const prazo = setTimeout(() => encerrar(null), 6000);

    res.once("data", (pedaco: Buffer) => {
      const buf = Buffer.isBuffer(pedaco) ? pedaco : Buffer.from(pedaco);
      if (buf.length === 0) return encerrar(null);
      if (buf.subarray(0, 7).toString("utf-8").startsWith("#EXTM3U")) {
        return encerrar("hls");
      }
      if (buf[0] === 0x47) return encerrar("mpegts");
      encerrar(null);
    });

    res.once("end", () => encerrar(null));
    res.once("error", () => encerrar(null));
  });
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

/**
 * Dois strikes antes de condenar, não um.
 *
 * Marcar na primeira falha dá ao acaso o poder de tirar o catálogo inteiro do
 * ar: os canais vêm de um punhado de hosts do provedor, e `hostEstaMorto`
 * responde 502 sem nem tentar conectar. Um ENOTFOUND isolado — resolvedor
 * reiniciando, pacote perdido, resposta truncada — bastava para bloquear todo
 * mundo por 5 minutos.
 *
 * Exigir confirmação preserva o ganho que o cache existe para dar (a escada de
 * reservas de um provedor realmente fora do ar falha rápido a partir da
 * segunda tentativa) e tira o gatilho do acaso. A contagem zera junto com a
 * condenação, quando a janela expira.
 */
const strikesDeHost = new Map<string, number>();

function marcarHostMorto(hostname: string) {
  const strikes = (strikesDeHost.get(hostname) ?? 0) + 1;
  strikesDeHost.set(hostname, strikes);
  if (strikes >= 2) {
    hostsMortos.set(hostname, Date.now() + CACHE_HOST_MORTO_MS);
  }
}

/** Host respondeu: zera o histórico para não condenar por falhas espalhadas. */
function marcarHostVivo(hostname: string) {
  if (strikesDeHost.size > 0) strikesDeHost.delete(hostname);
  if (hostsMortos.size > 0) hostsMortos.delete(hostname);
}

function hostEstaMorto(hostname: string) {
  const ate = hostsMortos.get(hostname);
  if (ate === undefined) return false;
  if (ate > Date.now()) return true;
  // Cumpriu a pena: sai limpo, senão a próxima falha isolada o condenaria de
  // imediato pelo strike antigo e a janela se renovaria para sempre.
  hostsMortos.delete(hostname);
  strikesDeHost.delete(hostname);
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

      /** Já vieram os cabeçalhos? Depois disso, socket ocioso é normal. */
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
          timeout: 15000,
          lookup: lookupComCache,
          agent: isHttps ? agenteHttps : agenteHttp,
        },
        (res) => {
          respondeu = true;

          /**
           * Desarma o cronômetro assim que a resposta começa.
           *
           * `timeout` no `http.get` NÃO é prazo de conexão: é prazo de socket
           * OCIOSO, e vale enquanto o socket existir. Num filme, o navegador
           * enche o buffer e para de ler; a contrapressão sobe, o provedor
           * para de mandar bytes e o socket fica ocioso PORQUE está tudo
           * funcionando. Quinze segundos depois o handler abaixo chamava
           * `req.destroy()` e matava a conexão no meio da reprodução.
           *
           * O `<video>` não recebia erro: para ele o arquivo tinha TERMINADO
           * ali. Tocava o buffer restante e congelava. O minuto exato dependia
           * só de quando o ciclo de contrapressão se alinhava — por isso
           * parecia aleatório.
           *
           * Reproduzido em tests/prova-timeout-socket.mjs.
           */
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
          resolve({ res, urlFinal: currentUrl });
        }
      );

      req.on("error", (erro) => {
        // Erro depois da resposta pertence ao fluxo, não à conexão: a promessa
        // já foi resolvida e rejeitá-la de novo só geraria rejeição não tratada.
        if (!respondeu) reject(erro);
      });

      req.on("timeout", () => {
        // Só vale ANTES da resposta. Depois dela, socket ocioso é normal.
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
    let idleTimer: NodeJS.Timeout | null = null;
    const contentLength = Number(stream.headers["content-length"]) || 0;

    function cleanup() {
      if (idleTimer) clearTimeout(idleTimer);
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
        if (contentLength > 0 && totalRead >= contentLength) {
          finish(true, currentBuffer.toString("utf-8"));
          return;
        }
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          finish(true, Buffer.concat(chunks).toString("utf-8"));
        }, 20);
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

  if (!session?.user?.id) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");
  const forceRaw = searchParams.get("raw") === "1";

  if (!targetUrl) {
    return new NextResponse("URL do stream não informada", { status: 400 });
  }

  /**
   * Só toca com a linha DESTE assinante.
   *
   * Sem user/senha cadastrados no cliente, recusa — nunca usa a conta da
   * importação. O painel limita 2 conexões por usuário; se o catálogo
   * vazasse, o terceiro a assistir caía e "não rodava nada".
   */
  const viewer = await credencialDoUsuario(session.user.id);
  if (!viewer) {
    return new NextResponse(
      "Este cliente não tem linha IPTV. Cadastre usuário e senha do provedor em Admin → IPTV.",
      { status: 403 },
    );
  }

  /**
   * Conta da importação (usuário de teste / dono técnico): não reescreve.
   *
   * O acervo mistura dois painéis. Forçar a senha da lista ao vivo nos
   * filmes da lista de backup devolve 404 em tudo — foi isso que parou
   * o usuário de teste. Cliente com linha NOVA continua só na conta dele.
   */
  const catalogo = await paresDoCatalogo();
  let urlPedido: string;
  if (eContaDoCatalogo(viewer, catalogo)) {
    urlPedido = targetUrl;
  } else {
    const reescrita = reescreverCredencial(targetUrl, viewer);
    urlPedido = reescrita || targetUrl;
  }

  try {
    assertPublicStreamUrl(urlPedido);
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "Destino bloqueado",
      { status: 403 },
    );
  }

  let hostAlvo = "";
  try {
    hostAlvo = new URL(urlPedido).hostname;
  } catch {}

  // Já sabemos que este nome não resolve: responder na hora deixa o player
  // seguir para a próxima fonte sem pagar DNS de novo.
  if (hostAlvo && hostEstaMorto(hostAlvo)) {
    return new NextResponse(`Servidor de origem indisponível: ${hostAlvo}`, {
      status: 502,
    });
  }

  /**
   * Sonda de formato — responde QUE FORMATO é, sem entregar vídeo.
   *
   * O player precisa saber se a URL entrega manifesto HLS ou MPEG-TS puro
   * antes de escolher o motor, porque o painel Xtream nomeia canal ao vivo
   * como `.m3u8` mesmo servindo TS sem manifesto nenhum.
   *
   * Antes ele descobria isso sozinho, pedindo `Range: bytes=0-7` na própria
   * URL de reprodução. Funcionava, e cobrava caro: era UMA CONEXÃO COM O
   * PROVEDOR POR TENTATIVA. Somando as três insistências na mesma fonte, as
   * variantes de formato e as fontes de reserva, uma única abertura de canal
   * podia bater no painel dez vezes em poucos segundos — e o painel concede
   * poucas conexões simultâneas por conta. Passado o limite, ele recusa tudo:
   * o assinante vê "não roda nada", e a culpa parece do player.
   *
   * Aqui a resposta fica guardada por URL. Só o primeiro espectador de cada
   * endereço paga uma conexão; do segundo em diante a sonda é instantânea e
   * não toca no provedor.
   */
  if (searchParams.get("sonda") === "1") {
    const emCache = formatoEmCache(urlPedido);
    if (emCache) {
      return NextResponse.json({ formato: emCache, cache: true });
    }

    try {
      const sonda = await fetchUpstream(urlPedido, "bytes=0-7");
      const formato = await farejarFormato(sonda.res);
      descartarUpstream(sonda.res);
      guardarFormato(urlPedido, formato);
      return NextResponse.json({ formato, cache: false });
    } catch {
      // Sonda falhou: o player segue pelo palpite da extensão, como antes.
      return NextResponse.json({ formato: null, cache: false });
    }
  }

  try {
    const rangeHeader = request.headers.get("range");

    let upstream: RespostaUpstream | null = null;
    let ultimoErro: unknown = null;

    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        upstream = await fetchUpstream(urlPedido, rangeHeader);
        break;
      } catch (erro) {
        ultimoErro = erro;
        if (ehHostInexistente(erro)) {
          if (hostAlvo) marcarHostMorto(hostAlvo);
          throw erro;
        }
        if (!ehFalhaPassageira(erro)) throw erro;
        try {
          dnsCache.delete(new URL(urlPedido).hostname);
        } catch {}
        await new Promise((r) => setTimeout(r, 200 * (tentativa + 1)));
      }
    }

    if (!upstream) throw ultimoErro ?? new Error("Falha ao conectar no upstream");

    // Conectou: o host está de pé. Zera qualquer strike solto para que falhas
    // espalhadas ao longo de horas não somem até virar uma condenação.
    if (hostAlvo) marcarHostVivo(hostAlvo);

    let upstreamResponse = upstream.res;
    /** Base para resolver segmentos e adivinhar o tipo: o que serviu, não o que pedimos. */
    let urlEfetiva = upstream.urlFinal;
    let statusCode = upstreamResponse.statusCode ?? 502;

    if (statusCode === 404 && urlPedido.endsWith(".m3u8") && !forceRaw) {
      const tsTarget = urlPedido.replace(/\.m3u8$/i, ".ts");
      try {
        const tsUpstream = await fetchUpstream(tsTarget, rangeHeader);
        if (tsUpstream.res.statusCode && tsUpstream.res.statusCode < 400) {
          /**
           * A resposta 404 original precisa ser fechada AQUI.
           *
           * Sem isto ela ficava pendurada: ninguém mais ia lê-la, mas o Node
           * não tem como saber disso e o socket continuava ocupando uma das
           * 256 vagas do agente — e, pior, uma das poucas conexões que o
           * painel do provedor concede por conta.
           *
           * Este caminho roda em TODA abertura de canal cujo provedor não
           * publica HLS, que é a maioria. Some com o vazamento da sonda de
           * formato e da troca de fonte, e em pouco tempo o provedor passa a
           * recusar tudo — o sintoma que chega é "não roda nada".
           */
          descartarUpstream(upstreamResponse);
          upstreamResponse = tsUpstream.res;
          // Sem isto o TS recuperado continuava sendo anunciado como manifesto.
          urlEfetiva = tsUpstream.urlFinal;
          statusCode = tsUpstream.res.statusCode;
        } else {
          // A tentativa também falhou: fecha as duas, não só a original.
          descartarUpstream(tsUpstream.res);
        }
      } catch {}
    }

    if (statusCode >= 400) {
      descartarUpstream(upstreamResponse);
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
      try {
        if (!upstreamResponse.destroyed) upstreamResponse.destroy();
      } catch {}
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
        urlPedido.includes(".m3u8") ||
        urlEfetiva.includes(".m3u8") ||
        urlPedido.endsWith(".m3u"));

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

    /**
     * Chegar aqui com `isM3u8Requested` significa que o peek OLHOU os
     * primeiros bytes e provou que NÃO é manifesto: não começam com `#EXTM3U`.
     * O que vem é vídeo bruto, quase sempre MPEG-TS, num endereço `.m3u8`
     * porque é assim que o painel Xtream nomeia o canal ao vivo.
     *
     * Rotular isso de `application/vnd.apple.mpegurl` — seja pelo sufixo da
     * URL, seja repetindo o content-type que o próprio provedor mandou errado —
     * entrega bytes binários a um player que vai tentar lê-los como texto de
     * playlist. O hls.js não acha nenhuma linha válida, não tem o que baixar, e
     * fica girando para sempre: é o "canal só carregando", enquanto o filme
     * (`.mp4`, que nem passa pelo peek) toca normalmente.
     *
     * A prova do peek vale mais que o palpite da extensão.
     */
    const provouQueNaoEManifesto = isM3u8Requested && !peekResult.isM3u8;

    const contentType = provouQueNaoEManifesto
      ? "video/mp2t"
      : rawContentType ||
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

    const webStream = new ReadableStream({
      start(controller) {
        if (peekResult.peekBuffer && peekResult.peekBuffer.length > 0) {
          controller.enqueue(new Uint8Array(peekResult.peekBuffer));
        }

        upstreamResponse.on("data", (chunk: Buffer) => {
          try {
            controller.enqueue(new Uint8Array(chunk));
          } catch {}
        });

        upstreamResponse.on("end", () => {
          try {
            controller.close();
          } catch {}
        });

        upstreamResponse.on("error", (err) => {
          try {
            controller.error(err);
          } catch {}
        });

        upstreamResponse.resume();
      },
      cancel() {
        encerrarUpstream();
      },
    });

    return new NextResponse(webStream, {
      status: statusCode,
      headers: responseHeaders,
    });
  } catch (error) {
    /**
     * O detalhe vai para o log, nunca para o cliente.
     *
     * A mensagem crua entregava o nome do host do provedor, o código de erro
     * do Node e, em falha de banco, trecho da consulta. Para quem está
     * sondando, isso é mapa: revela a infraestrutura do provedor por trás do
     * proxy — que é justamente o que o proxy existe para esconder.
     */
    console.error("[stream-proxy]", error);
    return new NextResponse("Não foi possível abrir a transmissão.", { status: 502 });
  }
}
