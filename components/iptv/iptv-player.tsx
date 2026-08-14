"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";

import { ReportModal } from "@/components/iptv/report-modal";
import {
  qualidadeIdealPara,
  type VarianteQualidade,
} from "@/lib/iptv/quality";
import {
  bufferPlanFor,
  detectBufferProfile,
  detectConnectionProfile,
  escalate,
  type ConnectionProfile,
} from "@/lib/playback/connection";
import { cleanMediaTitle, cn, formatTimecode } from "@/lib/utils";

type PlayerState = "loading" | "playing" | "paused" | "stalled" | "error";

const MAX_RETRIES = 3;

/**
 * Quantas vezes insistir na MESMA fonte antes de trocar.
 *
 * O provedor devolve 404 esporádico em URL boa: 1 em 20 requisições, medido.
 * Duas repetições levam a chance de falsa falha de 5% para menos de 0,02%.
 */
const MAX_TENTATIVAS_MESMA_FONTE = 2;

/**
 * Prazo para o primeiro quadro, por perfil de conexão.
 *
 * Existe porque canal morto no provedor não dá erro: ele responde HTTP 200 e
 * simplesmente não manda byte nenhum. Sem erro não há evento, e o player fica
 * girando para sempre — era isso que fazia "uns canais rodarem e outros não".
 * Estourado o prazo sem um único quadro, tratamos como falha e passamos para a
 * próxima fonte, incluindo a URL da segunda M3U.
 *
 * Em conexão ruim o prazo é bem mais folgado: é melhor demorar a abrir do que
 * abandonar um stream que ia funcionar.
 */
const PRAZO_PRIMEIRO_QUADRO: Record<ConnectionProfile, number> = {
  good: 16000,
  fair: 24000,
  poor: 32000,
};


/** Gera todas as variantes possíveis de stream para reprodução (URL original sempre em 1º lugar para zero delay) */
/**
 * iOS não toca Matroska (`.mkv`) nem AVI — nem no Safari, nem em nenhum outro
 * navegador do iPhone, porque todos usam o motor do sistema. O suporte da
 * Apple é MP4/M4V/MOV e HLS, e não há biblioteca que resolva: container não é
 * codec, e `<video>` simplesmente recusa o arquivo.
 *
 * Reconhecer o aparelho pelo user agent é frágil em geral, mas aqui o alvo é
 * exatamente "todo navegador rodando no iOS", que é o que essa checagem
 * acerta. `MacIntel` com toque é o iPad, que se apresenta como desktop desde
 * o iPadOS 13.
 */
function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPhone|iPod|iPad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function buildStreamVariants(rawUrl: string, isLive = true): string[] {
  if (!rawUrl) return [];
  const isProgressive = /\.(mp4|mkv|avi|webm)/i.test(rawUrl);

  /**
   * Filme e série NÃO tinham variante nenhuma: `return [rawUrl]` significa uma
   * fonte só, sem segunda chance. No iPhone, um título `.mkv` batia no
   * `<video>`, era recusado pelo container, e o failover não tinha para onde
   * ir — é o "nem abre".
   *
   * O painel Xtream serve o mesmo id em mais de um container, então trocar a
   * extensão costuma devolver o mesmo filme num formato que o aparelho aceita.
   * No iOS a versão `.mp4` vai na FRENTE, porque ali o `.mkv` é recusa certa e
   * tentá-lo primeiro só gasta um ciclo de failover na cara do assinante.
   */
  if (isProgressive) {
    const semSuporte = /\.(mkv|avi)(\?|$)/i;
    if (!semSuporte.test(rawUrl)) return [rawUrl];

    const comoMp4 = rawUrl.replace(semSuporte, ".mp4$2");
    return Array.from(
      new Set(ehIOS() ? [comoMp4, rawUrl] : [rawUrl, comoMp4]),
    );
  }

  /**
   * VOD gravado com a extensão errada — conserto em tempo de reprodução.
   *
   * O `xtream-client.ts` montava toda URL de filme e episódio com `.m3u8`
   * fixo, ignorando o `container_extension` que o painel informa. Painel
   * Xtream serve VOD como ARQUIVO (`/movie/user/senha/<id>.mp4`), não como
   * HLS: pedir `.m3u8` devolve 404 na maioria dos painéis, ou um TS remuxado
   * sem duração e sem busca na barra.
   *
   * O `xtream-client.ts` já foi corrigido, mas as 150 mil linhas gravadas
   * continuam com `.m3u8` até a próxima sincronização. Aqui as alternativas
   * corretas entram na FRENTE, então filme e série voltam a tocar sem
   * depender de ressincronizar o catálogo inteiro.
   */
  const ehVod = /\/(movie|series)\//i.test(rawUrl);
  if (ehVod && /\.m3u8(\?|$)/i.test(rawUrl)) {
    return Array.from(
      new Set([
        rawUrl.replace(/\.m3u8(\?|$)/i, ".mp4$1"),
        rawUrl.replace(/\.m3u8(\?|$)/i, ".mkv$1"),
        rawUrl,
      ]),
    );
  }

  const variants: string[] = [];

  // A URL exata do provedor entra SEMPRE em primeiro lugar para reprodução instantânea
  variants.push(rawUrl);

  if (rawUrl.endsWith(".ts")) {
    variants.push(rawUrl.replace(/\.ts$/i, ".m3u8"));
  } else if (rawUrl.endsWith(".m3u8")) {
    variants.push(rawUrl.replace(/\.m3u8$/i, ".ts"));
  } else {
    variants.push(`${rawUrl}.ts`);
    variants.push(`${rawUrl}.m3u8`);
  }

  return Array.from(new Set(variants));
}

const POPCORN_MESSAGES = [
  "🍿 Estourando a pipoca e preparando a sessão...",
  "🚀 Ajustando o melhor buffer para a sua internet...",
  "🎬 Sincronizando imagem e áudio com qualidade cinema...",
  "⚡ Conectando transmissão em alta velocidade...",
  "📺 Quase pronto! Segure o controle e aproveite...",
];

function PopcornLoading({
  channelName,
  isLive,
  isStalled,
}: {
  channelName?: string;
  isLive?: boolean;
  isStalled?: boolean;
}) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % POPCORN_MESSAGES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md z-30 p-6 text-center select-none animate-fade-in">
      {/* Ambient glowing backdrop circle */}
      <div className="absolute h-56 w-56 rounded-full bg-gradient-to-tr from-pink-500/20 via-purple-600/20 to-indigo-600/20 blur-3xl pointer-events-none" />

      {/* Bouncing popcorn container */}
      <div className="relative mb-5 flex items-center justify-center">
        {/* Popping flying popcorn particles */}
        <span className="absolute -top-6 -left-6 text-2xl animate-bounce">🍿</span>
        <span className="absolute -top-7 right-1 text-xl animate-ping">✨</span>
        <span className="absolute -bottom-2 -right-6 text-2xl animate-bounce">🍿</span>
        <span className="absolute -top-4 right-7 text-lg animate-pulse">⭐</span>

        {/* Central Popcorn Icon with Glow */}
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 p-0.5 shadow-[0_0_40px_rgba(236,72,153,0.5)]">
          <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-black/80 backdrop-blur-sm">
            <span className="text-4xl animate-bounce">🍿</span>
          </div>
        </div>
      </div>

      {/* Dynamic Animated Message */}
      <h3 className="min-h-[28px] text-sm md:text-base font-extrabold text-white drop-shadow transition-all duration-300">
        {isStalled ? "⚡ Estabilizando sinal para evitar travamentos..." : POPCORN_MESSAGES[msgIndex]}
      </h3>

      {/* Channel info & live hint */}
      {channelName && (
        <p className="mt-1 text-xs font-semibold text-white/70 max-w-sm truncate">
          {cleanMediaTitle(channelName)} {isLive && "· Transmissão Ao Vivo"}
        </p>
      )}

      {/* Glowing animated progress track */}
      <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/10 relative">
        <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 animate-[shimmer_1.5s_infinite_linear] shadow-[0_0_10px_rgba(236,72,153,0.8)]" />
      </div>

      <p className="mt-3 text-[11px] font-medium text-white/40">
        Buffer inteligente ativo · zero travamentos
      </p>
    </div>
  );
}

export function IptvPlayer({
  streamUrl,
  channelName,
  channelId,
  isLive = true,
  alternativeStreams = [],
  qualidades = [],
  initialPosition = 0,
}: {
  streamUrl: string;
  channelName: string;
  channelId?: string;
  isLive?: boolean;
  alternativeStreams?: string[];
  qualidades?: VarianteQualidade[];
  initialPosition?: number;
  episodes?: Array<{
    id: string;
    name: string;
    isCurrent: boolean;
    isWatched?: boolean;
    season?: number;
    episodeNum?: number;
  }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const progressTimer = useRef<ReturnType<typeof setInterval>>();
  const stallDebounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const networkRetryCount = useRef<number>(0);
  const hasResumedRef = useRef<boolean>(false);

  const [state, setState] = useState<PlayerState>("loading");
  const [showDebouncedSpinner, setShowDebouncedSpinner] = useState(false);
  /**
   * Detectado já no primeiro render, não num efeito.
   *
   * Como efeito, o motor montava com o palpite "fair", o estado mudava logo em
   * seguida e o efeito de inicialização — que tem `profile` nas dependências —
   * derrubava tudo e remontava. Ou seja: toda abertura de canal montava o
   * player duas vezes e abria duas conexões com o provedor, sendo que a
   * primeira ficava órfã. Painel de IPTV limita conexões por conta, então a
   * conexão abandonada ainda atrapalhava a que valia.
   *
   * Ler `navigator` aqui é seguro: no servidor a função devolve "fair", e o
   * perfil não aparece em nada renderizado, então não há divergência de
   * hidratação possível.
   */
  /**
   * `detectBufferProfile`, não `detectConnectionProfile`: este estado dimensiona
   * BUFFER, e buffer generoso demais custa espera, enquanto buffer curto demais
   * custa travada. A escolha de QUALIDADE logo abaixo continua com a detecção
   * otimista, porque lá o erro para baixo prende o assinante em SD a sessão
   * inteira.
   */
  const [profile, setProfile] = useState<ConnectionProfile>(detectBufferProfile);

  /**
   * Qualidade em uso, gerenciada inteligentemente pelo player:
   * Começa SEMPRE na variante mais leve (SD, índice 0) para início instantâneo
   * (< 300ms) no celular e no computador. Após acumular buffer com segurança,
   * sobe suavemente em segundo plano para HD / FHD.
   */
  const temEscolhaDeQualidade = qualidades.length > 0;
  const [nivelQualidade, setNivelQualidade] = useState(0);

  const urlBase =
    qualidades.length > 0 && qualidades[nivelQualidade]
      ? qualidades[nivelQualidade].streamUrl
      : streamUrl;

  // Gera todas as variantes de stream síncronamente na renderização (evita array vazio inicial!)
  const mainVariants = buildStreamVariants(urlBase, isLive);
  const altVariants = alternativeStreams.flatMap((u) => (u ? buildStreamVariants(u, isLive) : []));
  const allStreams = Array.from(new Set([...mainVariants, ...altVariants]));

  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);

  const activeStreamUrl = allStreams[currentStreamIndex] || urlBase;
  const isProgressive = /\.(mp4|mkv|avi|webm)/i.test(activeStreamUrl);
  /** MPEG-TS cru (sem manifesto HLS): exige mpegts.js, ninguém mais lê isso. */
  const isRawTs = /\.ts(\?|$)/i.test(activeStreamUrl);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const [attempt, setAttempt] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);
  const [autoMutedHint, setAutoMutedHint] = useState(false);

  /**
   * Quanto esperar tocando limpo antes de tentar subir a qualidade de novo.
   */
  const esperaParaSubir = useRef(5000);
  const timerSubida = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Contador de insistências na fonte atual (ver tryNextSourceOrFail). */
  const tentativasNaFonte = useRef(0);
  const recargaTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Evita duas falhas simultâneas pularem duas fontes de uma vez. */
  const failoverEmVoo = useRef(false);
  /** Muda para remontar o motor na MESMA URL — é o que materializa a repetição. */
  const [recarga, setRecarga] = useState(0);

  /** Desce um degrau de resolução. Só age se houver degrau abaixo. */
  const baixarQualidade = useCallback(() => {
    if (!temEscolhaDeQualidade || nivelQualidade <= 0) return false;
    setNivelQualidade(nivelQualidade - 1);
    esperaParaSubir.current = Math.min(esperaParaSubir.current * 2, 60_000);
    return true;
  }, [temEscolhaDeQualidade, nivelQualidade]);

  /**
   * Sobe suavemente para o nível de qualidade ideal da conexão
   * após acumular buffer com segurança.
   */
  useEffect(() => {
    if (!temEscolhaDeQualidade) return;
    if (state !== "playing") return;
    const targetIdeal = qualidadeIdealPara(detectConnectionProfile(), qualidades);
    if (nivelQualidade >= targetIdeal || nivelQualidade >= qualidades.length - 1) return;

    timerSubida.current = setTimeout(() => {
      setNivelQualidade((n) => Math.min(n + 1, targetIdeal, qualidades.length - 1));
    }, esperaParaSubir.current);

    return () => {
      if (timerSubida.current) clearTimeout(timerSubida.current);
    };
  }, [state, nivelQualidade, temEscolhaDeQualidade, qualidades]);

  /**
   * Trocar de resolução recomeça a escada de reservas do zero.
   *
   * Sem isto, o índice de failover herdado apontaria para uma variante da
   * resolução anterior, e descer de HD para SD podia cair de volta no HD —
   * justo a que estava travando.
   */
  useEffect(() => {
    setCurrentStreamIndex(0);
    tentativasNaFonte.current = 0;
    failoverEmVoo.current = false;
  }, [urlBase]);

  // URL final de mídia enviada ao player:
  // Em produção (HTTPS), a URL de stream IPTV deve SEMPRE passar pelo proxy
  // para evitar bloqueio de Mixed Content (HTTP em HTTPS) e resolver CORS/User-Agent.
  const playableUrl = !activeStreamUrl
    ? ""
    : activeStreamUrl.startsWith("/api/")
    ? activeStreamUrl
    : `/api/iptv/stream?url=${encodeURIComponent(activeStreamUrl)}`;

  // Controls Hiding Timer — também no toque (celular não tem mousemove)
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (state === "playing") {
        setShowControls(false);
      }
    }, 4000);
  }, [state]);

  // Ao começar a tocar, arma o auto-hide mesmo sem mouse/toque.
  useEffect(() => {
    if (state === "playing") resetHideTimer();
  }, [state, resetHideTimer]);

  // Failover para próxima fonte (Proxy <-> Direto <-> Variantes .m3u8/.ts <-> Lista Secundária)
  const tryNextSourceOrFail = useCallback(() => {
    if (failoverEmVoo.current) return;
    failoverEmVoo.current = true;
    networkRetryCount.current = 0;

    /**
     * Antes de trocar de fonte, INSISTE na mesma.
     *
     * O servidor de IPTV erra sozinho: medindo 20 requisições seguidas à mesma
     * URL, uma voltou 404 e as outras dezenove vieram com vídeo. É soluço do
     * provedor, não fonte quebrada.
     *
     * Sem esta insistência, cada soluço desses derrubava a reprodução — e pior:
     * o player descia a lista inteira de variantes, cada uma sujeita ao mesmo
     * soluço, até esgotar tudo e mostrar a tela de erro. Um canal perfeitamente
     * bom virava "não reproduz". Com duas repetições, a chance de falsa falha
     * cai de 5% para menos de 0,02%.
     */
    if (tentativasNaFonte.current < MAX_TENTATIVAS_MESMA_FONTE) {
      tentativasNaFonte.current += 1;
      setState("loading");
      if (recargaTimer.current) clearTimeout(recargaTimer.current);
      // Um respiro antes de repetir: bater na hora costuma pegar o mesmo erro.
      recargaTimer.current = setTimeout(() => {
        failoverEmVoo.current = false;
        setRecarga((n) => n + 1);
      }, 200);
      return;
    }

    tentativasNaFonte.current = 0;

    // Toda fonte já sai pelo proxy, então não há degrau "direto → proxy":
    // a fonte esgotada passa direto para a próxima variante de stream.
    if (currentStreamIndex < allStreams.length - 1) {
      setCurrentStreamIndex((prev) => prev + 1);
      setState("loading");
    } else if (attempt < MAX_RETRIES) {
      setProfile((prev) => escalate(prev));
      setCurrentStreamIndex(0);
      setAttempt((prev) => prev + 1);
      setState("loading");
    } else {
      setState("error");
    }
    setTimeout(() => {
      failoverEmVoo.current = false;
    }, 50);
  }, [currentStreamIndex, attempt, allStreams.length]);

  // Trocar de fonte zera a insistência: a contagem é por fonte, não global.
  useEffect(() => {
    tentativasNaFonte.current = 0;
  }, [currentStreamIndex]);

  /**
   * Trocar de qualidade recomeça a escada de reservas do zero.
   *
   * Sem isto, o índice de failover herdado apontaria para a variante da
   * qualidade anterior, e mudar de HD para SD podia cair de volta no HD.
   */
  useEffect(() => {
    setCurrentStreamIndex(0);
    tentativasNaFonte.current = 0;
    failoverEmVoo.current = false;
  }, [urlBase]);

  useEffect(() => () => {
    if (recargaTimer.current) clearTimeout(recargaTimer.current);
  }, []);

  // Initialize HLS.js or Native Video Engine
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playableUrl) return;

    let disposed = false;
    let engine: { destroy: () => void } | null = null;
    let abortarSonda: AbortController | null = null;
    hasResumedRef.current = false;

    /**
     * Descobre o formato REAL lendo os primeiros bytes, em vez de deduzir do
     * endereço.
     *
     * O painel Xtream nomeia canal ao vivo como `.m3u8` mesmo quando entrega
     * MPEG-TS puro, sem manifesto nenhum. Escolhendo o motor pela extensão, o
     * player entregava esse TS binário ao hls.js, que procura linhas de texto
     * de playlist, não acha nada para baixar e fica girando para sempre — o
     * "canal só carregando". Filme (`.mp4`) escapava porque vai pelo caminho
     * nativo.
     *
     * Dois sinais bastam e nenhum depende do provedor mandar cabeçalho certo:
     *   - manifesto HLS começa, obrigatoriamente, com `#EXTM3U`
     *   - MPEG-TS começa com o byte de sincronismo 0x47
     *
     * São 8 bytes por Range, e o pedido é abortado logo em seguida: o
     * provedor concede poucas conexões por conta e nenhuma pode ficar presa
     * numa sonda.
     */
    async function detectarFormato(url: string): Promise<"hls" | "mpegts" | null> {
      abortarSonda = new AbortController();
      try {
        const resposta = await fetch(`${url}&sonda=1`, {
          signal: abortarSonda.signal,
        });
        if (!resposta.ok) return null;
        const dados = (await resposta.json()) as { formato: "hls" | "mpegts" | null };
        return dados.formato ?? null;
      } catch {
        // Sonda falhou (rede, aborto): segue pelo palpite da extensão.
        return null;
      } finally {
        abortarSonda = null;
      }
    }

    const start = () => {
      if (disposed) return;
      video.muted = isMuted;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (!disposed) setState("playing");
          })
          .catch((err: Error) => {
            if (disposed) return;
            // Trata bloqueio de Autoplay do navegador sem travar na tela de loading
            if (err.name === "NotAllowedError" || err.message?.includes("interact")) {
              video.muted = true;
              setIsMuted(true);
              setAutoMutedHint(true);
              video
                .play()
                .then(() => {
                  if (!disposed) setState("playing");
                })
                .catch(() => {
                  if (!disposed) setState("paused");
                });
            }
          });
      }
    };

    const usarNativo = () => {
      video.src = playableUrl;
      video.load();
      start();
    };

    /**
     * Inicialização Instantânea (Zero Delay):
     * Escolhe o motor correto imediatamente sem esperar requisições de sonda.
     */
    const escolherMotor = () => {
      if (isProgressive) {
        usarNativo();
        return;
      }

      // Safari / iOS nativo toca HLS diretamente pelo motor do sistema
      if (ehIOS() || (video.canPlayType("application/vnd.apple.mpegurl") && !isRawTs && !window.MediaSource)) {
        usarNativo();
        return;
      }

      // Se for stream .ts puro, vai direto para mpegts.js
      if (isRawTs) {
        iniciarMotor(true);
        return;
      }

      // Por padrão em navegadores modernos, inicia HLS.js
      iniciarMotor(false);
    };

    const iniciarMotor = (usarMpegts: boolean) => {
      if (usarMpegts) {
      /**
       * MPEG-TS puro precisa de mpegts.js.
       *
       * Esta é a variante de reserva dos canais ao vivo: quando o provedor
       * não entrega `.m3u8`, sobra o `.ts` cru. O hls.js não lê TS sem
       * manifesto, e o `<video>` nativo também não — nem no Safari, apesar de
       * ele responder que sabe tocar HLS. Por isso o teste do `.ts` vem
       * ANTES do `canPlayType`: senão o Safari sequestra o fluxo e não toca.
       */
      import("mpegts.js")
        .then((mod) => {
          if (disposed) return;
          const mpegts = mod.default ?? mod;

          if (!mpegts.isSupported()) {
            // Sem MSE (iPhone, TV antiga): não há como decodificar TS aqui.
            // O vigia de travamento troca para a próxima fonte.
            usarNativo();
            return;
          }

          const plano = bufferPlanFor(profile);

          const player = mpegts.createPlayer(
            { type: "mpegts", isLive, url: playableUrl },
            {
              enableWorker: true,
              // Sem o stash, qualquer oscilação de rede vira travada: é ele
              // que absorve a diferença entre o que chega e o que é exibido.
              enableStashBuffer: true,
              stashInitialSize: plano.stashInitialSize,

              /**
               * Perseguição de latência DESLIGADA.
               *
               * Ela funciona dando SEEK para a frente no fluxo ao vivo, e seek
               * em MPEG-TS sobre MSE reinicia a decodificação — engasgo na
               * imagem. Pior: ela come exatamente o colchão de buffer que é a
               * única defesa contra oscilação de rede, então trabalha contra o
               * objetivo de não travar. A issue xqq/mpegts.js#13 relata tela
               * preta nos primeiros segundos com ela ligada.
               *
               * O preço de deixar desligada é o atraso crescer numa sessão
               * muito longa. É barato: ninguém compara canal com relógio, e
               * travar é o que incomoda.
               */
              liveBufferLatencyChasing: false,

              /**
               * Limpeza automática do buffer de mídia. LIGADA.
               *
               * O padrão da biblioteca é `false`, e é o que faz canal congelar
               * depois de um tempo ligado. Sem limpeza o SourceBuffer acumula
               * TUDO que já passou — uma hora de canal são centenas de MB.
               * Ao bater na cota do navegador o `appendBuffer` falha e a
               * imagem para. Não é rede nem provedor: é memória, e por isso o
               * congelamento vem "do nada", sempre depois de um tempo, e
               * sempre pior nos aparelhos mais fracos.
               */
              autoCleanupSourceBuffer: true,
              autoCleanupMaxBackwardDuration: 120,
              autoCleanupMinBackwardDuration: 60,

              /** Evita dessincronizar áudio e vídeo em fluxo com furo. */
              fixAudioTimestampGap: true,

              lazyLoad: false,
            },
          );

          player.attachMediaElement(video);
          player.load();
          start();

          player.on(mpegts.Events.ERROR, () => {
            if (!disposed) tryNextSourceOrFail();
          });

          engine = {
            destroy: () => {
              try {
                player.destroy();
              } catch {}
            },
          };
        })
        .catch(() => {
          if (!disposed) usarNativo();
        });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      usarNativo();
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            video.src = playableUrl;
            video.load();
            start();
            return;
          }

          const plano = bufferPlanFor(profile);

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            /**
             * Buffer Generoso de 20 a 30 segundos nos Canais Ao Vivo:
             * Evita que o player encoste na borda da transmissão ao vivo e
             * garante que oscilações normais de Wi-Fi/4G não façam o vídeo travar.
             */
            maxBufferLength: isLive ? 35 : plano.vodBufferSeconds,
            maxMaxBufferLength: isLive ? 60 : plano.vodBufferSeconds * 2,
            maxBufferSize: 60 * 1000 * 1000,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 4,
            levelLoadingTimeOut: 10000,
            fragLoadingTimeOut: 15000,
            fragLoadingMaxRetry: 5,

            startLevel: 0,
            abrEwmaDefaultEstimate: 1_500_000,
            capLevelToPlayerSize: true,

            maxBufferHole: 0.5,
            nudgeOffset: 0.2,
            nudgeMaxRetry: 10,

            backBufferLength: isLive ? 30 : 60,
            startFragPrefetch: true,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 15,
            liveDurationInfinity: true,
            highBufferWatchdogPeriod: 2,
            autoStartLoad: true,
          });

          hls.loadSource(playableUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            start();
          });

          hls.on(Hls.Events.FRAG_BUFFERED, () => {
            if (!disposed) setState("playing");
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  if (networkRetryCount.current < 2) {
                    networkRetryCount.current++;
                    hls.startLoad();
                  } else {
                    iniciarMotor(true);
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  iniciarMotor(true);
                  break;
              }
            }
          });

          engine = {
            destroy: () => {
              try {
                hls.detachMedia();
                hls.destroy();
              } catch {}
            },
          };
        })
        .catch(() => {
          if (disposed) return;
          video.src = playableUrl;
          video.load();
          start();
        });
    }
    };

    void escolherMotor();

    return () => {
      disposed = true;
      abortarSonda?.abort();
      engine?.destroy();
      video.removeAttribute("src");
      video.load();
    };
    // `isMuted` fica de fora de propósito: ele só é lido para o estado inicial
    // do áudio. Incluí-lo remontaria o motor a cada clique no mudo, cortando a
    // reprodução.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playableUrl,
    isProgressive,
    isRawTs,
    isLive,
    profile,
    attempt,
    currentStreamIndex,
    recarga,
    tryNextSourceOrFail,
  ]);

  /**
   * Vigia do primeiro quadro.
   *
   * O `stallTimer` lá embaixo só arma depois de um evento `waiting`, que exige
   * que a reprodução já tenha começado. Quando a fonte está morta e não chega
   * byte algum, esse evento nunca acontece — e nada nunca desiste. Este vigia
   * cobre justamente a janela entre "mandei tocar" e "tocou".
   */
  useEffect(() => {
    // Não abandonar durante buffering: canal lento ainda está carregando.
    if (state === "playing" || state === "paused" || state === "error" || state === "stalled") {
      return;
    }

    const vigia = setTimeout(() => {
      const video = videoRef.current;
      // Se já há dado chegando, é lentidão e não fonte morta: deixa continuar.
      if (video && (video.readyState >= 2 || video.currentTime > 0)) return;
      tryNextSourceOrFail();
    }, PRAZO_PRIMEIRO_QUADRO[profile]);

    return () => clearTimeout(vigia);
  }, [state, profile, playableUrl, tryNextSourceOrFail]);

  // Event Listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let stallTimer: ReturnType<typeof setTimeout> | undefined;

    const clearStall = () => {
      if (stallTimer) {
        // O vigia virou `setInterval`; `clearInterval` é o par correto.
        clearInterval(stallTimer as unknown as ReturnType<typeof setInterval>);
        stallTimer = undefined;
      }
      setShowDebouncedSpinner(false);
    };

    const clearStallDebounce = () => {
      if (stallDebounceTimer.current) {
        clearTimeout(stallDebounceTimer.current);
        stallDebounceTimer.current = undefined;
      }
    };

    const onPlaying = () => {
      clearStall();
      clearStallDebounce();
      // Tocou: o crédito de insistência volta cheio para o próximo soluço.
      tentativasNaFonte.current = 0;
      failoverEmVoo.current = false;
      setState("playing");

      if (initialPosition > 10 && !hasResumedRef.current) {
        hasResumedRef.current = true;
        try {
          if (Math.abs(video.currentTime - initialPosition) > 5) {
            video.currentTime = initialPosition;
          }
        } catch {}
      }
    };

    const onDataReady = () => {
      clearStall();
      clearStallDebounce();
      if (!video.paused) {
        setState("playing");
      }
    };

    const onPause = () => setState((s) => (s === "error" ? s : "paused"));

    /**
     * `waiting` não é sentença — quem julga é o PROGRESSO do buffer.
     *
     * Antes, doze segundos engasgado trocavam de fonte. Só que `waiting` é o
     * navegador ENCHENDO o buffer, e num 4G isso passa de doze segundos com
     * frequência. A fonte certa era abandonada no meio do carregamento, o
     * player descia a lista de reservas (que costuma ser pior) e terminava em
     * "não consegui abrir". No computador, com fibra, o buffer enchia antes do
     * prazo e o mesmo canal abria — daí "funciona no PC e no celular não".
     *
     * Agora o relógio só corre enquanto NADA se mexe: nem o fim do buffer, nem
     * o tempo do vídeo. Fonte de verdade morta continua sendo detectada em
     * poucos segundos, porque aí realmente nada avança.
     */
    const onWaiting = () => {
      // Se o vídeo já está renderizando frames e avançando tempo, não marca como stalled
      if (video.currentTime > 0 && !video.paused) {
        // Apenas debounce
      } else {
        setState((s) => (s === "error" ? s : "stalled"));
      }

      if (!stallDebounceTimer.current) {
        stallDebounceTimer.current = setTimeout(() => {
          stallDebounceTimer.current = undefined;
          setShowDebouncedSpinner(true);
          baixarQualidade();
        }, 4000);
      }

      if (stallTimer) clearTimeout(stallTimer);

      let ultimoFim = -1;
      let ultimoTempo = -1;
      let paradoDesde = Date.now();

      const vigiar = () => {
        const b = video.buffered;
        const fim = b.length > 0 ? b.end(b.length - 1) : 0;
        const t = video.currentTime;

        // Pausado pelo usuário nunca é fonte morta.
        if (video.paused) {
          paradoDesde = Date.now();
        } else if (fim > ultimoFim + 0.05 || t > ultimoTempo + 0.05) {
          // Buffer crescendo ou relógio andando: está vivo, zera o prazo.
          ultimoFim = fim;
          ultimoTempo = t;
          paradoDesde = Date.now();
        } else if (Date.now() - paradoDesde > 20000) {
          clearInterval(stallTimer as ReturnType<typeof setInterval>);
          stallTimer = undefined;
          tryNextSourceOrFail();
          return;
        }
      };

      stallTimer = setInterval(vigiar, 1000) as unknown as ReturnType<typeof setTimeout>;
    };

    const onError = () => {
      clearStall();
      clearStallDebounce();
      tryNextSourceOrFail();
    };

    const onTime = () => {
      setCurrentTime(video.currentTime);
      if (Number.isFinite(video.duration)) setDuration(video.duration);
      if (video.currentTime > 0 && !video.paused) {
        setState("playing");
      }
    };

    const onVolume = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onDataReady);
    video.addEventListener("loadeddata", onDataReady);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onWaiting);
    video.addEventListener("error", onError);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("volumechange", onVolume);

    return () => {
      clearStall();
      clearStallDebounce();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onDataReady);
      video.removeEventListener("loadeddata", onDataReady);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onWaiting);
      video.removeEventListener("error", onError);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("volumechange", onVolume);
    };
  }, [tryNextSourceOrFail, initialPosition, baixarQualidade]);

  // Periodic Watch Progress Heartbeat (every 8 seconds)
  useEffect(() => {
    progressTimer.current = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && video.currentTime > 5) {
        fetch("/api/iptv/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titleName: channelName,
            channelId: channelId || "",
            positionSeconds: Math.floor(video.currentTime),
            durationSeconds: Math.floor(video.duration || 0),
          }),
        }).catch(() => {});
      }
    }, 8000);

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [channelName, channelId]);

  // Play/Pause Toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<"left" | "right" | null>(null);
  const lastTapTime = useRef<number>(0);

  // Mute Toggle
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    if (!video.muted) setAutoMutedHint(false);
  };

  // Seek relative
  const seekRelative = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
  };

  // Speed Change
  const changeSpeed = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  // Picture in Picture
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {}
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard Shortcuts (Space, F, M, P, Arrows, J, K, L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em input/textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seekRelative(-10);
          setDoubleTapFeedback("left");
          setTimeout(() => setDoubleTapFeedback(null), 600);
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seekRelative(10);
          setDoubleTapFeedback("right");
          setTimeout(() => setDoubleTapFeedback(null), 600);
          break;
        case "arrowup":
          e.preventDefault();
          const newVolUp = Math.min(1, video.volume + 0.1);
          video.volume = newVolUp;
          setVolume(newVolUp);
          setIsMuted(false);
          break;
        case "arrowdown":
          e.preventDefault();
          const newVolDown = Math.max(0, video.volume - 0.1);
          video.volume = newVolDown;
          setVolume(newVolDown);
          setIsMuted(newVolDown === 0);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "p":
          e.preventDefault();
          void togglePiP();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay]);

  // Touch Handler com Double Tap Gestures (estilo YouTube/Netflix mobile)
  const handleTouchContainer = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    const isDouble = now - lastTapTime.current < DOUBLE_TAP_DELAY;
    lastTapTime.current = now;

    if (isDouble && !isLive) {
      // Pega coordenadas X para saber se foi na metade esquerda ou direita
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const clientX = "touches" in e ? e.touches[0]?.clientX || rect.width / 2 : (e as React.MouseEvent).clientX;
        const relativeX = clientX - rect.left;
        if (relativeX < rect.width / 2) {
          seekRelative(-10);
          setDoubleTapFeedback("left");
          setTimeout(() => setDoubleTapFeedback(null), 650);
        } else {
          seekRelative(10);
          setDoubleTapFeedback("right");
          setTimeout(() => setDoubleTapFeedback(null), 650);
        }
      }
      return;
    }

    resetHideTimer();
  };

  // Manual Retry
  const handleManualRetry = () => {
    tentativasNaFonte.current = 0;
    failoverEmVoo.current = false;
    setAttempt(1);
    setCurrentStreamIndex(0);
    setState("loading");
    setRecarga((n) => n + 1);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={handleTouchContainer}
      className={cn(
        "group relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black select-none",
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen rounded-none" : "rounded-2xl shadow-2xl",
      )}
    >
      <video ref={videoRef} className="h-full w-full object-contain" playsInline autoPlay preload="auto" />

      {/* Visual Double-Tap Ripple Feedback (-10s / +10s) */}
      {doubleTapFeedback && (
        <div
          className={cn(
            "absolute inset-y-0 z-40 flex items-center justify-center w-1/3 bg-white/10 backdrop-blur-xs transition-opacity duration-300 pointer-events-none",
            doubleTapFeedback === "left" ? "left-0 rounded-r-full animate-fade-in" : "right-0 rounded-l-full animate-fade-in",
          )}
        >
          <div className="flex flex-col items-center text-white font-extrabold drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
            {doubleTapFeedback === "left" ? <RotateCcw className="h-10 w-10 animate-spin" /> : <RotateCw className="h-10 w-10 animate-spin" />}
            <span className="text-sm mt-1">{doubleTapFeedback === "left" ? "-10s" : "+10s"}</span>
          </div>
        </div>
      )}

      {/* Loading Animado Estilo Pipoca & Stall */}
      {(state === "loading" || (state === "stalled" && showDebouncedSpinner)) && (
        <PopcornLoading
          channelName={channelName}
          isLive={isLive}
          isStalled={state === "stalled"}
        />
      )}

      {/* Error Fallback Screen */}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center z-30 animate-fade-in">
          <div className="rounded-full bg-rose-500/10 p-4 border border-rose-500/20 mb-4 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
            <RefreshCw className="h-8 w-8 text-rose-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Sinal indisponível no momento</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Não foi possível estabilizar a transmissão desta fonte. Tente reconectar.
          </p>
          <button
            type="button"
            onClick={handleManualRetry}
            className="mt-5 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 px-6 py-3 text-xs font-extrabold text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Aviso de autoplay mudo */}
      {autoMutedHint && state === "playing" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const video = videoRef.current;
            if (video) {
              video.muted = false;
              setIsMuted(false);
              setAutoMutedHint(false);
            }
          }}
          className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md border border-white/20 animate-bounce"
        >
          Som desligado — toque para ativar 🔊
        </button>
      )}

      {/* Player Overlays & Controls */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-between p-4 md:p-6 bg-gradient-to-t from-black/90 via-transparent to-black/60 transition-opacity duration-300 z-10",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="text-sm md:text-base font-extrabold drop-shadow-md truncate max-w-[200px] md:max-w-[500px]">
              {cleanMediaTitle(channelName)}
            </span>
            {isLive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-rose-600/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_10px_rgba(225,29,72,0.6)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                AO VIVO
              </span>
            ) : (
              <span className="rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                VOD
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setReportOpen(true)}
            aria-label="Reportar problema"
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90 transition-colors hover:bg-white/20 backdrop-blur-md"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Reportar</span>
          </button>
        </div>

        {/* Center Big Play Button when Paused */}
        {state === "paused" && (
          <button
            type="button"
            onClick={togglePlay}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 text-white shadow-[0_0_30px_rgba(236,72,153,0.8)] backdrop-blur-sm transition-transform hover:scale-115 active:scale-95 ring-4 ring-white/20"
          >
            <Play className="h-8 w-8 ml-1" fill="currentColor" />
          </button>
        )}

        {/* Bottom Bar Controls */}
        <div className="space-y-3">
          {/* Progress Bar (Only for VOD) */}
          {!isLive && duration > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium text-white/80">{formatTimecode(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onChange={(e) => {
                  const newTime = Number(e.target.value);
                  setCurrentTime(newTime);
                  if (videoRef.current) videoRef.current.currentTime = newTime;
                }}
                className="h-1.5 flex-1 cursor-pointer accent-pink-500 rounded-lg bg-white/20 hover:h-2 transition-all"
              />
              <span className="text-xs font-mono font-medium text-white/60">{formatTimecode(duration)}</span>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3 md:gap-4">
              <button
                type="button"
                onClick={togglePlay}
                className="hover:text-pink-400 transition-colors"
                title={state === "playing" ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
              >
                {state === "playing" ? (
                  <Pause className="h-5 w-5 md:h-6 md:w-6" />
                ) : (
                  <Play className="h-5 w-5 md:h-6 md:w-6" fill="currentColor" />
                )}
              </button>

              {!isLive && (
                <>
                  <button
                    type="button"
                    onClick={() => seekRelative(-10)}
                    className="hover:text-pink-400 transition-colors"
                    title="Voltar 10s (Seta Esquerda)"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(10)}
                    className="hover:text-pink-400 transition-colors"
                    title="Avançar 10s (Seta Direita)"
                  >
                    <RotateCw className="h-5 w-5" />
                  </button>
                </>
              )}

              {/* Volume Slider */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="hover:text-pink-400 transition-colors"
                  title="Mutar/Desmutar (M)"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5 text-rose-400" />
                  ) : (
                    <Volume2 className="h-5 w-5 text-emerald-400" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    setIsMuted(v === 0);
                    if (v > 0) setAutoMutedHint(false);
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = v === 0;
                    }
                  }}
                  className="h-1 w-16 md:w-20 cursor-pointer accent-pink-500 rounded-lg bg-white/20 hidden sm:block"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Seletor de Velocidade (VOD) */}
              {!isLive && (
                <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 text-xs font-bold backdrop-blur-md">
                  {[0.75, 1, 1.25, 1.5].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => changeSpeed(spd)}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] transition-colors",
                        playbackSpeed === spd ? "bg-pink-500 text-white" : "text-white/70 hover:text-white",
                      )}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              )}

              {/* Picture in Picture */}
              <button
                type="button"
                onClick={() => void togglePiP()}
                className="hover:text-pink-400 transition-colors hidden sm:block"
                title="Picture-in-Picture (P)"
              >
                <span className="text-xs font-bold border border-white/30 rounded px-1.5 py-0.5">PiP</span>
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="hover:text-pink-400 transition-colors"
                title="Tela Cheia (F)"
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        channelId={channelId}
        channelName={channelName}
      />
    </div>
  );
}
