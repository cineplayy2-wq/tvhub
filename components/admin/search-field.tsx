"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

export function SearchField({
  placeholder = "Buscar...",
  basePath,
}: {
  placeholder?: string;
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Não navega no mount: senão a página recarrega sozinha ao abrir
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Debounce: sem ele, cada tecla dispara uma query no banco
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      // Nova busca sempre volta para a primeira página
      params.delete("page");
      router.replace(`${basePath}?${params.toString()}`);
    }, 350);

    return () => clearTimeout(timeout);
  }, [value, basePath, router, searchParams]);

  return (
    <div className="relative max-w-sm flex-1">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
      />
    </div>
  );
}
