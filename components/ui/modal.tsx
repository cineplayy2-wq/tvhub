"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Modais de bloqueio (ex: limite de telas) não devem fechar por clique fora. */
  dismissible?: boolean;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  dismissible = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC fecha + trava a rolagem do fundo enquanto o modal está aberto
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    // Move o foco para dentro do modal — sem isso o teclado continua no fundo
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, dismissible]);

  // O portal só existe no cliente
  if (typeof document === "undefined") return null;

  return createPortal(
    // O wrapper fica sempre montado e só recebe cliques quando `open`.
    // Motivo: o AnimatePresence só desmonta o filho quando a animação de saída
    // COMPLETA, e isso depende de requestAnimationFrame. Se o rAF for pausado
    // no meio (aba em segundo plano), o nó permanece no DOM com
    // pointer-events ativo — um overlay invisível que engole todos os cliques
    // da página. Com o wrapper controlando pointer-events pelo estado, o
    // bloqueio some no instante em que o modal fecha, animação concluída ou não.
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <AnimatePresence>
        {open && (
          <>
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={dismissible ? onClose : undefined}
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            // Curva longa sem overshoot — é o que evita a sensação de "solavanco"
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              "relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-card focus:outline-none",
              className,
            )}
          >
            {dismissible && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}

            {title && (
              <h2 className="pr-8 text-lg font-semibold tracking-display text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1.5 text-sm text-muted">{description}</p>
            )}

            <div className={cn(title || description ? "mt-5" : undefined)}>
              {children}
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
