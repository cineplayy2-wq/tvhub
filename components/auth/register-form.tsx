"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Check } from "lucide-react";

import { registerAction, type AuthFormState } from "@/app/actions/auth";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { PlanCard } from "@/types";
import { cn, formatMonthlyEquivalent, formatPrice } from "@/lib/utils";

const INITIAL: AuthFormState = {};

export function RegisterForm({
  plans,
  defaultPlan,
}: {
  plans: PlanCard[];
  defaultPlan: string;
}) {
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);
  const [state, formAction] = useFormState(registerAction, INITIAL);

  return (
    <form action={formAction} noValidate className="space-y-5">
      <FormError message={state.error} />

      {/* Seleção de plano dentro do cadastro: o usuário chega aqui pela
          tabela de preços e não deve precisar voltar para trocar */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-[13px] font-medium text-muted">
          Escolha seu plano
        </legend>

        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.slug;
          const isYearly = plan.interval === "YEAR";

          return (
            <label
              key={plan.id}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors duration-200",
                isSelected
                  ? "border-primary/70 bg-primary/[0.07]"
                  : "border-border hover:border-border-strong",
              )}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="plan"
                  value={plan.slug}
                  checked={isSelected}
                  onChange={() => setSelectedPlan(plan.slug)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-border-strong",
                  )}
                >
                  {isSelected && (
                    <Check
                      className="h-2.5 w-2.5 text-primary-foreground"
                      strokeWidth={4}
                    />
                  )}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {plan.name}
                </span>
              </div>

              <div className="text-right">
                <div className="text-sm font-medium text-foreground">
                  {isYearly
                    ? formatMonthlyEquivalent(plan.priceCents)
                    : formatPrice(plan.priceCents)}
                  <span className="text-xs font-normal text-muted-foreground">
                    /mês
                  </span>
                </div>
                {isYearly && (
                  <div className="text-[11px] text-muted-foreground">
                    {formatPrice(plan.priceCents)} por ano
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </fieldset>

      <Input
        name="name"
        label="Nome"
        placeholder="Como podemos te chamar"
        autoComplete="name"
        error={state.fieldErrors?.name}
      />

      <Input
        name="email"
        type="email"
        label="E-mail"
        placeholder="voce@email.com"
        autoComplete="email"
        error={state.fieldErrors?.email}
      />

      <Input
        name="password"
        type="password"
        label="Senha"
        placeholder="••••••••"
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres, com letras e números"
        error={state.fieldErrors?.password}
      />

      <Input
        name="confirmPassword"
        type="password"
        label="Confirmar senha"
        placeholder="••••••••"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton fullWidth>Criar conta</SubmitButton>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Ao criar sua conta você concorda com os Termos de uso e a Política de
        privacidade.
      </p>
    </form>
  );
}
