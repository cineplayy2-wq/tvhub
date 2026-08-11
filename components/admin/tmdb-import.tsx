"use client";

import Image from "next/image";
import { useState } from "react";
import { Download, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Modal } from "@/components/ui/modal";

type Result = {
  tmdbId: number;
  name: string;
  originalName: string;
  releaseYear: number | null;
  posterUrl: string | null;
  rating: number;
  mediaType: "movie" | "tv";
};

export type TmdbImportPayload = {
  tmdbId: number;
  name: string;
  originalName: string | null;
  slug: string;
  synopsis: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  durationSeconds: number | null;
  director: string | null;
  cast: string[];
  country: string | null;
  tmdbRating: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  ageRating: string;
  tmdbGenres: string[];
};

/**
 * Importa metadados do TMDB para o formulário de título.
 *
 * Preenche apenas os campos editoriais — sinopse, elenco, arte, ano. Nada
 * relacionado a vídeo é tocado: o ID do provedor e a URL HLS continuam sendo
 * responsabilidade de quem tem a licença do conteúdo.
 */
export function TmdbImport({
  onImport,
}: {
  onImport: (data: TmdbImportPayload) => void;
}) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [isSearching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setError(null);
    setSearching(true);

    try {
      const response = await fetch(
        `/api/admin/tmdb?q=${encodeURIComponent(query)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha na busca.");
      setResults(data.results);
      if (data.results.length === 0) setError("Nenhum resultado encontrado.");
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Falha na busca.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleImport(result: Result) {
    setError(null);
    setImportingId(result.tmdbId);

    try {
      const response = await fetch(
        `/api/admin/tmdb?id=${result.tmdbId}&type=${result.mediaType}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao importar.");
      onImport(data as TmdbImportPayload);
      setOpen(false);
      setResults([]);
      setQuery("");
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Falha ao importar.",
      );
    } finally {
      setImportingId(null);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" aria-hidden />
        Importar do TMDB
      </Button>

      <Modal
        open={isOpen}
        onClose={() => setOpen(false)}
        title="Importar metadados do TMDB"
        description="Preenche sinopse, elenco, ano e arte. Os campos de vídeo não são alterados."
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <FormError message={error ?? undefined} />

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  // Enter dentro de um modal que vive num <form> submeteria o
                  // formulário de título inteiro — precisa ser interceptado
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSearch();
                  }
                }}
                placeholder="Nome do filme ou série"
                aria-label="Buscar no TMDB"
                className="h-12 w-full rounded-md border border-border bg-surface pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
                autoFocus
              />
            </div>
            <Button
              type="button"
              onClick={handleSearch}
              isLoading={isSearching}
              size="md"
            >
              Buscar
            </Button>
          </div>

          {results.length > 0 && (
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {results.map((result) => (
                <li key={`${result.mediaType}-${result.tmdbId}`}>
                  <button
                    type="button"
                    onClick={() => handleImport(result)}
                    disabled={importingId !== null}
                    className="flex w-full items-center gap-4 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/60 hover:bg-surface-hover disabled:opacity-50"
                  >
                    <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded border border-border bg-surface">
                      {result.posterUrl && (
                        <Image
                          src={result.posterUrl}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {result.name}
                      </span>
                      {result.originalName !== result.name && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {result.originalName}
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {result.mediaType === "tv" ? "Série" : "Filme"}
                        {result.releaseYear ? ` · ${result.releaseYear}` : ""}
                        {result.rating > 0
                          ? ` · nota ${result.rating.toFixed(1)}`
                          : ""}
                      </span>
                    </span>

                    {importingId === result.tmdbId && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Metadados e arte fornecidos por TMDB. Este produto usa a API do TMDB,
            mas não é endossado nem certificado por eles.
          </p>
        </div>
      </Modal>
    </>
  );
}
