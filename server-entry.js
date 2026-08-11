/**
 * Entrypoint de produção do TVHub — desligamento com drenagem.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * O `/api/iptv/stream` faz proxy do vídeo pelo próprio Node. Enquanto alguém
 * assiste, existe uma conexão HTTP aberta contra ESTE processo. Matar o
 * container corta o vídeo na hora — é o que acontecia em todo deploy.
 *
 * O `server.js` gerado pelo Next já reage a SIGTERM com `server.close()`, que
 * deixa as conexões abertas terminarem. Só que ele fecha o listener no mesmo
 * instante, e o Traefik leva alguns segundos para perceber que a task saiu de
 * rotação. Nessa janela ele ainda manda requisições para um socket que já não
 * aceita nada: connection refused, 502 na cara de quem estava navegando.
 *
 * A sequência correta é anunciar a saída ANTES de fechar a porta:
 *
 *   t=0     SIGTERM. Grava a flag de dreno. /api/ready passa a responder 503.
 *   t≈5s    O healthcheck do Traefik reprova e tira esta task da rotação.
 *           Requisição nova nenhuma chega mais aqui.
 *   t=15s   server.close(): para de aceitar conexões, as abertas continuam.
 *           Quem já estava assistindo não percebe nada.
 *   t=100s  Prazo final. Streams de canal ao vivo duram horas e não terminam
 *           sozinhos; a partir daqui o corte é inevitável. Sai antes dos 120s
 *           do stop_grace_period do Swarm para que a saída seja limpa e não
 *           um SIGKILL.
 *
 * O /api/health continua raso e SEMPRE respondendo ok, inclusive durante o
 * dreno — ele é o liveness que o Swarm observa. Se ele reprovasse aqui, o
 * Swarm mataria a task no meio da drenagem e o esforço todo seria perdido.
 */

process.env.NEXT_MANUAL_SIG_HANDLE = "1";

const http = require("node:http");
const fs = require("node:fs");

const DRAIN_FLAG = process.env.TVHUB_DRAIN_FLAG || "/tmp/tvhub-draining";
const DRAIN_DELAY_MS = Number(process.env.TVHUB_DRAIN_DELAY_MS || 15000);
const DRAIN_TIMEOUT_MS = Number(process.env.TVHUB_DRAIN_TIMEOUT_MS || 100000);

/**
 * O `start-server` do Next cria o servidor internamente e não devolve a
 * referência. Interceptar `http.createServer` é a forma de obtê-la sem
 * bifurcar o arquivo gerado — que é regerado a cada build e não pode ser
 * editado à mão.
 */
let httpServer = null;
const createServer = http.createServer;
http.createServer = function patchedCreateServer(...args) {
  httpServer = createServer.apply(this, args);
  return httpServer;
};

let draining = false;

function shutdown(signal) {
  if (draining) return;
  draining = true;

  console.log(`[drain] ${signal} recebido — anunciando saída de rotação`);
  try {
    fs.writeFileSync(DRAIN_FLAG, String(Date.now()));
  } catch (err) {
    // Sem a flag o /api/ready continua dizendo "pronto" e o Traefik segue
    // mandando tráfego. Não é fatal, mas precisa aparecer no log.
    console.error("[drain] falha ao gravar a flag de dreno:", err);
  }

  const forceExit = setTimeout(() => {
    console.log("[drain] prazo esgotado — encerrando conexões restantes");
    process.exit(0);
  }, DRAIN_TIMEOUT_MS);
  forceExit.unref();

  setTimeout(() => {
    if (!httpServer) {
      console.log("[drain] servidor não capturado — encerrando");
      process.exit(0);
    }
    console.log("[drain] fechando o listener; conexões abertas continuam");
    httpServer.close(() => {
      console.log("[drain] todas as conexões terminaram");
      process.exit(0);
    });
  }, DRAIN_DELAY_MS).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Resto do container é sobra do deploy anterior? Não: a flag mora no
// filesystem efêmero do container, que nasce limpo. Este unlink é só para o
// caso de alguém rodar a imagem com um volume montado em /tmp.
try {
  fs.unlinkSync(DRAIN_FLAG);
} catch {}

require("./server.js");
