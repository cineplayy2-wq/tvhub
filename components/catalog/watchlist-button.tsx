"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";

import { toggleWatchlistAction } from "@/app/actions/watchlist";
import { Button } from "@/components/ui/button";

export function WatchlistButton({
  titleId,
  initialInList,
}: {
  titleId: string;
  initialInList: boolean;
}) {
  const [inList, setInList] = useState(initialInList);
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      isLoading={isPending}
      onClick={() => {
        // Atualização otimista: esperar o round-trip para trocar o ícone faz
        // um clique instantâneo parecer travado.
        const next = !inList;
        setInList(next);
        startTransition(async () => {
          const result = await toggleWatchlistAction(titleId);
          // Servidor é a verdade: se divergir, volta ao estado real
          if (result?.inList !== undefined) setInList(result.inList);
        });
      }}
      aria-pressed={inList}
    >
      {inList ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      {inList ? "Na minha lista" : "Minha lista"}
    </Button>
  );
}
