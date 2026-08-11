import Image from "next/image";
import Link from "next/link";
import { Info, Play } from "lucide-react";

import { AgeBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDuration } from "@/lib/utils";
import type { AgeRating, ContentType } from "@prisma/client";

type HeroData = {
  slug: string;
  name: string;
  synopsis: string;
  type: ContentType;
  backdropUrl: string | null;
  logoUrl: string | null;
  ageRating: AgeRating;
  releaseYear: number | null;
  durationSeconds: number | null;
  genres: { name: string; slug: string }[];
};

export function HeroBanner({ title }: { title: HeroData }) {
  return (
    <section className="relative h-[70vh] min-h-[26rem] w-full">
      {title.backdropUrl && (
        <Image
          src={title.backdropUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}

      {/*
        Dois gradientes, não um. O lateral garante contraste do texto sobre
        qualquer arte; o inferior funde a imagem na primeira trilha, evitando
        a linha de corte que denuncia "imagem colada aqui".
      */}
      <div aria-hidden className="absolute inset-0 hero-scrim" />

      <div className="absolute inset-x-0 bottom-0 px-5 pb-10 sm:px-10 sm:pb-14">
        <div className="max-w-xl">
          {title.logoUrl ? (
            // Logo do título, quando existe, é sempre melhor que texto:
            // é a tipografia oficial da obra
            <Image
              src={title.logoUrl}
              alt={title.name}
              width={420}
              height={160}
              className="mb-4 h-auto w-auto max-w-[min(80vw,26rem)] object-contain"
              priority
            />
          ) : (
            <h1 className="font-display text-display-sm uppercase leading-[0.9] tracking-tightest text-foreground">
              {title.name}
            </h1>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
            <AgeBadge rating={title.ageRating} />
            {title.releaseYear && <span>{title.releaseYear}</span>}
            {title.durationSeconds && (
              <span>{formatDuration(title.durationSeconds)}</span>
            )}
            {title.type === "SERIES" && <span>Série</span>}
            {title.genres.slice(0, 2).map((genre) => (
              <span key={genre.slug} className="text-muted-foreground">
                {genre.name}
              </span>
            ))}
          </div>

          <p className="mt-4 line-clamp-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
            {title.synopsis}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/assistir/${title.slug}`}
              className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
            >
              <Play className="h-4 w-4 fill-current" aria-hidden />
              Assistir
            </Link>
            <Link
              href={`/titulo/${title.slug}`}
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              <Info className="h-4 w-4" aria-hidden />
              Mais informações
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
