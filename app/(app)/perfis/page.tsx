import type { Metadata } from "next";
import Link from "next/link";

import { ProfileGrid } from "@/components/profile/profile-grid";
import { Logo } from "@/components/shared/logo";
import { listProfiles, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Quem está assistindo?",
  robots: { index: false, follow: false },
};

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: { desbloquear?: string };
}) {
  const user = await requireUser("/perfis");
  const profiles = await listProfiles(user.id);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-16">
      <div className="mb-12 flex flex-col items-center gap-8">
        <Link href="/" aria-label="HUBFLIX — início">
          <Logo size="lg" />
        </Link>
        <h1 className="text-center text-2xl font-medium tracking-display text-foreground sm:text-3xl">
          Quem está assistindo?
        </h1>
      </div>

      <ProfileGrid
        profiles={profiles}
        initialUnlockId={searchParams.desbloquear}
      />
    </div>
  );
}
