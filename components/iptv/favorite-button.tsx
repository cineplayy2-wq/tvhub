"use client";

import { Heart } from "lucide-react";
import { useTransition } from "react";

import { toggleChannelFavoriteAction } from "@/app/actions/iptv";
import { cn } from "@/lib/utils";

/**
 * Botão de favoritar.
 *
 * Sem Framer Motion de propósito. Este botão aparece em TODO card da área
 * logada, então importar a biblioteca aqui puxava ~38 KB de JavaScript para
 * praticamente todas as rotas de /tv — para animar um "encolher no clique"
 * que o CSS faz de graça, e que em aparelho fraco fica mais fluido porque
 * roda no compositor em vez de no thread principal.
 */
export function FavoriteButton({
  channelId,
  isFavorite,
  className,
}: {
  channelId: string;
  isFavorite: boolean;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        startTransition(async () => {
          await toggleChannelFavoriteAction(channelId);
        });
      }}
      className={cn(
        "group/fav rounded-full p-1.5 transition-transform duration-150 active:scale-90",
        isFavorite
          ? "text-rose-500 hover:text-rose-400"
          : "text-muted-foreground hover:text-foreground",
        isPending && "opacity-50",
        className,
      )}
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={isFavorite}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-transform",
          isFavorite && "fill-current",
          !isFavorite && "group-hover/fav:scale-110",
        )}
        strokeWidth={1.75}
      />
    </button>
  );
}
