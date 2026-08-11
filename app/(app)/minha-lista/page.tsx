import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/catalog/app-header";
import { TitleCard } from "@/components/catalog/title-card";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AGE_RATING_ORDER } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Minha lista",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const user = await requireUser();
  const profile = await requireProfile(user.id);

  const limit = AGE_RATING_ORDER.indexOf(profile.maxAgeRating);

  const items = await prisma.watchlistItem.findMany({
    where: {
      profileId: profile.id,
      title: {
        status: "PUBLISHED",
        // Filtro etário aplicado na query: um título salvo antes de o perfil
        // virar infantil não pode reaparecer aqui depois.
        ageRating: { in: AGE_RATING_ORDER.slice(0, limit + 1) },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      title: {
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          posterUrl: true,
          backdropUrl: true,
          releaseYear: true,
          ageRating: true,
          durationSeconds: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen pb-20">
      <AppHeader profile={profile} isAdmin={user.role === "ADMIN"} />

      <div className="mx-auto max-w-6xl px-5 pt-28 sm:px-10">
        <h1 className="font-display text-display-sm uppercase tracking-tightest text-foreground">
          Minha lista
        </h1>

        {items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-muted">
              Você ainda não salvou nenhum título.
            </p>
            <Link
              href="/inicio"
              className={`${buttonVariants({ variant: "outline", size: "md" })} mt-6`}
            >
              Explorar catálogo
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((entry) => (
              <TitleCard
                key={entry.title.id}
                item={entry.title}
                className="w-full"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
