import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function Pagination({
  page,
  totalPages,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        {total} {total === 1 ? "registro" : "registros"}
      </p>
    );
  }

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground">
        Página {page} de {totalPages} · {total} registros
      </p>

      <div className="flex gap-2">
        <Link
          href={hrefFor(page - 1)}
          aria-disabled={page <= 1}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            // aria-disabled sozinho não impede o clique em um <a>
            page <= 1 && "pointer-events-none opacity-40",
          )}
        >
          Anterior
        </Link>
        <Link
          href={hrefFor(page + 1)}
          aria-disabled={page >= totalPages}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            page >= totalPages && "pointer-events-none opacity-40",
          )}
        >
          Próxima
        </Link>
      </div>
    </div>
  );
}
