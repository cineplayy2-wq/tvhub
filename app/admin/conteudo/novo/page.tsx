import Link from "next/link";

import { TitleForm } from "@/components/admin/title-form";
import { listGenres } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function NewTitlePage() {
  const genres = await listGenres();

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Link
        href="/admin/conteudo"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Conteúdo
      </Link>

      <h1 className="mb-8 mt-4 text-2xl font-semibold tracking-display text-foreground">
        Novo título
      </h1>

      <TitleForm title={null} allGenres={genres} />
    </div>
  );
}
