import Image from "next/image";
import Link from "next/link";

import { Pagination } from "@/components/admin/pagination";
import { SearchField } from "@/components/admin/search-field";
import { ContentStatusPill, VideoStatusPill } from "@/components/admin/status-pill";
import { AgeBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listTitles } from "@/lib/queries/admin";
import { cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "PUBLISHED", label: "Publicados" },
  { value: "DRAFT", label: "Rascunhos" },
  { value: "ARCHIVED", label: "Arquivados" },
];

export default async function ContentPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { items, total, totalPages } = await listTitles({
    query: searchParams.q,
    status: searchParams.status,
    page,
  });

  return (
    <div className="px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-display text-foreground">
            Conteúdo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Filmes e séries do catálogo.
          </p>
        </div>

        <Link
          href="/admin/conteudo/novo"
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          Novo título
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchField placeholder="Buscar título" basePath="/admin/conteudo" />

        <div className="flex gap-1.5">
          {FILTERS.map((filter) => {
            const isActive = (searchParams.status ?? "") === filter.value;
            const params = new URLSearchParams();
            if (searchParams.q) params.set("q", searchParams.q);
            if (filter.value) params.set("status", filter.value);

            return (
              <Link
                key={filter.label}
                href={`/admin/conteudo?${params.toString()}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:border-border-strong",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface/40 px-6 py-16 text-center text-sm text-muted-foreground">
          Nenhum título encontrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/60 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Título</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Vídeo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((title) => (
                <tr key={title.id} className="transition-colors hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/conteudo/${title.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded border border-border bg-surface">
                        {title.posterUrl && (
                          <Image
                            src={title.posterUrl}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized
                          />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {title.name}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <AgeBadge rating={title.ageRating} />
                          <span className="text-xs text-muted-foreground">
                            {title.releaseYear ?? "—"}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {title.type === "SERIES"
                      ? `Série · ${title._count.episodes} ep.`
                      : "Filme"}
                  </td>
                  <td className="px-4 py-3">
                    <ContentStatusPill status={title.status} />
                  </td>
                  <td className="px-4 py-3">
                    {title.type === "SERIES" ? (
                      <span className="text-xs text-muted-foreground">
                        por episódio
                      </span>
                    ) : (
                      <VideoStatusPill status={title.videoStatus} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(title.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          basePath="/admin/conteudo"
          searchParams={searchParams}
        />
      </div>
    </div>
  );
}
