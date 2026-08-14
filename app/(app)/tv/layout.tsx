import { AppTopbar } from "@/components/iptv/app-topbar";
import { SideNav } from "@/components/iptv/side-nav";
import { getActiveProfile, listProfiles, requireUser } from "@/lib/auth/session";
import { avatarDoPerfil } from "@/lib/profile/avatars";

export const dynamic = "force-dynamic";

export default async function TvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [profiles, perfil] = await Promise.all([
    listProfiles(user.id),
    getActiveProfile(user.id).catch(() => null),
  ]);

  const avatar = perfil
    ? avatarDoPerfil({ id: perfil.id, avatarUrl: perfil.avatarUrl, isKids: perfil.isKids })
    : null;

  return (
    <div className="min-h-screen bg-background antialiased selection:bg-primary/20">
      {/* Celular: cabeçalho do protótipo. Desktop e TV: menu lateral, que
          é a mesma taxonomia da barra de baixo girada 90°. */}
      <div className="md:hidden">
        <AppTopbar
          user={{ email: user.email, name: user.name, role: user.role }}
          profiles={profiles}
          activeProfile={perfil}
          avatarUrl={avatar}
          profileName={perfil?.name ?? null}
        />
      </div>
      <SideNav avatarUrl={avatar} profileName={perfil?.name ?? null} />

      <main className="min-h-screen md:pl-[72px]">{children}</main>
    </div>
  );
}
