import { AppTopbar } from "@/components/iptv/app-topbar";
import { SideNav } from "@/components/iptv/side-nav";
import { getActiveProfile, requireUser } from "@/lib/auth/session";
import { avatarDoPerfil } from "@/lib/profile/avatars";

export const dynamic = "force-dynamic";

export default async function TvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O avatar é resolvido aqui, no servidor, e desce pronto para as barras.
  // Elas são componentes de cliente e não têm como consultar o perfil ativo.
  const user = await requireUser();
  const perfil = await getActiveProfile(user.id).catch(() => null);

  const avatar = perfil
    ? avatarDoPerfil({ id: perfil.id, avatarUrl: perfil.avatarUrl, isKids: perfil.isKids })
    : null;

  return (
    <div className="min-h-screen bg-background antialiased selection:bg-primary/20">
      {/* Celular: cabeçalho do protótipo. Desktop e TV: menu lateral, que
          é a mesma taxonomia da barra de baixo girada 90°. */}
      <div className="md:hidden">
        <AppTopbar avatarUrl={avatar} profileName={perfil?.name ?? null} />
      </div>
      <SideNav avatarUrl={avatar} profileName={perfil?.name ?? null} />

      <main className="min-h-screen md:pl-[72px]">{children}</main>
    </div>
  );
}
