"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, id, type = "text", ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const describedBy = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;

    const [revealed, setRevealed] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword && revealed ? "text" : type;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[13px] font-medium text-muted-foreground"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {icon && (
            <div className="pointer-events-none absolute left-3.5 flex items-center justify-center text-muted-foreground">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "h-12 w-full rounded-xl border bg-black/40 text-sm text-foreground transition-all duration-200",
              "placeholder:text-muted-foreground/40",
              "focus:border-primary/80 focus:outline-none focus:ring-2 focus:ring-primary/30",
              error
                ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/30"
                : "border-white/10",
              icon ? "pl-10" : "px-3.5",
              isPassword ? "pr-12" : "pr-3.5",
              className,
            )}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
              aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
              tabIndex={-1}
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          )}
        </div>

        {error ? (
          <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-rose-400">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
