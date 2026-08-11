"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function SearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const isFirst = useRef(true);

  useEffect(() => {
    // Não navega no mount: recarregaria a página sozinha ao abrir
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    // Debounce: sem ele, cada tecla dispara uma query no banco
    const timeout = setTimeout(() => {
      const term = value.trim();
      router.replace(term ? `/busca?q=${encodeURIComponent(term)}` : "/busca");
    }, 350);

    return () => clearTimeout(timeout);
  }, [value, router]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar por título, direção ou elenco"
        aria-label="Buscar no catálogo"
        autoFocus
        className="h-14 w-full rounded-lg border border-border bg-surface pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
      />
    </div>
  );
}
