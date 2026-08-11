import { AppTopbar } from "@/components/iptv/app-topbar";
import { SideNav } from "@/components/iptv/side-nav";

export const dynamic = "force-dynamic";

export default function TvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background antialiased selection:bg-primary/20">
      {/* Celular: cabeçalho do protótipo. Desktop e TV: menu lateral, que
          é a mesma taxonomia da barra de baixo girada 90°. */}
      <div className="md:hidden">
        <AppTopbar />
      </div>
      <SideNav />

      <main className="min-h-screen md:pl-[72px]">{children}</main>
    </div>
  );
}
