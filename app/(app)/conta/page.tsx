import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, KeyRound, Lock, ShieldCheck, User, Users, LogOut, CheckCircle2, Sparkles } from "lucide-react";

import { requireUser, listProfiles, getActiveProfile } from "@/lib/auth/session";
import { Logo } from "@/components/shared/logo";
import { AccountSettingsForm } from "@/components/account/account-settings-form";

export const metadata: Metadata = {
  title: "Minha Conta & Perfis",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/conta");
  const profiles = await listProfiles(user.id);
  const activeProfile = await getActiveProfile(user.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-black to-slate-950 text-foreground px-4 py-8 md:py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/tv"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Logo size="md" />
          </div>

          <div className="flex items-center gap-3">
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/20 px-3.5 py-1.5 text-xs font-bold text-primary-light transition-all hover:bg-primary/30"
              >
                <ShieldCheck className="h-4 w-4" />
                Painel Admin
              </Link>
            )}
            <Link
              href="/perfis"
              className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Trocar Perfil
            </Link>
          </div>
        </div>

        {/* User Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.02] to-transparent p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary-hover text-white font-black text-2xl shadow-[0_0_30px_rgba(108,29,255,0.4)]">
                {(user.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white">{user.name || "Minha Conta"}</h1>
                  <span className="rounded-full bg-primary/20 border border-primary/40 px-2.5 py-0.5 text-[10px] font-black uppercase text-primary-light">
                    {user.role === "ADMIN" ? "Administrador" : "Assinante VIP"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
              </div>
            </div>

            {activeProfile && (
              <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-white/70">Perfil Ativo:</span>
                <span className="text-xs font-bold text-white">{activeProfile.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Forms & Profile Management */}
        <AccountSettingsForm
          user={{
            id: user.id,
            email: user.email ?? "",
            name: user.name ?? null,
            role: user.role,
          }}
          profiles={profiles}
        />
      </div>
    </div>
  );
}
