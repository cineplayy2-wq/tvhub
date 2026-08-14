import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { getPublicPlans } from "@/lib/queries/plans";

export const metadata: Metadata = {
  title: "Criar conta",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { plano?: string };
}) {
  const plans = await getPublicPlans();

  // O plano vem da tabela de preços via ?plano=. Valor inválido cai no anual.
  const requested = searchParams.plano;
  const defaultPlan = plans.some((plan) => plan.slug === requested)
    ? requested!
    : (plans.find((plan) => plan.isHighlighted)?.slug ?? plans[0].slug);

  return (
    <AuthShell
      title="Criar sua conta"
      subtitle="Leva menos de um minuto."
      footer={
        <>
          Já é assinante?{" "}
          <Link
            href="/login"
            className="font-medium text-accent transition-colors hover:text-primary-hover"
          >
            Entrar
          </Link>
        </>
      }
    >
      <RegisterForm plans={plans} defaultPlan={defaultPlan} />
    </AuthShell>
  );
}
