"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { ArrowLeft, KeyRound, Mail, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

import { loginAction, resendOtpAction, type AuthFormState } from "@/app/actions/auth";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

const INITIAL: AuthFormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(loginAction, INITIAL);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hiddenOtpRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Atualiza o input oculto sempre que os dígitos mudam
  const fullOtp = otpDigits.join("");
  useEffect(() => {
    if (hiddenOtpRef.current) {
      hiddenOtpRef.current.value = fullOtp;
    }
  }, [fullOtp]);

  // Handler para trocar dígito e avançar o foco
  const handleDigitChange = (index: number, value: string) => {
    const char = value.slice(-1);
    if (!/^\d*$/.test(char)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Submete automaticamente se preencheu 6 dígitos
    if (index === 5 && char && newDigits.every((d) => d !== "")) {
      setTimeout(() => {
        formRef.current?.requestSubmit();
      }, 150);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim().slice(0, 6);
    if (!/^\d+$/.test(pasted)) return;

    const digits = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
    setOtpDigits(digits);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();

    if (pasted.length === 6) {
      setTimeout(() => {
        formRef.current?.requestSubmit();
      }, 150);
    }
  };

  const handleResend = async () => {
    if (!state.email || resending) return;
    setResending(true);
    setResendMsg(null);
    try {
      await resendOtpAction(state.email, state.password);
      setResendMsg("Novo código enviado com sucesso para seu e-mail!");
    } catch {
      setResendMsg("Erro ao reenviar o código.");
    } finally {
      setResending(false);
    }
  };

  // ==========================================================
  // ETAPA 2: DIGITAR CÓDIGO OTP (INTERATIVO COM 6 CAIXAS)
  // ==========================================================
  if (state.requiresOtp) {
    return (
      <form
        ref={formRef}
        action={formAction}
        noValidate
        className="space-y-6 animate-in fade-in zoom-in-95 duration-300"
      >
        <FormError message={state.error} />

        {resendMsg && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300 text-center shadow-md animate-in fade-in">
            {resendMsg}
          </div>
        )}

        {/* Campos ocultos da Etapa 1 */}
        <input type="hidden" name="email" value={state.email ?? ""} />
        <input type="hidden" name="password" value={state.password ?? ""} />
        <input ref={hiddenOtpRef} type="hidden" name="otpCode" value={fullOtp} />
        {next && <input type="hidden" name="next" value={next} />}

        {/* Cabeçalho de Confirmação */}
        <div className="text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 via-violet-600/25 to-indigo-600/30 border border-primary/50 shadow-[0_0_35px_rgba(108,29,255,0.5)] text-primary">
            <ShieldCheck className="h-8 w-8 text-primary drop-shadow-[0_0_12px_rgba(108,29,255,0.9)]" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            Código enviado para o e-mail:
          </p>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-4 py-1 text-xs font-bold text-primary shadow-[0_0_15px_rgba(108,29,255,0.3)]">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="truncate max-w-[240px]">{state.email}</span>
          </div>
        </div>

        {/* 6 Caixas de PIN */}
        <div>
          <label className="block mb-3 text-xs font-bold text-muted-foreground text-center uppercase tracking-wider">
            Digite o Código de 6 Dígitos
          </label>
          <div className="flex justify-between gap-2 sm:gap-2.5" onPaste={handlePaste}>
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                autoFocus={idx === 0}
                className="h-14 w-12 sm:w-13 text-center text-2xl font-black font-mono rounded-2xl border border-white/20 bg-black/80 text-white shadow-inner focus:border-primary focus:bg-primary/20 focus:ring-2 focus:ring-primary/60 focus:outline-none transition-all duration-200"
              />
            ))}
          </div>
        </div>

        <SubmitButton fullWidth size="lg" className="h-14 sm:h-15 text-lg font-black tracking-wide shadow-[0_0_35px_rgba(108,29,255,0.5)]">
          Confirmar e Entrar
        </SubmitButton>

        {/* Links de Reenvio e Troca */}
        <div className="pt-3 flex items-center justify-between text-xs border-t border-white/10">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="flex items-center gap-1.5 font-bold text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin text-primary" : ""}`} />
            {resending ? "Enviando..." : "Reenviar e-mail"}
          </button>

          <a
            href="/login"
            className="flex items-center gap-1 font-bold text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Trocar e-mail
          </a>
        </div>
      </form>
    );
  }

  // ==========================================================
  // ETAPA 1: DIGITAR E-MAIL E SENHA
  // ==========================================================
  return (
    <form action={formAction} noValidate className="space-y-5">
      <FormError message={state.error} />

      {next && <input type="hidden" name="next" value={next} />}

      <Input
        name="email"
        type="email"
        label="E-mail de Acesso"
        placeholder="seu@email.com"
        autoComplete="email"
        defaultValue={state.email}
        error={state.fieldErrors?.email}
        icon={<Mail className="h-4 w-4 text-primary/70" />}
        autoFocus
      />

      <div>
        <Input
          name="password"
          type="password"
          label="Sua Senha"
          placeholder="••••••••"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          icon={<KeyRound className="h-4 w-4 text-primary/70" />}
        />
        <div className="mt-2 text-right">
          <span className="text-xs font-medium text-muted-foreground/70">
            Esqueceu a senha? Fale com o suporte.
          </span>
        </div>
      </div>

      <SubmitButton
        fullWidth
        size="lg"
        className="h-14 sm:h-15 text-lg font-black tracking-wide shadow-[0_0_35px_rgba(108,29,255,0.5)] hover:shadow-[0_0_45px_rgba(108,29,255,0.75)]"
      >
        Continuar
      </SubmitButton>
    </form>
  );
}
