"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Folder = "posters" | "backdrops" | "logos" | "thumbnails";

export function ImageUpload({
  name,
  label,
  folder,
  defaultValue,
  aspect = "2/3",
  hint,
}: {
  name: string;
  label: string;
  folder: Folder;
  defaultValue?: string | null;
  aspect?: "2/3" | "16/9";
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);

      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Falha no envio.");
      setUrl(data.url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Falha no envio.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-[13px] font-medium text-muted">{label}</span>

      {/* O valor enviado no submit é sempre a URL, venha de upload ou colada */}
      <input type="hidden" name={name} value={url} />

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "relative shrink-0 overflow-hidden rounded-md border border-dashed border-border-strong bg-surface transition-colors hover:border-primary",
            aspect === "2/3" ? "h-36 w-24" : "h-24 w-[10.66rem]",
          )}
        >
          {url ? (
            <Image
              src={url}
              alt=""
              fill
              sizes="170px"
              className="object-cover"
              // Arte externa pode não estar nos remotePatterns; sem otimizar,
              // o preview do admin nunca quebra por domínio não configurado
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              )}
            </span>
          )}
        </button>

        <div className="flex-1 space-y-2">
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Ou cole a URL da imagem"
            className="h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />

          {url && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-danger"
            >
              <X className="h-3 w-3" aria-hidden />
              Remover
            </button>
          )}

          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          // Permite reenviar o mesmo arquivo depois de remover
          event.target.value = "";
        }}
      />
    </div>
  );
}
