"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Trash2 } from "lucide-react";

import {
  createProfileAction,
  deleteProfileAction,
  updateProfileAction,
  type ProfileFormState,
} from "@/app/actions/profiles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { PROFILE } from "@/lib/constants";
import { AVATARES, avatarDoPerfil } from "@/lib/profile/avatars";
import { cn } from "@/lib/utils";
import type { ProfileSummary } from "@/types";

const INITIAL: ProfileFormState = {};

export function ProfileFormModal({
  open,
  profile,
  canDelete,
  onClose,
}: {
  open: boolean;
  /** null = criar novo. */
  profile: ProfileSummary | null;
  canDelete: boolean;
  onClose: () => void;
}) {
  const isEditing = profile !== null;
  const [state, formAction] = useFormState(
    isEditing ? updateProfileAction : createProfileAction,
    INITIAL,
  );

  const [isKids, setIsKids] = useState(profile?.isKids ?? false);
  const [removePin, setRemovePin] = useState(false);
  const [avatar, setAvatar] = useState<string>(
    profile
      ? avatarDoPerfil({ id: profile.id, avatarUrl: profile.avatarUrl, isKids: profile.isKids })
      : AVATARES[0].src,
  );

  // Reabrir o modal para outro perfil precisa recarregar os valores
  useEffect(() => {
    setIsKids(profile?.isKids ?? false);
    setRemovePin(false);
    setAvatar(
      profile
        ? avatarDoPerfil({ id: profile.id, avatarUrl: profile.avatarUrl, isKids: profile.isKids })
        : AVATARES[0].src,
    );
  }, [profile]);

  // Sem erro após um submit = salvou; o revalidatePath já atualizou a lista
  useEffect(() => {
    if (state !== INITIAL && !state.error && !state.fieldErrors) onClose();
  }, [state, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar perfil" : "Novo perfil"}
    >
      <form action={formAction} className="space-y-5">
        <FormError message={state.error} />
        {isEditing && <input type="hidden" name="id" value={profile.id} />}

        {/* O valor vai num campo escondido: o servidor confere contra o
            catálogo antes de gravar, então o que o cliente manda nunca é
            aceito de olhos fechados. */}
        <input type="hidden" name="avatarUrl" value={avatar} />

        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-foreground">
            Escolha a foto
          </legend>
          <div className="grid grid-cols-6 gap-2.5">
            {AVATARES.map((opcao) => {
              const escolhido = avatar === opcao.src;
              return (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => setAvatar(opcao.src)}
                  aria-label={opcao.rotulo}
                  aria-pressed={escolhido}
                  title={opcao.rotulo}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-full transition-all",
                    "ring-2 ring-offset-2 ring-offset-surface",
                    escolhido
                      ? "scale-105 ring-accent"
                      : "ring-transparent hover:ring-white/25 active:scale-95",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={opcao.src} alt="" className="h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
        </fieldset>

        <Input
          name="name"
          label="Nome do perfil"
          defaultValue={profile?.name}
          maxLength={24}
          autoComplete="off"
          error={state.fieldErrors?.name}
          autoFocus
        />

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3.5 transition-colors hover:border-border-strong">
          <input
            type="checkbox"
            name="isKids"
            checked={isKids}
            onChange={(e) => setIsKids(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Perfil infantil
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Mostra apenas títulos livres ou até 12 anos.
            </span>
          </span>
        </label>

        {isKids ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
            Perfis infantis entram direto e não utilizam PIN, garantindo acesso livre e simples para as crianças.
          </div>
        ) : (
          <>
            {isEditing && profile.hasPin && (
              <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  name="removePin"
                  checked={removePin}
                  onChange={(e) => setRemovePin(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Remover o PIN deste perfil adulto
              </label>
            )}

            {!removePin && (
              <Input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={PROFILE.PIN_LENGTH}
                label={`PIN de ${PROFILE.PIN_LENGTH} dígitos para perfil adulto (opcional)`}
                placeholder={profile?.hasPin ? "PIN atual mantido" : "••••"}
                autoComplete="off"
                hint={
                  profile?.hasPin
                    ? "Deixe em branco para manter o PIN atual."
                    : "Proteja este perfil adulto contra o acesso das crianças."
                }
                error={state.fieldErrors?.pin}
              />
            )}
          </>
        )}

        <div className="flex gap-3 pt-1">
          {isEditing && canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                if (confirm(`Excluir o perfil "${profile.name}"?`)) {
                  void deleteProfileAction(profile.id);
                  onClose();
                }
              }}
              className="text-danger hover:bg-danger/10 hover:text-danger"
              aria-label="Excluir perfil"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}
          <SubmitButton fullWidth>
            {isEditing ? "Salvar" : "Criar perfil"}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
