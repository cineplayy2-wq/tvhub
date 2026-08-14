"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Film,
  Heart,
  Pause,
  Play,
  Share2,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from "lucide-react";

import { telaAnterior } from "./nav-history";

import { Artwork } from "./artwork";
import { cn } from "@/lib/utils";
import type { ReelItem } from "@/lib/queries/reels";

function ReelVideoPlayer({
  streamUrl,
  videoKey,
  isActive,
  muted,
  posterUrl,
  onDoubleTap,
}: {
  streamUrl: string;
  videoKey: string | null;
  isActive: boolean;
  muted: boolean;
  posterUrl: string | null;
  onDoubleTap: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showTouchFeedback, setShowTouchFeedback] = useState(false);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = muted;
    if (isActive) {
      const p = video.play();
      if (p) {
        p.then(() => setPlaying(true)).catch(() => {
          video.muted = true;
          video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        });
      }
    } else {
      video.pause();
      setPlaying(false);
    }
  }, [isActive, muted]);

  const handleContainerClick = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      onDoubleTap();
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 900);
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;

    setTimeout(() => {
      if (lastTapRef.current !== 0) {
        const video = videoRef.current;
        if (video) {
          if (video.paused) {
            video.play().then(() => setPlaying(true)).catch(() => {});
          } else {
            video.pause();
            setPlaying(false);
          }
        } else {
          setPlaying((p) => !p);
        }
        setShowTouchFeedback(true);
        setTimeout(() => setShowTouchFeedback(false), 600);
      }
    }, DOUBLE_TAP_DELAY + 20);
  };

  const proxySrc = `/api/iptv/stream?url=${encodeURIComponent(streamUrl)}`;

  return (
    <div onClick={handleContainerClick} className="absolute inset-0 z-0 cursor-pointer overflow-hidden bg-black select-none">
      <div className="absolute inset-0 z-0">
        <Artwork src={posterUrl} alt="Corte de Filme" seed={streamUrl} role="backdrop" />
      </div>

      {isActive && (
        <>
          {videoKey ? (
            <iframe
              src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=${
                muted ? 1 : 0
              }&loop=1&playlist=${videoKey}&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&iv_load_policy=3`}
              title="Corte do Filme"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              className="absolute inset-0 h-full w-full border-none object-cover opacity-95 pointer-events-none scale-125 md:scale-135"
            />
          ) : (
            <video
              ref={videoRef}
              src={proxySrc}
              autoPlay
              loop
              muted={muted}
              playsInline
              preload="auto"
              className="absolute inset-0 h-full w-full object-cover opacity-95"
            />
          )}
        </>
      )}

      {showHeartAnim && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-red-600/80 text-white shadow-[0_0_50px_rgba(239,68,68,0.8)] backdrop-blur-md animate-bounce scale-125">
            <Heart className="h-16 w-16 fill-current" />
          </div>
        </div>
      )}

      {showTouchFeedback && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md animate-ping">
            {playing ? <Play className="h-10 w-10 fill-current" /> : <Pause className="h-10 w-10 fill-current" />}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReelsFeed({
  initialItems,
  initialHasMore = true,
}: {
  initialItems: ReelItem[];
  initialHasMore?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ReelItem[]>(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMudo] = useState(true);
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [copiedToast, setCopiedToast] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeItem = items[activeIndex];

  const carregarMaisItens = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/iptv/reels/feed?page=${nextPage}&pageSize=15`);
      const data = await res.json();

      if (data.items && data.items.length > 0) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const novos = data.items.filter((i: ReelItem) => !existingIds.has(i.id));
          return [...prev, ...novos];
        });
        setPage(nextPage);
        setHasMore(Boolean(data.hasMore));
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, page]);

  useEffect(() => {
    if (activeIndex >= items.length - 4 && hasMore && !loadingMore) {
      void carregarMaisItens();
    }
  }, [activeIndex, items.length, hasMore, loadingMore, carregarMaisItens]);

  useEffect(() => {
    if (!activeItem?.id) return;
    if (likesMap[activeItem.id]) return;

    fetch(`/api/iptv/reels/like?reelId=${encodeURIComponent(activeItem.id)}`)
      .then((res) => res.json())
      .then((data) => {
        setLikesMap((prev) => ({
          ...prev,
          [activeItem.id]: { count: Number(data.count) || 0, liked: Boolean(data.liked) },
        }));
      })
      .catch(() => {});
  }, [activeItem?.id, likesMap]);

  const alternarCurtida = async (reelId: string) => {
    const atual = likesMap[reelId] || { count: 0, liked: false };
    const novoLiked = !atual.liked;
    const novoCount = novoLiked ? atual.count + 1 : Math.max(0, atual.count - 1);

    setLikesMap((prev) => ({
      ...prev,
      [reelId]: { count: novoCount, liked: novoLiked },
    }));

    try {
      const res = await fetch("/api/iptv/reels/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reelId }),
      });
      const data = await res.json();
      if (data.success) {
        setLikesMap((prev) => ({
          ...prev,
          [reelId]: { count: Number(data.count) || 0, liked: Boolean(data.liked) },
        }));
      }
    } catch {}
  };

  const compartilharCorte = async (item: ReelItem) => {
    const url = `${window.location.origin}/tv/assistir/${item.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.name,
          text: `Confira este corte de "${item.name}" no Hubflix!`,
          url,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    } catch {}
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const height = el.clientHeight;
      if (height <= 0) return;
      const index = Math.round(el.scrollTop / height);
      if (index !== activeIndex && index >= 0 && index < items.length) {
        setActiveIndex(index);
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [activeIndex, items.length]);

  const rolarPara = (idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const targetIdx = Math.max(0, Math.min(items.length - 1, idx));
    el.scrollTo({ top: targetIdx * el.clientHeight, behavior: "smooth" });
  };

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-white">
        <Film className="mb-4 h-16 w-16 text-muted" />
        <h3 className="text-xl font-bold text-foreground">Nenhum corte disponível</h3>
        <p className="mt-1 text-sm text-muted-foreground">Sua lista de filmes e séries está sendo atualizada.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black text-white select-none">
      <button
        type="button"
        onClick={() => (telaAnterior() ? router.back() : router.push("/tv"))}
        aria-label="Voltar"
        className="absolute left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/80 text-white shadow-2xl backdrop-blur-md border border-white/20 transition-transform hover:scale-110 active:scale-95"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>

      <div className="absolute left-16 top-4 z-40 flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 text-xs font-bold text-white shadow-2xl backdrop-blur-md border border-white/20">
        <Sparkles className="h-4 w-4 text-pink-400 animate-pulse" />
        <span>Dicas ({activeIndex + 1} de {items.length}{hasMore ? "+" : ""})</span>
      </div>

      <button
        type="button"
        onClick={() => setMudo((m) => !m)}
        aria-label={muted ? "Ativar som" : "Silenciar"}
        className="absolute right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/80 text-white shadow-2xl backdrop-blur-md border border-white/20 transition-transform hover:scale-110 active:scale-95"
      >
        {muted ? <VolumeX className="h-5 w-5 text-rose-400" /> : <Volume2 className="h-5 w-5 text-emerald-400" />}
      </button>

      {copiedToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-2xl animate-fade-in">
          Link copiado para a área de transferência!
        </div>
      )}

      <div
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto scrollbar-none bg-black"
      >
        {items.map((item, idx) => {
          const isActive = idx === activeIndex;
          const likeState = likesMap[item.id] || { count: 0, liked: false };

          return (
            <div
              key={`${item.id}-${idx}`}
              className="relative flex h-full w-full snap-start flex-col justify-end overflow-hidden p-6 md:p-12"
            >
              <ReelVideoPlayer
                streamUrl={item.streamUrl}
                videoKey={item.videoKey}
                isActive={isActive}
                muted={muted}
                posterUrl={item.backdropUrl ?? item.posterUrl}
                onDoubleTap={() => alternarCurtida(item.id)}
              />

              <div className="scrim-hero absolute inset-0 z-10 pointer-events-none" />
              <div className="film-grain absolute inset-0 z-10 pointer-events-none" />

              <div className="absolute right-4 bottom-24 z-30 flex flex-col items-center gap-5">
                <button
                  type="button"
                  onClick={() => alternarCurtida(item.id)}
                  aria-label="Curtir este corte"
                  className="flex flex-col items-center gap-1 group"
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full shadow-2xl backdrop-blur-md border transition-all active:scale-75",
                      likeState.liked
                        ? "bg-red-500/30 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                        : "bg-slate-950/75 border-white/20 text-white group-hover:border-red-400 group-hover:text-red-400",
                    )}
                  >
                    <Heart
                      className={cn("h-6 w-6 transition-transform", likeState.liked && "fill-current scale-115")}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-white drop-shadow tabular-nums">
                    {likeState.count}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => compartilharCorte(item)}
                  aria-label="Compartilhar corte"
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/75 border border-white/20 text-white shadow-2xl backdrop-blur-md transition-all group-hover:border-white group-hover:scale-105 active:scale-90">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold text-white drop-shadow">
                    Compartilhar
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => rolarPara(activeIndex - 1)}
                  disabled={activeIndex === 0}
                  aria-label="Corte anterior"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md border border-white/20 hover:bg-black/90 disabled:opacity-20"
                >
                  <ChevronUp className="h-5 w-5" />
                </button>

                <Link
                  href={`/tv/assistir/${item.id}`}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-primary-active text-white shadow-2xl transition-transform hover:scale-115 active:scale-95 ring-4 ring-pink-500/30"
                  title="Assistir agora"
                >
                  <Play className="ml-0.5 h-7 w-7" fill="currentColor" />
                </Link>

                <button
                  type="button"
                  onClick={() => rolarPara(activeIndex + 1)}
                  disabled={activeIndex === items.length - 1 && !hasMore}
                  aria-label="Próximo corte"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md border border-white/20 hover:bg-black/90 disabled:opacity-20"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>

              <div className="relative z-30 max-w-md pr-16 pb-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md">
                    Corte #{idx + 1}
                  </span>
                  {item.isSeries && (
                    <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/10">
                      Série
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-black leading-tight text-white drop-shadow-lg md:text-4xl">
                  {item.name}
                </h2>

                <div className="mt-2.5 flex items-center gap-3 text-xs font-bold text-white/90">
                  {item.rating > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="h-4 w-4 fill-current" />
                      {item.rating.toFixed(1)}
                    </span>
                  )}
                  {item.year && <span className="tabular-nums">{item.year}</span>}
                  {item.groupName && <span className="text-white/70 truncate">{item.groupName}</span>}
                </div>

                {item.overview && (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/85 drop-shadow">
                    {item.overview}
                  </p>
                )}

                <div className="mt-6">
                  <Link
                    href={`/tv/assistir/${item.id}`}
                    className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-primary-active px-7 py-3.5 text-sm font-extrabold text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
                  >
                    <Play className="h-5 w-5" fill="currentColor" />
                    Assistir {item.isSeries ? "Série Completa" : "Filme Completo"}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
