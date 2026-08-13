"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Undo2, X, Play } from "lucide-react";

import { Artwork } from "./artwork";
import { MediaKindTag } from "./media-kind-tag";
import { Rail } from "./rail";
import { GUTTER, SectionHeader } from "./section";
import {
  dismissRecommendationAction,
  restoreRecommendationAction,
} from "@/app/actions/recommendations";
import { cleanMediaTitle, cleanSeriesTitle } from "@/lib/utils";

export type RecommendationItem = {
  id: string;
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  posterUrl: string | null;
  year?: number | null;
  isSeries?: boolean;
  tmdbId?: number | null;
};

function getHref(item: RecommendationItem) {
  return item.isSeries
    ? `/tv/serie/${encodeURIComponent(cleanSeriesTitle(item.name))}`
    : `/tv/assistir/${item.id}`;
}

/**
 * Trilha de sugestões com "não me mostre mais isto".
 *
 * A lista já chega filtrada do servidor: o que foi dispensado antes nem vem
 * para o cliente. O estado local aqui existe só para o item sumir na hora do
 * clique, sem esperar a ida ao servidor — e para oferecer o desfazer, que é o
 * que torna o "x" seguro de apertar.
 *
 * Dispensar mexe nas DICAS, não no acervo: o título continua na busca e na
 * grade do gênero. O texto do desfazer diz isso, porque a diferença não é
 * óbvia para quem está clicando.
 */
export function DismissableRecommendationsRail({
  title,
  eyebrow,
  hint,
  href,
  items,
}: {
  title: string;
  eyebrow?: string;
  hint?: string;
  /** Destino do "Ver tudo", quando a trilha tem uma página inteira atrás. */
  href?: string;
  items: RecommendationItem[];
}) {
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [ultimo, setUltimo] = useState<RecommendationItem | null>(null);
  const [, iniciarTransicao] = useTransition();

  const visiveis = items.filter((item) => !ocultos.has(item.id));
  if (visiveis.length === 0 && !ultimo) return null;

  const dispensar = (item: RecommendationItem, evento: React.MouseEvent) => {
    evento.preventDefault();
    evento.stopPropagation();

    setOcultos((anterior) => new Set(anterior).add(item.id));
    setUltimo(item);

    iniciarTransicao(() => {
      void dismissRecommendationAction({
        name: item.name,
        channelId: item.id,
        tmdbId: item.tmdbId ?? null,
      }).then((resultado) => {
        // Se o servidor recusou, devolve o card: sumir da tela sem ter sumido
        // do banco é a pior das duas hipóteses.
        if (!resultado.ok) {
          setOcultos((anterior) => {
            const copia = new Set(anterior);
            copia.delete(item.id);
            return copia;
          });
          setUltimo(null);
        }
      });
    });
  };

  const desfazer = () => {
    if (!ultimo) return;
    const item = ultimo;
    setUltimo(null);
    setOcultos((anterior) => {
      const copia = new Set(anterior);
      copia.delete(item.id);
      return copia;
    });
    iniciarTransicao(() => {
      void restoreRecommendationAction(item.name);
    });
  };

  return (
    <section>
      <SectionHeader
        title={title}
        eyebrow={eyebrow}
        hint={hint}
        href={href}
        className={`${GUTTER} mb-4`}
        actions={
          ultimo ? (
            <button
              type="button"
              onClick={desfazer}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-surface-elevated px-3 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Undo2 className="h-3 w-3" />
              Desfazer
            </button>
          ) : undefined
        }
      />

      <Rail itemClassName="w-[112px] md:w-[140px]">
        {visiveis.map((item) => {
          const isSeries = Boolean(item.isSeries);
          const name = isSeries ? cleanSeriesTitle(item.name) : cleanMediaTitle(item.name);
          const art = item.posterUrl ?? item.logoUrl;
          const href = getHref(item);

          return (
            <div key={item.id} className="group relative block w-full">
              <Link href={href} prefetch className="block w-full">
                <div className="card-edge relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface transition-shadow duration-300 group-hover:shadow-card group-hover:ring-primary/50">
                  <Artwork
                    src={art}
                    alt={name}
                    seed={item.id}
                    sizes="(max-width: 768px) 112px, 140px"
                  />

                  <div className="absolute inset-0 bg-background/0 transition-colors duration-300 group-hover:bg-background/45" />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                      <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
                    </span>
                  </div>

                  {/* O "x" fica sempre alcançável no toque (celular não tem
                      hover) e discreto até o card ser apontado no mouse. */}
                  <button
                    type="button"
                    onClick={(e) => dispensar(item, e)}
                    title="Não tenho interesse — some das sugestões, continua no catálogo"
                    aria-label={`Dispensar a sugestão ${name}`}
                    className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white/70 shadow-md backdrop-blur-md transition-all hover:bg-danger hover:text-white active:scale-90 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>

                  {/* O chip "Para você" saiu: o título da seção já diz isso, e
                      num card de 112px ele encostava na etiqueta Filme/Série. */}
                  <MediaKindTag isSeries={isSeries} />
                </div>
              </Link>

              <div className="mt-2 px-0.5">
                <Link href={href} prefetch>
                  <p className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-accent">
                    {name}
                  </p>
                </Link>
                {item.year ? (
                  <p className="text-[11px] text-muted-foreground">{item.year}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </Rail>
    </section>
  );
}
