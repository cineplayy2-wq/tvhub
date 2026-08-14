import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar",
  // Telas de sessão nunca devem aparecer em busca
  robots: { index: false, follow: false },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre para continuar de onde parou."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-medium text-accent transition-colors hover:text-primary-hover"
          >
            Assine agora
          </Link>
        </>
      }
    >
      <LoginForm next={searchParams.next} />
    </AuthShell>
  );
}
