import Link from "next/link";
import { notFound } from "next/navigation";

import { EpisodesManager } from "@/components/admin/episodes-manager";
import { ContentStatusPill } from "@/components/admin/status-pill";
import { TitleForm } from "@/components/admin/title-form";
import { getTitleForEdit, listGenres } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export default async function EditTitlePage({
  params,
}: {
  params: { id: string };
}) {
  const [title, genres] = await Promise.all([
    getTitleForEdit(params.id),
    listGenres(),
  ]);

  if (!title) notFound();

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Link
        href="/admin/conteudo"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Conteúdo
      </Link>

      <div className="mb-8 mt-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-display text-foreground">
          {title.name}
        </h1>
        <ContentStatusPill status={title.status} />
      </div>

      <TitleForm title={title} allGenres={genres} />

      {title.type === "SERIES" && (
        <div className="mt-8">
          <EpisodesManager titleId={title.id} episodes={title.episodes} />
        </div>
      )}
    </div>
  );
}
