"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
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

import {
  detectConnectionProfile,
  escalate,
  type ConnectionProfile,
} from "@/lib/playback/connection";
import { cn, formatTimecode } from "@/lib/utils";

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
  good: 4500,
  fair: 7000,
  poor: 12000,
};

/**
 * Buffer acumulado ANTES do primeiro quadro, no MPEG-TS.
 */
const BUFFER_INICIAL: Record<ConnectionProfile, number> = {
  good: 16 * 1024,
  fair: 32 * 1024,
  poor: 64 * 1024,
};

/** Gera todas as variantes possíveis de stream para reprodução (URL original sempre em 1º lugar para zero delay) */
function buildStreamVariants(rawUrl: string, isLive = true): string[] {
  if (!rawUrl) return [];
  const isProgressive = /\.(mp4|mkv|avi|webm)/i.test(rawUrl);
  if (isProgressive) return [rawUrl];

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

export function IptvPlayer({
  streamUrl,
  channelName,
  channelId,
  isLive = true,
  alternativeStreams = [],
  initialPosition = 0,
}: {
  streamUrl: string;
  channelName: string;
  channelId?: string;
  isLive?: boolean;
  alternativeStreams?: string[];
  initialPosition?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const progressTimer = useRef<ReturnType<typeof setInterval>>();
  const stallDebounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const networkRetryCount = useRef<number>(0);
  const hasResumedRef = useRef<boolean>(false);

  // Gera todas as variantes de stream síncronamente na renderização (evita array vazio inicial!)
  const mainVariants = buildStreamVariants(streamUrl, isLive);
  const altVariants = alternativeStreams.flatMap((u) => (u ? buildStreamVariants(u, isLive) : []));
  const allStreams = Array.from(new Set([...mainVariants, ...altVariants]));

  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);

  const activeStreamUrl = allStreams[currentStreamIndex] || streamUrl;
  const isProgressive = /\.(mp4|mkv|avi|webm)/i.test(activeStreamUrl);
  /** MPEG-TS cru (sem manifesto HLS): exige mpegts.js, ninguém mais lê isso. */
  const isRawTs = /\.ts(\?|$)/i.test(activeStreamUrl);

  // Se o site rodar em HTTPS e a fonte IPTV for HTTP, usamos o proxy de cara para evitar bloqueio de Mixed Content
  const [useProxyUrl, setUseProxyUrl] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      return activeStreamUrl.startsWith("http:");
    }
    return false;
  });

  const [state, setState] = useState<PlayerState>("loading");
  const [showDebouncedSpinner, setShowDebouncedSpinner] = useState(false);
  const [profile, setProfile] = useState<ConnectionProfile>("fair");

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const [attempt, setAttempt] = useState(1);
  const [failoverCount, setFailoverCount] = useState(0);

  /** Contador de insistências na fonte atual (ver tryNextSourceOrFail). */
  const tentativasNaFonte = useRef(0);
  const recargaTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Muda para remontar o motor na MESMA URL — é o que materializa a repetição. */
  const [recarga, setRecarga] = useState(0);

  // URL final de mídia enviada ao player
  const playableUrl = useProxyUrl
    ? `/api/iptv/stream?url=${encodeURIComponent(activeStreamUrl)}`
    : activeStreamUrl;

  // Detect Connection Speed
  useEffect(() => {
    setProfile(detectConnectionProfile());
  }, []);

  // Controls Hiding Timer
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (state === "playing") {
        setShowControls(false);
      }
    }, 4000);
  }, [state]);

  // Failover para próxima fonte (Proxy <-> Direto <-> Variantes .m3u8/.ts <-> Lista Secundária)
  const tryNextSourceOrFail = useCallback(() => {
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
      recargaTimer.current = setTimeout(() => setRecarga((n) => n + 1), 1200);
      return;
    }

    tentativasNaFonte.current = 0;

    // Se está na URL direta e falhou, tenta o proxy
    if (!useProxyUrl && activeStreamUrl.startsWith("http:")) {
      setUseProxyUrl(true);
      setState("loading");
      return;
    }

    // Se o proxy também falhar, vai para a próxima variante de stream
    if (currentStreamIndex < allStreams.length - 1) {
      setCurrentStreamIndex((prev) => prev + 1);
      setUseProxyUrl(typeof window !== "undefined" && window.location.protocol === "https:");
      setState("loading");
    } else if (attempt < MAX_RETRIES) {
      setProfile((prev) => escalate(prev));
      setCurrentStreamIndex(0);
      setAttempt((prev) => prev + 1);
      setState("loading");
    } else {
      setState("error");
    }
    setFailoverCount((c) => c + 1);
  }, [currentStreamIndex, attempt, useProxyUrl, activeStreamUrl, allStreams.length]);

  // Trocar de fonte zera a insistência: a contagem é por fonte, não global.
  useEffect(() => {
    tentativasNaFonte.current = 0;
  }, [currentStreamIndex, useProxyUrl]);

  useEffect(() => () => {
    if (recargaTimer.current) clearTimeout(recargaTimer.current);
  }, []);

  // Initialize HLS.js or Native Video Engine
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playableUrl) return;

    let disposed = false;
    let engine: { destroy: () => void } | null = null;
    hasResumedRef.current = false;

    const start = () => {
      if (disposed) return;
      video.muted = isMuted;
      video.play().catch((err: Error) => {
        // Trata bloqueio de Autoplay do navegador sem exibir caixa vermelha de erro
        if (err.name === "NotAllowedError" || err.message?.includes("interact")) {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {
            setState("paused");
          });
        } else {
          tryNextSourceOrFail();
        }
      });
    };

    const usarNativo = () => {
      video.src = playableUrl;
      video.load();
      start();
    };

    if (isProgressive) {
      // .mp4/.mkv: o próprio navegador resolve, com Range e busca na barra.
      usarNativo();
    } else if (isRawTs) {
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

          const player = mpegts.createPlayer(
            { type: "mpegts", isLive, url: playableUrl },
            {
              enableWorker: true,
              enableStashBuffer: true,
              stashInitialSize: BUFFER_INICIAL[profile],
              liveBufferLatencyChasing: true,
              liveBufferLatencyMaxLatency: 3,
              liveBufferLatencyMinRemain: 0.5,
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

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 8,
            maxMaxBufferLength: 16,
            manifestLoadingTimeOut: 3500,
            manifestLoadingMaxRetry: 2,
            levelLoadingTimeOut: 3500,
            fragLoadingTimeOut: 5000,
            fragLoadingMaxRetry: 2,
            startLevel: -1,
            startFragPrefetch: true,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 4,
            autoStartLoad: true,
            highBufferWatchdogPeriod: 2,
          });

          hls.loadSource(playableUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            start();
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  if (networkRetryCount.current < 2) {
                    networkRetryCount.current++;
                    hls.startLoad();
                  } else {
                    tryNextSourceOrFail();
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  tryNextSourceOrFail();
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

    return () => {
      disposed = true;
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
    if (state === "playing" || state === "paused" || state === "error") return;

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
      if (stallTimer) clearTimeout(stallTimer);
      if (stallDebounceTimer.current) clearTimeout(stallDebounceTimer.current);
      setShowDebouncedSpinner(false);
    };

    const onPlaying = () => {
      clearStall();
      // Tocou: o crédito de insistência volta cheio para o próximo soluço.
      tentativasNaFonte.current = 0;
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

    const onPause = () => setState((s) => (s === "error" ? s : "paused"));

    const onWaiting = () => {
      setState((s) => (s === "error" ? s : "stalled"));

      if (!stallDebounceTimer.current) {
        stallDebounceTimer.current = setTimeout(() => {
          setShowDebouncedSpinner(true);
        }, 1500);
      }

      clearStall();
      stallTimer = setTimeout(() => tryNextSourceOrFail(), 12000);
    };

    const onError = () => {
      clearStall();
      tryNextSourceOrFail();
    };

    const onTime = () => {
      setCurrentTime(video.currentTime);
      if (Number.isFinite(video.duration)) setDuration(video.duration);
    };

    const onVolume = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onWaiting);
    video.addEventListener("error", onError);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("volumechange", onVolume);

    return () => {
      clearStall();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onWaiting);
      video.removeEventListener("error", onError);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("volumechange", onVolume);
    };
  }, [tryNextSourceOrFail, initialPosition]);

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
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  // Mute Toggle
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  // Seek relative
  const seekRelative = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
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

  // Manual Retry
  const handleManualRetry = () => {
    setAttempt(1);
    setUseProxyUrl(typeof window !== "undefined" && window.location.protocol === "https:");
    setCurrentStreamIndex(0);
    setState("loading");
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={togglePlay}
      className={cn(
        "group relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black select-none",
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen rounded-none" : "rounded-2xl shadow-2xl",
      )}
    >
      <video ref={videoRef} className="h-full w-full object-contain" playsInline />

      {/* Loading & Stall Spinners */}
      {(state === "loading" || (state === "stalled" && showDebouncedSpinner)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary drop-shadow-[0_0_15px_rgba(108,29,255,0.8)]" />
          <p className="mt-3 text-xs font-semibold text-white/80">
            {state === "loading" ? "Conectando transmissão..." : "Estabilizando sinal..."}
          </p>
        </div>
      )}

      {/* Error Fallback Screen */}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center z-30">
          <div className="rounded-full bg-rose-500/10 p-4 border border-rose-500/20 mb-4">
            <RefreshCw className="h-8 w-8 text-rose-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Sinal indisponível no momento</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Não foi possível estabilizar a transmissão. Tente reconectar manualmente.
          </p>
          <button
            type="button"
            onClick={handleManualRetry}
            className="mt-5 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </button>
        </div>
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
            <span className="text-sm md:text-base font-extrabold drop-shadow-md truncate max-w-[280px] md:max-w-[500px]">
              {channelName}
            </span>
            {isLive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-rose-600/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_10px_rgba(225,29,72,0.6)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                AO VIVO
              </span>
            ) : (
              <span className="rounded-full bg-primary/20 border border-primary/40 px-2.5 py-0.5 text-[10px] font-bold text-primary-light">
                VOD HD
              </span>
            )}
          </div>
        </div>

        {/* Center Big Play Button when Paused */}
        {state === "paused" && (
          <button
            type="button"
            onClick={togglePlay}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-white shadow-[0_0_30px_rgba(108,29,255,0.8)] backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
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
                className="h-1.5 flex-1 cursor-pointer accent-primary rounded-lg bg-white/20"
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
                className="hover:text-primary transition-colors"
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
                    className="hover:text-primary transition-colors"
                    title="Voltar 10s"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => seekRelative(10)}
                    className="hover:text-primary transition-colors"
                    title="Avançar 10s"
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
                  className="hover:text-primary transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
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
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = v === 0;
                    }
                  }}
                  className="h-1 w-16 md:w-20 cursor-pointer accent-primary rounded-lg bg-white/20 hidden sm:block"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="hover:text-primary transition-colors"
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
