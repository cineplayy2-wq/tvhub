"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Crown,
  LogOut,
  Pencil,
  Plus,
  Radio,
  Settings,
  Shield,
  User,
  UserCheck,
  Sparkles,
} from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { selectProfileAction } from "@/app/actions/profiles";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ProfileFormModal } from "@/components/profile/profile-form-modal";
import type { ProfileSummary } from "@/types";
import { cn } from "@/lib/utils";

export function UserProfileMenu({
  user,
  profiles,
  activeProfile,
}: {
  user?: { email?: string | null; name?: string | null; role?: string } | null;
  profiles: ProfileSummary[];
  activeProfile: ProfileSummary | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfileSummary | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const current = activeProfile || profiles[0];

  const handleSelectProfile = (profile: ProfileSummary) => {
    if (profile.id === current?.id) {
      setIsOpen(false);
      return;
    }
    startTransition(() => {
      void selectProfileAction(profile.id);
    });
  };

  return (
    <>
      <div className="relative">
        {/* Bolinha do Perfil no Header */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Menu do Perfil"
          aria-expanded={isOpen}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-surface/80 p-1 pl-1 pr-2.5 transition-all hover:border-primary/50 hover:bg-surface-elevated active:scale-95 shadow-md"
        >
          {current ? (
            <ProfileAvatar
              id={current.id}
              name={current.name}
              avatarUrl={current.avatarUrl}
              isKids={current.isKids}
              size="sm"
              className="h-7 w-7 rounded-full ring-1 ring-primary/40"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-accent">
              <User className="h-4 w-4" />
            </div>
          )}

          <span className="hidden max-w-[100px] truncate text-xs font-bold text-foreground sm:inline-block">
            {current?.name || "Perfil"}
          </span>

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              isOpen ? "rotate-180 text-foreground" : "",
            )}
          />
        </button>

        {/* Menu Dropdown Flutuante Estilo Netflix / HBO */}
        {isOpen && (
          <>
            {/* Backdrop transparente para fechar ao clicar fora */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            <div className="absolute right-0 top-12 z-50 w-72 origin-top-right rounded-2xl border border-white/[0.1] bg-surface/95 p-4 shadow-card backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
              {/* Cabeçalho com Conta do Assinante */}
              <div className="mb-3 border-b border-white/[0.08] pb-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-accent">
                    <Crown className="h-3 w-3" />
                    Assinante VIP
                  </span>
                  {user?.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline"
                    >
                      <Shield className="h-3 w-3" />
                      Admin
                    </Link>
                  )}
                </div>
                <p className="mt-2 truncate text-xs font-semibold text-foreground">
                  {user?.email || "Cliente Hubflix"}
                </p>
              </div>

              {/* Seção: Perfis de Usuário */}
              <div className="mb-2">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Trocar Perfil
                </p>
                <div className="space-y-1">
                  {profiles.map((profile) => {
                    const isSelected = profile.id === current?.id;
                    return (
                      <div
                        key={profile.id}
                        className={cn(
                          "flex items-center justify-between rounded-xl p-2 transition-colors",
                          isSelected
                            ? "bg-primary/15 border border-primary/30"
                            : "hover:bg-surface-elevated",
                        )}
                      >
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSelectProfile(profile)}
                          className="flex flex-1 items-center gap-2.5 text-left"
                        >
                          <ProfileAvatar
                            id={profile.id}
                            name={profile.name}
                            avatarUrl={profile.avatarUrl}
                            isKids={profile.isKids}
                            size="sm"
                            className="h-7 w-7 rounded-lg"
                          />
                          <span className="truncate text-xs font-semibold text-foreground">
                            {profile.name}
                          </span>
                          {profile.isKids && (
                            <span className="rounded bg-primary/25 px-1.5 py-0.5 text-[9px] font-black uppercase text-accent">
                              Kids
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingProfile(profile);
                            setIsFormOpen(true);
                            setIsOpen(false);
                          }}
                          aria-label={`Editar ${profile.name}`}
                          title="Editar Perfil"
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botão Adicionar Perfil */}
              {profiles.length < 4 && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfile(null);
                    setIsFormOpen(true);
                    setIsOpen(false);
                  }}
                  className="mb-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-white/15 p-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-accent"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar novo perfil</span>
                </button>
              )}

              {/* Outros Atalhos */}
              <div className="border-t border-white/[0.08] pt-2 space-y-1">
                <Link
                  href="/perfis"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                >
                  <Settings className="h-4 w-4" />
                  <span>Gerenciar Perfis</span>
                </Link>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sair da conta</span>
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Formulário de Edição do Perfil */}
      <ProfileFormModal
        open={isFormOpen}
        profile={editingProfile}
        canDelete={profiles.length > 1}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProfile(null);
        }}
      />
    </>
  );
}
