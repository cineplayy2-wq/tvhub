"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export function ReportModal({
  open,
  onClose,
  channelName,
}: {
  open: boolean;
  onClose: () => void;
  channelName?: string;
}) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const options = [
    "Sinal fora do ar / Tela preta",
    "Áudio travando ou sem som",
    "Imagem com travamentos constantes",
    "Legenda ou idioma incorreto",
    "Conteúdo trocado / Nome errado",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setReason("");
        onClose();
      }, 1800);
    }, 1000);
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
              {options.map((opt) => (
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

          <button
            type="submit"
            disabled={!reason || sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-hover disabled:opacity-50"
          >
            {sending ? (
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
