"use client";

import { useFormState } from "react-dom";

import {
  unlockProfileAction,
  type ProfileFormState,
} from "@/app/actions/profiles";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { PROFILE } from "@/lib/constants";
import type { ProfileSummary } from "@/types";

const INITIAL: ProfileFormState = {};

export function PinDialog({
  profile,
  onClose,
}: {
  profile: ProfileSummary | null;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(unlockProfileAction, INITIAL);

  return (
    <Modal
      open={profile !== null}
      onClose={onClose}
      title={`PIN de ${profile?.name ?? ""}`}
      description="Este perfil é protegido. Informe o PIN para continuar."
    >
      <form action={formAction} className="space-y-4">
        <FormError message={state.error} />
        <input type="hidden" name="id" value={profile?.id ?? ""} />

        <Input
          name="pin"
          type="password"
          inputMode="numeric"
          // Bloqueia entrada não numérica já no teclado, sem esperar o servidor
          pattern="[0-9]*"
          maxLength={PROFILE.PIN_LENGTH}
          autoComplete="off"
          placeholder="••••"
          className="text-center text-lg tracking-[0.5em]"
          error={state.fieldErrors?.pin}
          autoFocus
        />

        <SubmitButton fullWidth>Desbloquear</SubmitButton>
      </form>
    </Modal>
  );
}
