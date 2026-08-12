"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";

import { reportChannelIssueAction } from "@/app/actions/report";
import { Modal } from "@/components/ui/modal";

const OPTIONS = [
  "Sinal fora do ar / Tela preta",
  "Áudio travando ou sem som",
  "Imagem com travamentos constantes",
  "Legenda ou idioma incorreto",
  "Conteúdo trocado / Nome errado",
] as const;

export function ReportModal({
  open,
  onClose,
  channelId,
  channelName,
}: {
  open: boolean;
  onClose: () => void;
  channelId?: string;
  channelName?: string;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    setError(null);
    startTransition(async () => {
      const result = await reportChannelIssueAction({
        channelId,
        channelName,
        reason,
      });

      if (!result.ok) {
        setError(result.error ?? "Não foi possível enviar.");
        return;
      }

      setSent(true);
      setTimeout(() => {
        setSent(false);
        setReason("");
        onClose();
      }, 1800);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reportar Problema"
      description={
        channelName
          ? `Reportar falha de sinal em "${channelName}".`
          : "Envie um alerta sobre falhas de transmissão para nossa equipe resolver."
      }
    >
      {sent ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h3 className="mt-3 text-base font-bold text-foreground">Reporte enviado com sucesso!</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Obrigado pelo aviso. Nossa equipe irá verificar o sinal imediatamente.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Qual o problema encontrado?
            </label>
            <div className="space-y-2">
              {OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-xs font-medium transition-colors ${
                    reason === opt
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-white/[0.08] bg-surface text-muted-foreground hover:bg-surface-hover"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={opt}
                    checked={reason === opt}
                    onChange={(e) => setReason(e.target.value)}
                    className="accent-primary"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!reason || isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover disabled:opacity-50"
          >
            {isPending ? (
              <span>Enviando reporte…</span>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Enviar Reporte</span>
              </>
            )}
          </button>
        </form>
      )}
    </Modal>
  );
}
