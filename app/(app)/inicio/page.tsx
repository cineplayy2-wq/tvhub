import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/catalog/app-header";
import { CatalogRow } from "@/components/catalog/catalog-row";
import { HeroBanner } from "@/components/catalog/hero-banner";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile, requireUser } from "@/lib/auth/session";
import {
  getCatalogRows,
  getContinueWatching,
  getHeroTitle,
} from "@/lib/queries/browse";

export const metadata: Metadata = {
  title: "Início",
  robots: { index: false, follow: false },
};

// Catálogo muda pelo admin e o progresso muda a cada play: nada de cache
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserPlaylist } from "@/lib/queries/iptv";

export default async function HomePage() {
  const user = await requireUser("/inicio");
  const profile = await requireProfile(user.id);

  // If user has an M3U playlist configured, redirect directly to /tv for the IPTV experience
  const userPlaylist = await getUserPlaylist(user.id);
  if (userPlaylist && userPlaylist.syncStatus === "SYNCED" && userPlaylist.totalChannels > 0) {
    redirect("/tv");
  }

  // Em paralelo: sequencial somaria três round-trips antes do primeiro byte
  const [hero, continueWatching, rows] = await Promise.all([
    getHeroTitle(profile.maxAgeRating),
    getContinueWatching(profile.id, profile.maxAgeRating),
    getCatalogRows(profile.id, profile.maxAgeRating),
  ]);

  const isEmpty = !hero && rows.every((row) => row.items.length === 0);

  if (isEmpty) {
    redirect("/tv");
  }

  return (
    <div className="min-h-screen pb-20">
      <AppHeader profile={profile} isAdmin={user.role === "ADMIN"} />

      {hero ? (
        <HeroBanner title={hero} />
      ) : (
        // Sem Hero o conteúdo começaria embaixo do header fixo
        <div className="h-16" />
      )}

      {isEmpty ? (
        <div className="mx-auto max-w-lg px-5 py-24 text-center">
          <h1 className="font-display text-display-sm uppercase tracking-tightest text-foreground">
            Catálogo vazio
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {profile.isKids
              ? "Nenhum título liberado para perfil infantil ainda."
              : "Nenhum título publicado ainda."}
          </p>
          {user.role === "ADMIN" && (
            <Link
              href="/admin/conteudo"
              className={`${buttonVariants({ variant: "primary", size: "md" })} mt-8`}
            >
              Publicar conteúdo
            </Link>
          )}
        </div>
      ) : (
        <div
          className={
            // Sobe as trilhas por cima da base do Hero: é o que cria a
            // sensação de continuidade em vez de blocos empilhados
            hero ? "relative z-10 -mt-16 space-y-10 sm:-mt-24" : "space-y-10 pt-6"
          }
        >
          {continueWatching.length > 0 && (
            <CatalogRow title="Continuar assistindo" items={continueWatching} />
          )}

          {rows.map((row) => (
            <CatalogRow key={row.key} title={row.title} items={row.items} />
          ))}
        </div>
      )}
    </div>
  );
}
