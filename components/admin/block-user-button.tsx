"use client";

import { useState, useTransition } from "react";
import { Ban, ShieldCheck } from "lucide-react";

import { toggleUserBlockAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export function BlockUserButton({
  userId,
  isBlocked,
  size = "sm",
}: {
  userId: string;
  isBlocked: boolean;
  size?: "sm" | "md";
}) {
  const [isOpen, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      await toggleUserBlockAction(userId, reason);
      setOpen(false);
      setReason("");
    });
  }

  // Desbloquear é reversível e inofensivo: não vale um modal de confirmação
  if (isBlocked) {
    return (
      <Button
        variant="outline"
        size={size}
        isLoading={isPending}
        onClick={() => startTransition(() => void toggleUserBlockAction(userId))}
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Desbloquear
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        className="text-danger hover:border-danger/50"
      >
        <Ban className="h-4 w-4" aria-hidden />
        Bloquear
      </Button>

      <Modal
        open={isOpen}
        onClose={() => setOpen(false)}
        title="Bloquear cliente"
        description="O acesso é cortado no login e as sessões de reprodução em andamento são encerradas na hora."
      >
        <div className="space-y-5">
          <Input
            label="Motivo (opcional)"
            placeholder="Ex: compartilhamento indevido"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={280}
            hint="Fica registrado no log de auditoria."
          />

          <div className="flex gap-3">
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              fullWidth
              isLoading={isPending}
              onClick={submit}
            >
              Bloquear
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
