"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Info, Play, Star, Volume2, VolumeX } from "lucide-react";

import { Artwork } from "./artwork";
import { FavoriteButton } from "./favorite-button";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  id: string;
  name: string;
  href: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  overview: string;
  rating: number;
  year: number | null;
  /** Contexto do destaque: "Em alta no Brasil", "Estreia", "Do seu estado". */
  label: string;
  meta?: string;
  isFavorite?: boolean;
  isSeries?: boolean;
  streamUrl?: string | null;
  previewUrl?: string | null;
};

/** 30 segundos por destaque em cartaz, conforme o pedido do cliente */
const ROTATION_MS = 30000;

export function ShowcaseHero({
  slides,
  size = "full",
}: {
  slides: HeroSlide[];
  size?: "full" | "compact";
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0]));
  const videoRef = useRef<HTMLVideoElement>(null);

  const total = slides.length;

  const go = useCallback(
    (index: number) => {
      setIsVideoReady(false);
      setActive(((index % total) + total) % total);
    },
    [total],
  );

  // Garante que o carregamento do vídeo só inicie APÓS a página estar totalmente carregada
  useEffect(() => {
    if (document.readyState === "complete") {
      setPageLoaded(true);
    } else {
      const handleLoad = () => setPageLoaded(true);
      window.addEventListener("load", handleLoad);
      return () => window.removeEventListener("load", handleLoad);
    }
  }, []);

  useEffect(() => {
    setMounted((current) => {
      const next = (active + 1) % total;
      if (current.has(active) && current.has(next)) return current;
      const updated = new Set(current);
      updated.add(active);
      updated.add(next);
      return updated;
    });
  }, [active, total]);

  // Rotação de 30 segundos por filme em cartaz
  useEffect(() => {
    if (total <= 1 || paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const timer = setInterval(() => {
      setIsVideoReady(false);
      setActive((current) => (current + 1) % total);
    }, ROTATION_MS);

    return () => clearInterval(timer);
  }, [total, paused]);

  if (total === 0) return null;

  const slide = slides[Math.min(active, total - 1)];
  const videoSource = slide.previewUrl || slide.streamUrl;

  const toggleSound = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <section
      className={cn(
        "relative isolate w-full overflow-hidden bg-black",
        size === "full"
          // Full-bleed: a arte começa no topo absoluto e o cabeçalho flutua
          // por cima dela. Sem canto arredondado e sem margem — é o que faz o
          // destaque parecer a tela inteira, e não um cartão dentro dela.
          ? "h-[86vh] min-h-[560px] md:h-[80vh] md:max-h-[760px]"
          : "h-[48vh] min-h-[360px] md:h-[54vh] md:max-h-[520px] md:rounded-2xl",
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Imagem Pôster/Backdrop de fundo imediata */}
      {slides.map((item, index) =>
        mounted.has(index) ? (
          <div
            key={item.id}
            aria-hidden={index !== active}
            className={cn(
              "absolute inset-0 transition-opacity duration-[1200ms] ease-smooth",
              index === active ? "opacity-100" : "opacity-0",
            )}
          >
            <Artwork
              src={item.backdropUrl ?? item.posterUrl}
              alt={item.name}
              seed={item.id}
              role="backdrop"
              eager={index === 0}
            />
          </div>
        ) : null,
      )}

      {/* Video Preview de 30s carregado de forma fluida após o carregamento da página */}
      {pageLoaded && videoSource && (
        <div
          className={cn(
            "absolute inset-0 z-10 transition-opacity duration-1000",
            isVideoReady ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <video
            ref={videoRef}
            key={slide.id}
            src={videoSource}
            autoPlay
            muted={isMuted}
            playsInline
            onCanPlay={() => setIsVideoReady(true)}
            onEnded={() => go(active + 1)}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Degradê e Máscaras de Escurecimento */}
      <div className="scrim-hero absolute inset-0 z-15" />
      <div className="film-grain absolute inset-0 z-15" />

      {/* Conteúdo Informações do Filme/Série */}
      <div
        className={cn(
          "relative z-20 flex h-full flex-col justify-end",
          size === "full"
            ? "px-5 pb-12 md:px-8 md:pb-14 lg:px-12"
            : "px-5 pb-8 md:px-10 md:pb-10",
        )}
      >
        <div
          key={slide.id}
          className="max-w-2xl animate-fade-in text-center md:text-left"
        >
          <p className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent md:justify-start">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {slide.label}
          </p>

          <h1
            className={cn(
              "text-balance font-bold leading-[1.05] tracking-tightest text-foreground drop-shadow-md",
              size === "full"
                ? "text-3xl md:text-5xl lg:text-6xl"
                : "text-2xl md:text-4xl",
            )}
          >
            {slide.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-muted md:justify-start">
            {slide.rating > 0 && (
              <span className="flex items-center gap-1 font-semibold text-accent">
                <Star className="h-3.5 w-3.5 fill-current" />
                {slide.rating.toFixed(1)}
              </span>
            )}
            {slide.year && <span className="tabular-nums">{slide.year}</span>}
            {slide.isSeries && <span>Série</span>}
            {slide.meta && <span className="truncate">{slide.meta}</span>}
          </div>

          {slide.overview && (
            <p className="mx-auto mt-4 line-clamp-2 max-w-xl text-sm leading-relaxed text-muted md:mx-0 md:line-clamp-3">
              {slide.overview}
            </p>
          )}

          <div className="mt-7 flex items-center justify-center gap-3 md:justify-start">
            <Link
              href={slide.href}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover active:bg-primary-active hover:scale-[1.02] shadow-lg shadow-primary/25"
            >
              <Play className="h-4 w-4" fill="currentColor" />
              {slide.isSeries ? "Ver temporadas" : "Assistir Agora"}
            </Link>

            {slide.isSeries && (
              <Link
                href={`/tv/assistir/${slide.id}`}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface/80 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-elevated"
              >
                <Info className="h-4 w-4" />
                Episódio 1
              </Link>
            )}

            {slide.isFavorite != null && (
              <FavoriteButton
                channelId={slide.id}
                isFavorite={slide.isFavorite}
                className="rounded-full border border-white/10 bg-surface/80 p-3"
              />
            )}

            {/* Controle de Áudio da Prévia em Cartaz */}
            {isVideoReady && (
              <button
                type="button"
                onClick={toggleSound}
                aria-label={isMuted ? "Ativar áudio do preview" : "Silenciar áudio do preview"}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:scale-105"
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
              </button>
            )}
          </div>
        </div>

        {/* Indicadores dos Filmes em Cartaz (troca a cada 30 segundos) */}
        {total > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2 md:justify-start">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(index)}
                aria-label={`Filme em cartaz ${index + 1}: ${item.name}`}
                aria-current={index === active}
                className={cn(
                  "h-1 rounded-full transition-all duration-500",
                  index === active
                    ? "w-10 bg-primary"
                    : "w-4 bg-white/25 hover:bg-white/50",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
