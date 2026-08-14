"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";

import { saveProgressAction } from "@/app/actions/playback";
import { PLAYER } from "@/lib/constants";
import { cn, formatTimecode } from "@/lib/utils";

type Props = {
  src: string;
  titleName: string;
  titleId: string;
  episodeId?: string | null;
  episodeLabel?: string | null;
  startAtSeconds: number;
};

export function VideoPlayer({
  src,
  titleName,
  titleId,
  episodeId,
  episodeLabel,
  startAtSeconds,
}: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(0);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(startAtSeconds);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [autoMutedHint, setAutoMutedHint] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Fonte: HLS quando necessário, nativo quando possível ----------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playableSrc =
      src.startsWith("http:") || (src.startsWith("https:") && !src.includes(location?.host ?? ""))
        ? `/api/iptv/stream?url=${encodeURIComponent(src)}`
        : src;

    const isHls = /\.m3u8($|\?)/i.test(src);

    if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playableSrc;
      return;
    }

    let destroyed = false;
    let instance: { destroy: () => void } | null = null;

    import("hls.js").then(({ default: Hls }) => {
      if (destroyed || !Hls.isSupported()) {
        if (!destroyed) setError("Seu navegador não suporta este formato.");
        return;
      }
      const hls = new Hls({
        enableWorker: true,
        manifestLoadingTimeOut: 4000,
        levelLoadingTimeOut: 4000,
        fragLoadingTimeOut: 6000,
        startFragPrefetch: true,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
      });
      hls.loadSource(playableSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) setError("Falha ao carregar o vídeo.");
      });
      instance = hls;
    });

    return () => {
      destroyed = true;
      instance?.destroy();
    };
  }, [src]);

  // ---------- Persistência do progresso ----------
  const persist = useCallback(
    (position: number, total: number, force = false) => {
      if (total <= 0) return;
      if (position < PLAYER.MIN_PROGRESS_SECONDS && !force) return;
      // Throttle: sem isto seriam ~4 gravações por segundo durante o filme
      if (!force && Math.abs(position - lastSaved.current) < 10) return;

      lastSaved.current = position;
      void saveProgressAction({
        titleId,
        episodeId: episodeId ?? null,
        positionSeconds: Math.floor(position),
        durationSeconds: Math.floor(total),
      });
    },
    [titleId, episodeId],
  );

  // Salva ao sair da aba: fechar o navegador não dispara os eventos normais
  useEffect(() => {
    const onHide = () => {
      const video = videoRef.current;
      if (video && video.currentTime > 0) {
        persist(video.currentTime, video.duration, true);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [persist]);

  // ---------- Auto-hide dos controles ----------
  const nudgeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // Só esconde com o vídeo rodando: pausado, some parecer travamento
    if (videoRef.current && !videoRef.current.paused) {
      hideTimer.current = setTimeout(
        () => setControlsVisible(false),
        PLAYER.CONTROLS_HIDE_MS,
      );
    }
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // ---------- Atalhos de teclado ----------
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => {
        if (video.muted) setAutoMutedHint(true);
      }).catch((err: Error) => {
        if (err.name === "NotAllowedError" || err.message?.includes("interact")) {
          video.muted = true;
          setMuted(true);
          setAutoMutedHint(true);
          void video.play().catch(() => {});
        }
      });
    } else {
      video.pause();
    }
    nudgeControls();
  }, [nudgeControls]);

  // Autoplay com fallback de mudo (política do Chrome/Safari)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    if (!video.paused) return;

    void video.play().catch((err: Error) => {
      if (err.name === "NotAllowedError" || err.message?.includes("interact")) {
        video.muted = true;
        setMuted(true);
        setAutoMutedHint(true);
        void video.play().catch(() => {});
      }
    });
  }, [ready, src]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(
        0,
        Math.min(video.duration || 0, video.currentTime + delta),
      );
      nudgeControls();
    },
    [nudgeControls],
  );

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await shellRef.current?.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Não sequestra o teclado enquanto o usuário digita em algum campo
      const target = event.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;

      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          seekBy(PLAYER.SEEK_STEP_SECONDS);
          break;
        case "ArrowLeft":
          seekBy(-PLAYER.SEEK_STEP_SECONDS);
          break;
        case "f":
          void toggleFullscreen();
          break;
        case "m":
          setMuted((m) => !m);
          break;
        case "Escape":
          if (!document.fullscreenElement) router.back();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFullscreen, router]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = muted;
    }
  }, [volume, muted]);

  const percent = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={shellRef}
      onMouseMove={nudgeControls}
      onTouchStart={nudgeControls}
      className={cn(
        "relative h-screen w-full select-none bg-black",
        !controlsVisible && "cursor-none",
      )}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        autoPlay
        onClick={togglePlay}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setDuration(video.duration);
          // Retoma de onde parou, mas não a 2s do fim
          if (startAtSeconds > 0 && startAtSeconds < video.duration - 10) {
            video.currentTime = startAtSeconds;
          }
          setReady(true);
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setCurrent(video.currentTime);
          persist(video.currentTime, video.duration);
        }}
        onPlay={() => {
          setPlaying(true);
          nudgeControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onEnded={(event) => {
          const video = event.currentTarget;
          persist(video.duration, video.duration, true);
        }}
        onError={() => setError("Não foi possível reproduzir este vídeo.")}
      />

      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      )}

      {ready && !playing && !error && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Reproduzir"
          className="absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary/90 text-white shadow-lg"
        >
          <Play className="ml-1 h-8 w-8" fill="currentColor" />
        </button>
      )}

      {autoMutedHint && playing && (
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (video) {
              video.muted = false;
              setMuted(false);
              setAutoMutedHint(false);
            }
          }}
          className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-white"
        >
          Som desligado — toque para ativar
        </button>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90 px-6 text-center">
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={() => router.back()}
            className="text-sm text-muted underline"
          >
            Voltar
          </button>
        </div>
      )}

      {/* ---------- Controles ---------- */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex flex-col justify-between",
          "bg-gradient-to-b from-black/70 via-transparent to-black/85",
          "transition-opacity duration-300 ease-smooth",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-4 p-5">
          <button
            onClick={() => router.back()}
            aria-label="Voltar"
            className="rounded p-2 text-foreground transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {titleName}
            </p>
            {episodeLabel && (
              <p className="text-xs text-white/60">{episodeLabel}</p>
            )}
          </div>
        </div>

        <div className="pointer-events-auto space-y-3 p-5">
          {/* Barra de progresso: input range nativo para ganhar teclado,
              leitor de tela e arraste no touch sem reimplementar nada */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(event) => {
              const value = Number(event.target.value);
              setCurrent(value);
              if (videoRef.current) videoRef.current.currentTime = value;
            }}
            aria-label="Progresso"
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-primary [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#B569D2]"
            style={{
              background: `linear-gradient(to right, #B569D2 ${percent}%, rgba(255,255,255,0.25) ${percent}%)`,
            }}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pausar" : "Reproduzir"}
              className="rounded p-2 text-foreground transition-colors hover:bg-white/10"
            >
              {playing ? (
                <Pause className="h-5 w-5 fill-current" aria-hidden />
              ) : (
                <Play className="h-5 w-5 fill-current" aria-hidden />
              )}
            </button>

            <button
              onClick={() => seekBy(-PLAYER.SEEK_STEP_SECONDS)}
              aria-label="Voltar 10 segundos"
              className="rounded p-2 text-foreground transition-colors hover:bg-white/10"
            >
              <RotateCcw className="h-5 w-5" aria-hidden />
            </button>
            <button
              onClick={() => seekBy(PLAYER.SEEK_STEP_SECONDS)}
              aria-label="Avançar 10 segundos"
              className="rounded p-2 text-foreground transition-colors hover:bg-white/10"
            >
              <RotateCw className="h-5 w-5" aria-hidden />
            </button>

            <div className="group/vol flex items-center gap-2">
              <button
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Ativar som" : "Silenciar"}
                className="rounded p-2 text-foreground transition-colors hover:bg-white/10"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" aria-hidden />
                ) : (
                  <Volume2 className="h-5 w-5" aria-hidden />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(event) => {
                  setVolume(Number(event.target.value));
                  setMuted(false);
                }}
                aria-label="Volume"
                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 accent-primary transition-all duration-300 group-hover/vol:w-20"
              />
            </div>

            <span className="ml-1 text-xs tabular-nums text-white/70">
              {formatTimecode(current)} / {formatTimecode(duration)}
            </span>

            <button
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              className="ml-auto rounded p-2 text-foreground transition-colors hover:bg-white/10"
            >
              {fullscreen ? (
                <Minimize className="h-5 w-5" aria-hidden />
              ) : (
                <Maximize className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
