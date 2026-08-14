"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Sparkles, Star, Tv, Zap } from "lucide-react";
import { LogoHMark } from "@/components/shared/logo";

const SHOWCASE_SLIDES = [
  {
    id: "dune-2",
    title: "Duna: Parte 2",
    category: "Em Alta no Cinema",
    year: "2024",
    rating: "8.8",
    overview: "Paul Atreides se une a Chani e aos Fremen em uma jornada épica de sobrevivência, amor e vingança no planeta Arrakis.",
    backdrop: "https://image.tmdb.org/t/p/w1280/xOM08GoAFMu4TKTKPGCxVw7WrV2.jpg",
    poster: "https://image.tmdb.org/t/p/w500/1pdfLPoLSt8CGGlA2Spt1v73J8x.jpg",
    fallbackBackdrop: "https://image.tmdb.org/t/p/w1280/xOM08GoAFMu4TKTKPGCxVw7WrV2.jpg",
    fallbackPoster: "https://image.tmdb.org/t/p/w500/1pdfLPoLSt8CGGlA2Spt1v73J8x.jpg",
  },
  {
    id: "house-of-dragon",
    title: "A Casa do Dragão",
    category: "Série Mais Assistida",
    year: "2024",
    rating: "8.6",
    overview: "A sangrenta guerra civil pela sucessão do Trono de Ferro entre as facções Targaryen ameaça incinerar Westeros.",
    backdrop: "https://image.tmdb.org/t/p/w1280/etj8E2o0uKuV2P8tUjywE1w5yrm.jpg",
    poster: "https://image.tmdb.org/t/p/w500/75vL3d262Sgq99wM0n5x28q5Nqf.jpg",
    fallbackBackdrop: "https://image.tmdb.org/t/p/w1280/etj8E2o0uKuV2P8tUjywE1w5yrm.jpg",
    fallbackPoster: "https://image.tmdb.org/t/p/w500/75vL3d262Sgq99wM0n5x28q5Nqf.jpg",
  },
  {
    id: "deadpool-wolverine",
    title: "Deadpool & Wolverine",
    category: "Novo Lançamento",
    year: "2024",
    rating: "8.5",
    overview: "Wolverine se recupera de seus ferimentos quando cruza caminhos com o falastrão Deadpool para derrotar um inimigo comum.",
    backdrop: "https://image.tmdb.org/t/p/w1280/yDHYTfA3R0jFYba16jBB1u8jZl5.jpg",
    poster: "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
    fallbackBackdrop: "https://image.tmdb.org/t/p/w1280/yDHYTfA3R0jFYba16jBB1u8jZl5.jpg",
    fallbackPoster: "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
  },
  {
    id: "gladiator-2",
    title: "Gladiador II",
    category: "Sucesso Absoluto",
    year: "2024",
    rating: "8.4",
    overview: "Anos após testemunhar a morte de Maximus, Lucius é forçado a entrar no Coliseu para salvar o futuro de Roma.",
    backdrop: "https://image.tmdb.org/t/p/w1280/k22Layers2x6g39eW5y.jpg",
    poster: "https://image.tmdb.org/t/p/w500/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg",
    fallbackBackdrop: "https://image.tmdb.org/t/p/w1280/xOM08GoAFMu4TKTKPGCxVw7WrV2.jpg",
    fallbackPoster: "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Alternância automática de 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % SHOWCASE_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const activeSlide = SHOWCASE_SLIDES[currentSlideIndex];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-foreground antialiased selection:bg-primary selection:text-white">
      {/* Luzes ambiente Mesh Neon */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full bg-gradient-to-br from-primary/30 via-primary-hover/20 to-transparent opacity-60 blur-[140px] animate-pulse"
        style={{ animationDuration: "8s" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[700px] w-[700px] rounded-full bg-gradient-to-tl from-indigo-600/25 via-purple-600/15 to-transparent opacity-50 blur-[150px]"
      />

      <div className="relative z-10 flex min-h-screen w-full flex-col lg:flex-row">
        {/* ========================================================== */}
        {/* LADO ESQUERDO: SHOWCASE CINEMATOGRÁFICO DE FILMES (60%)    */}
        {/* ========================================================== */}
        <div className="hidden lg:flex lg:w-7/12 flex-col justify-between p-12 lg:p-16 relative overflow-hidden border-r border-white/10 bg-black">
          {/* Imagens de Fundo com Fade Suave */}
          {SHOWCASE_SLIDES.map((slide, idx) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentSlideIndex ? "opacity-100 scale-105" : "opacity-0 scale-100"
              } transition-transform duration-[10000ms]`}
            >
              <img
                src={slide.backdrop}
                alt={slide.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = slide.fallbackBackdrop;
                }}
                className="h-full w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black" />
            </div>
          ))}

          {/* Logo HUBFLIX */}
          <div className="relative z-20 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 group transition-transform duration-300 hover:scale-105">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary via-primary-hover to-primary-active p-0.5 shadow-[0_0_30px_rgba(124,42,158,0.7)]">
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-black">
                  <LogoHMark className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-white">
                  HUB<span className="text-accent drop-shadow-[0_0_12px_rgba(124,42,158,0.9)]">FLIX</span>
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-accent/90">
                  STREAMING PREMIUM
                </span>
              </div>
            </Link>
          </div>

          {/* Destaque do Filme Atual */}
          <div className="relative z-20 my-auto max-w-xl py-8 space-y-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/20 px-3.5 py-1 text-xs font-bold text-accent backdrop-blur-md shadow-[0_0_15px_rgba(124,42,158,0.3)]">
                <Sparkles className="h-3.5 w-3.5" />
                {activeSlide.category}
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 backdrop-blur-md">
                <Star className="h-3 w-3 fill-amber-400" />
                {activeSlide.rating}
              </span>
              <span className="text-xs font-medium text-white/70">
                {activeSlide.year}
              </span>
            </div>

            <div className="flex items-start gap-6">
              {/* Pôster Oficial */}
              <div className="hidden sm:block shrink-0 h-36 w-24 rounded-2xl overflow-hidden border border-white/20 shadow-2xl transition-all duration-500 hover:scale-105 bg-black/40">
                <img
                  src={activeSlide.poster}
                  alt={activeSlide.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = activeSlide.fallbackPoster;
                  }}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl xl:text-4xl font-black tracking-tight text-white leading-tight drop-shadow-md">
                  {activeSlide.title}
                </h2>
                <p className="text-sm text-white/80 leading-relaxed line-clamp-3">
                  {activeSlide.overview}
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
                <Tv className="h-4 w-4 text-accent shrink-0" />
                <div className="text-[11px]">
                  <span className="block font-bold text-white">+10.000</span>
                  <span className="text-white/60">Títulos em 4K</span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
                <Zap className="h-4 w-4 text-violet-400 shrink-0" />
                <div className="text-[11px]">
                  <span className="block font-bold text-white">Ultra HD</span>
                  <span className="text-white/60">Zero Trava</span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
                <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="text-[11px]">
                  <span className="block font-bold text-white">Multi-Telas</span>
                  <span className="text-white/60">Simultâneas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Indicadores de Slide */}
          <div className="relative z-20 flex items-center justify-between border-t border-white/10 pt-6">
            <div className="flex items-center gap-2">
              {SHOWCASE_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlideIndex
                      ? "w-8 bg-primary shadow-[0_0_10px_rgba(124,42,158,0.8)]"
                      : "w-2 bg-white/30 hover:bg-white/60"
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
            <span className="text-xs text-white/50">HUBFLIX 2026</span>
          </div>
        </div>

        {/* ========================================================== */}
        {/* LADO DIREITO: CARD DE LOGIN (40%)                          */}
        {/* ========================================================== */}
        <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 lg:p-16 relative">
          <div className="w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-500">
            {/* Logo Mobile */}
            <div className="mb-8 text-center lg:hidden">
              <Link href="/" className="inline-flex items-center gap-3">
                <LogoHMark className="h-9 w-9 text-accent drop-shadow-[0_0_20px_rgba(124,42,158,0.8)]" />
                <span className="text-2xl font-black text-white">
                  HUB<span className="text-accent">FLIX</span>
                </span>
              </Link>
            </div>

            {/* Container Glassmorphic */}
            <div className="group relative rounded-3xl p-[1px] bg-gradient-to-b from-white/20 via-primary/30 to-white/5 shadow-[0_0_50px_rgba(124,42,158,0.25)]">
              <div className="relative rounded-[23px] bg-black/80 p-7 sm:p-9 backdrop-blur-2xl">
                <div className="pointer-events-none absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_rgba(124,42,158,1)]" />

                <div className="mb-7 text-center">
                  <h1 className="text-2xl font-extrabold tracking-tight text-white">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {subtitle}
                    </p>
                  )}
                </div>

                {children}
              </div>
            </div>

            {footer && (
              <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
