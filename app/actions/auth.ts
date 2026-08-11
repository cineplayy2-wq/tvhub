"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { z } from "zod";

import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { fieldErrorsFrom, emailSchema } from "@/lib/validations/auth";
import { sendOtpEmail } from "@/lib/email";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  requiresOtp?: boolean;
  email?: string;
  password?: string;
  next?: string;
};

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/perfis";
}

const DEFAULT_AUTH_PASS = "cineplay2026";

// ==========================================================
// AUTENTICAÇÃO E-MAIL + SENHA + CÓDIGO OTP POR E-MAIL (SMTP)
// ==========================================================

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    const rawEmail = formData.get("email");
    const rawPassword = formData.get("password") as string | null;
    const otpCode = (formData.get("otpCode") as string | null)?.trim();
    const nextTarget = safeNext(formData.get("next"));

    const emailParsed = emailSchema.safeParse(rawEmail);
    if (!emailParsed.success) {
      return { fieldErrors: { email: "Informe um e-mail válido." } };
    }

    const email = emailParsed.data;
    const password = rawPassword?.trim() || DEFAULT_AUTH_PASS;

    // Rate-limit por e-mail (fail-open)
    try {
      const limit = await rateLimit("login", email, 30, 15 * 60);
      if (!limit.allowed) {
        const minutes = Math.ceil(limit.retryAfterSeconds / 60);
        return {
          error: `Muitas tentativas. Tente novamente em ${minutes} minuto${minutes > 1 ? "s" : ""}.`,
        };
      }
    } catch {}

    // 1. Busca ou cria usuário e atualiza a senha digitada no banco
    const hashedPassword = await hashPassword(password);
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      const userName = email.split("@")[0] || "Cliente";
      user = await prisma.user.create({
        data: {
          email,
          name: userName,
          password: hashedPassword,
          profiles: {
            create: { name: userName, sortOrder: 0 },
          },
        },
        select: { id: true, email: true, name: true, role: true },
      });
    } else {
      // Sempre atualiza o hash da senha para garantir login via NextAuth
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });
      } catch (err) {
        console.warn("[Password Update DB Warning]", err);
      }
    }

    // 2. ETAPA 1: Enviar Código de 6 Dígitos por E-mail (SMTP)
    if (!otpCode) {
      const code = String(Math.floor(100000 + Math.random() * 900000));

      try {
        await prisma.verificationToken.deleteMany({
          where: { identifier: email },
        });

        await prisma.verificationToken.create({
          data: {
            identifier: email,
            token: code,
            expires: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
      } catch (err) {
        console.warn("[Token DB Warning]", err);
      }

      // Envia e-mail em segundo plano via Gmail SMTP (cineplayy7@gmail.com)
      sendOtpEmail(email, code, user.name).catch((err) => {
        console.error("[SMTP Error] Falha ao enviar e-mail OTP:", err);
      });

      return {
        requiresOtp: true,
        email,
        password,
        next: nextTarget,
      };
    }

    // 3. ETAPA 2: Validação do Código de 6 Dígitos
    let tokenRecord = null;
    try {
      tokenRecord = await prisma.verificationToken.findFirst({
        where: {
          identifier: email,
          token: otpCode,
          expires: { gt: new Date() },
        },
      });
    } catch {}

    // Código do e-mail OU códigos mestre de acesso imediato: 123456 / 000000
    const isValidOtp = !!tokenRecord || otpCode === "123456" || otpCode === "000000";

    if (!isValidOtp) {
      return {
        requiresOtp: true,
        email,
        password,
        next: nextTarget,
        error: "Código de verificação incorreto. Confira seu e-mail ou digite 123456.",
      };
    }

    try {
      await prisma.verificationToken.deleteMany({
        where: { identifier: email },
      });
    } catch {}

    const destination = user.role === "ADMIN" && nextTarget === "/perfis" ? "/admin" : nextTarget;

    // Conclui o login com NextAuth v5
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: destination,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return {
          requiresOtp: true,
          email,
          password,
          error: "Falha ao iniciar sessão. Tente novamente.",
        };
      }
      throw error;
    }

    return {};
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as any).digest === "string" &&
      (error as any).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("[loginAction Error]:", error);
    return { error: "Erro ao conectar. Tente novamente." };
  }
}

// ==========================================================
// CADASTRO
// ==========================================================

export async function registerAction(
  prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  return loginAction(prevState, formData);
}

// ==========================================================
// REENVIAR CÓDIGO OTP POR E-MAIL (SMTP)
// ==========================================================

export async function resendOtpAction(email: string, password?: string): Promise<AuthFormState> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  const code = String(Math.floor(100000 + Math.random() * 900000));

  try {
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: code,
        expires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
  } catch {}

  await sendOtpEmail(email, code, user?.name);

  return {
    requiresOtp: true,
    email,
    password,
  };
}

// ==========================================================
// LOGOUT
// ==========================================================

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
