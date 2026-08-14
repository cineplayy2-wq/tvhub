/**
 * Teste de carga do caminho de vídeo.
 *
 * Mede o que realmente limita este produto. Não é o CPU do Next renderizando
 * página: é o `/api/iptv/stream`, que puxa vídeo do provedor e reempurra para
 * o assinante pelo event loop do Node — um fluxo contínuo por espectador,
 * aberto por horas.
 *
 * Por isso o teste NÃO bate em rota de página. Ele abre N fluxos simultâneos
 * e mede três coisas ao longo do tempo:
 *
 *   - vazão agregada (MB/s) — é o teto de banda que a máquina sustenta
 *   - fluxos que morreram no meio — é o sintoma que o assinante sente
 *   - latência até o primeiro byte — degrada antes de tudo o mais quebrar
 *
 * COMO USAR
 *
 *   node tests/carga-player.mjs --url "https://SEU_HOST/api/iptv/stream?url=..." \
 *                               --cookie "authjs.session-token=..." \
 *                               --espectadores 50 --segundos 120
 *
 * O cookie sai do DevTools (aba Application → Cookies) de uma sessão logada:
 * a rota exige autenticação, e sem ele o teste só mede 401.
 *
 * AVISO: rodar isto contra produção COM CLIENTES consome banda e conexões do
 * provedor de verdade. Use quando não houver ninguém assistindo.
 */

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
}

const URL_ALVO = args.get("url");
const COOKIE = args.get("cookie") ?? "";
const ESPECTADORES = Number(args.get("espectadores") ?? 25);
const SEGUNDOS = Number(args.get("segundos") ?? 60);
/** Escada: sobe de poucos em poucos para achar ONDE quebra, não só SE quebra. */
const DEGRAU = Number(args.get("degrau") ?? 5);

if (!URL_ALVO) {
  console.error(`
Falta --url.

  node tests/carga-player.mjs --url "https://host/api/iptv/stream?url=ENCODED" \\
      --cookie "authjs.session-token=..." --espectadores 50 --segundos 120
`);
  process.exit(1);
}

const estado = {
  abertos: 0,
  concluidos: 0,
  falhas: 0,
  mortosNoMeio: 0,
  bytes: 0,
  primeiroByteMs: [],
  status: new Map(),
};

function registrarStatus(s) {
  estado.status.set(s, (estado.status.get(s) ?? 0) + 1);
}

/** Um espectador: abre o fluxo, consome como o navegador consumiria, e conta. */
async function espectador(id, fimEm) {
  const controlador = new AbortController();
  const t0 = Date.now();
  let bytesDeste = 0;
  let recebeuAlgo = false;

  const parar = setTimeout(() => controlador.abort(), Math.max(0, fimEm - Date.now()));

  try {
    estado.abertos++;
    const resposta = await fetch(URL_ALVO, {
      headers: {
        ...(COOKIE ? { cookie: COOKIE } : {}),
        "User-Agent": `carga-tvhub/${id}`,
      },
      signal: controlador.signal,
    });

    registrarStatus(resposta.status);

    if (!resposta.ok || !resposta.body) {
      estado.falhas++;
      return;
    }

    estado.primeiroByteMs.push(Date.now() - t0);

    for await (const pedaco of resposta.body) {
      bytesDeste += pedaco.length;
      estado.bytes += pedaco.length;
      recebeuAlgo = true;
    }

    /**
     * Chegou ao fim do corpo ANTES do tempo previsto.
     *
     * É exatamente o sintoma de "congelou do nada": para o navegador o arquivo
     * simplesmente terminou, sem erro nenhum. Contar isso separado de `falhas`
     * importa — falha aparece no log, isto não aparece em lugar nenhum.
     */
    if (Date.now() < fimEm - 2000 && recebeuAlgo) {
      estado.mortosNoMeio++;
    }
    estado.concluidos++;
  } catch (erro) {
    if (erro?.name === "AbortError") {
      estado.concluidos++;
      return;
    }
    estado.falhas++;
    registrarStatus(erro?.cause?.code ?? erro?.code ?? "ERRO");
  } finally {
    clearTimeout(parar);
    estado.abertos--;
  }
}

const mb = (b) => (b / 1024 / 1024).toFixed(1);
const mediana = (a) => {
  if (a.length === 0) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

console.log(`
Alvo:          ${URL_ALVO.slice(0, 90)}${URL_ALVO.length > 90 ? "…" : ""}
Espectadores:  ${ESPECTADORES} (em degraus de ${DEGRAU})
Duração:       ${SEGUNDOS}s
Autenticado:   ${COOKIE ? "sim" : "NÃO — vai medir 401"}
`);

const fimEm = Date.now() + SEGUNDOS * 1000;
const tarefas = [];
let ultimoBytes = 0;

const relogio = setInterval(() => {
  const delta = estado.bytes - ultimoBytes;
  ultimoBytes = estado.bytes;
  const restam = Math.max(0, Math.round((fimEm - Date.now()) / 1000));
  console.log(
    `  ativos ${String(estado.abertos).padStart(4)} | ` +
      `${mb(delta)} MB/s | total ${mb(estado.bytes)} MB | ` +
      `falhas ${estado.falhas} | mortos no meio ${estado.mortosNoMeio} | ${restam}s`,
  );
}, 1000);

// Escada de carga: entrar todo mundo de uma vez mede só o pico de conexão,
// não o comportamento sob carga sustentada.
(async () => {
  for (let i = 0; i < ESPECTADORES; i += DEGRAU) {
    for (let j = 0; j < DEGRAU && i + j < ESPECTADORES; j++) {
      tarefas.push(espectador(i + j, fimEm));
    }
    await new Promise((r) => setTimeout(r, 1500));
    if (Date.now() >= fimEm) break;
  }

  await Promise.allSettled(tarefas);
  clearInterval(relogio);

  const duracao = SEGUNDOS;
  const vazaoMedia = estado.bytes / duracao;
  const porEspectador = vazaoMedia / Math.max(1, ESPECTADORES);

  console.log(`
================= RESULTADO =================
Espectadores simultâneos:   ${ESPECTADORES}
Vazão agregada média:       ${mb(vazaoMedia)} MB/s  (${((vazaoMedia * 8) / 1e6).toFixed(0)} Mbps)
Vazão por espectador:       ${mb(porEspectador)} MB/s (${((porEspectador * 8) / 1e6).toFixed(1)} Mbps)
Tempo até o 1º byte (med.): ${mediana(estado.primeiroByteMs)} ms
Fluxos que falharam:        ${estado.falhas}
Fluxos mortos no meio:      ${estado.mortosNoMeio}   <-- o "congelou do nada"
Respostas por status:       ${[...estado.status.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}

COMO LER
  - "mortos no meio" > 0 significa que o servidor está cortando fluxo saudável.
  - Vazão por espectador MUITO abaixo do bitrate do canal (tipicamente 2-6
    Mbps) significa que já não há banda para todos: a partir daí o assinante
    vê travando, mesmo sem erro nenhum no log.
  - Tempo até o 1º byte subindo com a carga é o event loop saturando. É o
    primeiro sinal, e aparece antes de qualquer falha.
============================================
`);

  process.exit(estado.falhas > 0 || estado.mortosNoMeio > 0 ? 1 : 0);
})();
