import type { Metadata } from "next";

import { AppHeader } from "@/components/catalog/app-header";
import { SearchInput } from "@/components/catalog/search-input";
import { TitleCard } from "@/components/catalog/title-card";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { searchCatalog } from "@/lib/queries/browse";

export const metadata: Metadata = {
  title: "Buscar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const user = await requireUser();
  const profile = await requireProfile(user.id);

  const query = searchParams.q?.trim() ?? "";
  const results = query ? await searchCatalog(query, profile.maxAgeRating) : [];

  return (
    <div className="min-h-screen pb-20">
      <AppHeader profile={profile} isAdmin={user.role === "ADMIN"} />

      <div className="mx-auto max-w-6xl px-5 pt-28 sm:px-10">
        <SearchInput defaultValue={query} />

        {query.length >= 2 && (
          <p className="mt-6 text-sm text-muted-foreground">
            {results.length === 0
              ? `Nada encontrado para "${query}".`
              : `${results.length} ${results.length === 1 ? "resultado" : "resultados"} para "${query}".`}
          </p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {results.map((item) => (
            <TitleCard key={item.id} item={item} className="w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
