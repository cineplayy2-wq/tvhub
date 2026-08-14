"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import {
  KeyRound,
  Lock,
  LogOut,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users,
  Check,
  AlertCircle,
} from "lucide-react";

import { updatePasswordAction, logoutAction } from "@/app/actions/auth";
import { createProfileAction, deleteProfileAction } from "@/app/actions/profiles";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import type { ProfileSummary } from "@/types";

export function AccountSettingsForm({
  user,
  profiles,
}: {
  user: { id: string; email: string; name: string | null; role: string };
  profiles: ProfileSummary[];
}) {
  const [passState, passAction] = useFormState(updatePasswordAction, {});
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [isKids, setIsKids] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    setProfileMsg(null);
    setProfileError(null);

    const formData = new FormData();
    formData.append("name", newProfileName.trim());
    if (isKids) formData.append("isKids", "true");

    try {
      const res = await createProfileAction({}, formData);
      if (res.error || res.fieldErrors) {
        setProfileError(res.error || "Erro ao criar perfil.");
      } else {
        setProfileMsg("Perfil criado com sucesso!");
        setNewProfileName("");
        setIsAddingProfile(false);
      }
    } catch {
      setProfileError("Falha na criação do perfil.");
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (profiles.length <= 1) {
      alert("Você deve manter pelo menos um perfil na conta.");
      return;
    }
    if (!confirm("Tem certeza que deseja excluir este perfil?")) return;

    try {
      await deleteProfileAction(profileId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* 1. Troca de Senha */}
      <div className="rounded-3xl border border-white/10 bg-surface/60 p-6 sm:p-8 backdrop-blur-md shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Segurança & Senha</h2>
              <p className="text-xs text-muted-foreground">Atualize sua senha de acesso a qualquer momento</p>
            </div>
          </div>

          <form action={passAction} className="space-y-4">
            {passState.error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {passState.error}
              </div>
            )}

            {passState.success && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
                <Check className="h-4 w-4 shrink-0" />
                {passState.success}
              </div>
            )}

            <Input
              name="newPassword"
              type="password"
              label="Nova Senha"
              placeholder="Mínimo 6 caracteres"
              required
              icon={<Lock className="h-4 w-4 text-white/50" />}
            />

            <Input
              name="confirmPassword"
              type="password"
              label="Confirmar Nova Senha"
              placeholder="Digite a nova senha novamente"
              required
              icon={<Lock className="h-4 w-4 text-white/50" />}
            />

            <SubmitButton fullWidth size="md" className="mt-2">
              Salvar Nova Senha
            </SubmitButton>
          </form>
        </div>

        {/* Botão de Logout Total */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-3 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/20 hover:text-rose-200"
            >
              <LogOut className="h-4 w-4" />
              Sair de Todas as Sessões (Desconectar)
            </button>
          </form>
        </div>
      </div>

      {/* 2. Gerenciamento de Perfis */}
      <div className="rounded-3xl border border-white/10 bg-surface/60 p-6 sm:p-8 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Perfis de Acesso</h2>
              <p className="text-xs text-muted-foreground">{profiles.length} de até 5 perfis em uso</p>
            </div>
          </div>

          {profiles.length < 5 && !isAddingProfile && (
            <button
              type="button"
              onClick={() => setIsAddingProfile(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Perfil
            </button>
          )}
        </div>

        {profileMsg && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
            {profileMsg}
          </div>
        )}

        {profileError && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
            {profileError}
          </div>
        )}

        {/* Formulário de Novo Perfil */}
        {isAddingProfile && (
          <form onSubmit={handleCreateProfile} className="mb-6 rounded-2xl border border-primary/40 bg-primary/10 p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary-light">Adicionar Novo Perfil</span>
              <button
                type="button"
                onClick={() => setIsAddingProfile(false)}
                className="text-xs text-muted-foreground hover:text-white"
              >
                Cancelar
              </button>
            </div>

            <Input
              name="name"
              placeholder="Nome do Perfil"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              required
              autoFocus
            />

            <label className="flex items-center gap-2 text-xs font-medium text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={isKids}
                onChange={(e) => setIsKids(e.target.checked)}
                className="rounded border-white/20 bg-black/40 text-primary focus:ring-primary"
              />
              Perfil Infantil (Kids - Bloqueia conteúdo adulto)
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-primary py-2 text-xs font-bold text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              Criar Perfil
            </button>
          </form>
        )}

        {/* Lista de Perfis */}
        <div className="space-y-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/40 p-3.5 transition-colors hover:border-white/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/30 to-purple-600/30 border border-white/10 text-sm font-bold text-white">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{p.name}</span>
                    {p.isKids && (
                      <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.2 text-[9px] font-black uppercase text-amber-300">
                        Kids
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {p.isKids ? "Conteúdo Seguro" : "Catálogo Completo"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/perfis"
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Entrar
                </Link>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(p.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
