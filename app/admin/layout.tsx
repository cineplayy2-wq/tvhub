import type { Metadata } from "next";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O middleware já barra não-admin, mas ele não cobre server actions.
  // Cada action refaz a checagem; aqui é a defesa da camada de renderização.
  await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
