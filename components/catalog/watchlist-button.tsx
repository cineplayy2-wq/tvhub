"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";

import { toggleWatchlistAction } from "@/app/actions/watchlist";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        const next = !inList;
        setInList(next);
        startTransition(async () => {
          const result = await toggleWatchlistAction(titleId);
          if (result?.inList !== undefined) setInList(result.inList);
        });
      }}
      aria-pressed={inList}
    >
      <Heart
        className={cn("h-4 w-4", inList && "fill-rose-500 text-rose-500")}
        strokeWidth={1.75}
        aria-hidden
      />
      {inList ? "Favorito" : "Favoritos"}
    </Button>
  );
}
