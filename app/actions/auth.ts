"use server";

import { randomInt } from "node:crypto";

import { AuthError } from "next-auth";
import { cookies, headers } from "next/headers";
import { z } from "zod";

import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";
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

/**
 * Senha em branco não vira senha padrão.
 *
 * Havia aqui `const DEFAULT_AUTH_PASS = "cineplay2026"`, usado sempre que o
 * campo chegava vazio. Duas consequências: toda conta criada sem senha nascia
 * com uma senha PÚBLICA (está no repositório), e qualquer pessoa entrava
 * nelas sabendo só o e-mail. Campo vazio agora é erro de validação.
 */
const MIN_SENHA = 6;

// ==========================================================
// AUTENTICAÇÃO E-MAIL + SENHA + CÓDIGO OTP POR E-MAIL (SMTP)
// ==========================================================

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
  /** Cadastro pode CRIAR conta; login, não. Ver a nota dentro da função. */
  isRegistro = false,
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
    const password = rawPassword?.trim() ?? "";

    if (password.length < MIN_SENHA) {
      return {
        email,
        fieldErrors: { password: `A senha precisa ter ao menos ${MIN_SENHA} caracteres.` },
      };
    }
    // Teto contra corpo gigante em rota pública; bcrypt só usa os 72 primeiros
    // bytes de qualquer forma.
    if (password.length > 200) {
      return { email, fieldErrors: { password: "Senha longa demais." } };
    }

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

    /**
     * ====================================================================
     * A SENHA É CONFERIDA. NUNCA SOBRESCRITA.
     * ====================================================================
     *
     * O que havia aqui era um desvio COMPLETO da autenticação:
     *
     *     const hashedPassword = await hashPassword(password);
     *     if (!user) { criar conta }
     *     else { await prisma.user.update({ data: { password: hashedPassword } }) }
     *
     * Ou seja: qualquer pessoa digitando o e-mail de OUTRO assinante e uma
     * senha qualquer tinha a senha da vítima TROCADA pela dela, e entrava na
     * conta. Sem exploração, sem ferramenta — pelo formulário de login.
     *
     * Valia para o ADMIN também: bastava saber o e-mail do administrador para
     * assumir o painel inteiro, com acesso a todos os clientes e credenciais.
     *
     * Agora a senha digitada é COMPARADA com o hash guardado, e o registro só
     * cria conta quando o cadastro é explícito.
     *
     * MIGRAÇÃO: quem está no banco sem senha (conta criada pelo fluxo antigo,
     * ou importada) tem a primeira senha digitada GRAVADA e entra. É um
     * caminho de mão única — a partir daí a conta exige aquela senha. Sem
     * isso, ligar esta verificação trancaria para fora todo mundo que nunca
     * definiu senha de verdade.
     */
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, password: true, status: true },
    });

    if (!user) {
      if (!isRegistro) {
        // Mensagem idêntica à de senha errada: dizer "conta não existe"
        // entrega a lista de clientes a quem testar endereços.
        return { email, error: "E-mail ou senha inválidos." };
      }

      const userName = email.split("@")[0] || "Cliente";
      const hashedPassword = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          email,
          name: userName,
          password: hashedPassword,
          profiles: {
            create: { name: userName, sortOrder: 0 },
          },
        },
        select: { id: true, email: true, name: true, role: true, password: true, status: true },
      });
    } else if (!user.password) {
      // Conta legada sem senha: adota a primeira digitada (ver MIGRAÇÃO acima).
      const hashedPassword = await hashPassword(password);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });
    } else {
      const confere = await verifyPassword(password, user.password);
      if (!confere) {
        return { email, error: "E-mail ou senha inválidos." };
      }
    }

    if (user.status === "BLOCKED") {
      return { email, error: "Esta conta está bloqueada. Fale com o suporte." };
    }

    const destination = user.role === "ADMIN" && nextTarget === "/perfis" ? "/admin" : nextTarget;

    // Login direto e imediato com e-mail e senha
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: destination,
      });
      return {};
    } catch (error) {
      if (error instanceof AuthError) {
        return {
          email,
          password,
          error: "Falha ao iniciar sessão. Verifique suas credenciais.",
        };
      }
      throw error;
    }
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
  return loginAction(prevState, formData, true);
}

// ==========================================================
// REENVIAR CÓDIGO OTP POR E-MAIL (SMTP)
// ==========================================================

export async function resendOtpAction(email: string, password?: string): Promise<AuthFormState> {
  const alvo = typeof email === "string" ? email.trim().toLowerCase().slice(0, 254) : "";
  if (!alvo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alvo)) {
    // Resposta idêntica à do caminho feliz: ver a nota sobre enumeração abaixo.
    return { requiresOtp: true, email: String(email ?? ""), password };
  }

  /**
   * Server action é endpoint público — e esta manda e-mail.
   *
   * Sem teto, um laço aqui é três coisas ao mesmo tempo: bombardeio na caixa
   * de entrada de qualquer pessoa cujo endereço o atacante conheça, esgotamento
   * da cota de envio da conta SMTP (derrubando o OTP de TODOS os assinantes) e
   * escrita ilimitada em `verificationToken`.
   *
   * O limite é por e-mail e por hora, com um teto global para o caso de o
   * atacante variar o destinatário a cada tentativa.
   */
  const porEmail = await rateLimit("otp", alvo, 5, 60 * 60);
  const global = await rateLimit("otp-global", "todos", 200, 60 * 60);
  if (!porEmail.allowed || !global.allowed) {
    return { requiresOtp: true, email: alvo, password };
  }

  const user = await prisma.user.findUnique({
    where: { email: alvo },
    select: { id: true, email: true, name: true },
  });

  /**
   * `Math.random()` NÃO serve para gerar código de acesso.
   *
   * Ele é previsível: conhecendo algumas saídas dá para reconstruir o estado
   * interno do gerador e prever os próximos códigos. Como este código autoriza
   * entrar na conta, ele precisa vir do gerador criptográfico do sistema.
   */
  const code = String(randomInt(100000, 1000000));

  try {
    await prisma.verificationToken.deleteMany({
      where: { identifier: alvo },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: alvo,
        token: code,
        expires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
  } catch {}

  /**
   * Só envia para quem existe — mas a RESPOSTA é sempre a mesma.
   *
   * Enviar para endereço desconhecido é spam em nome do produto. Já responder
   * de forma diferente quando a conta não existe entrega uma lista de clientes
   * a quem tiver paciência de testar endereços. A resposta idêntica nos dois
   * casos fecha essa porta; a falha de envio fica no log do servidor.
   */
  if (user) {
    try {
      await sendOtpEmail(alvo, code, user.name);
    } catch (erro) {
      console.error("[auth] falha ao enviar OTP:", erro);
    }
  }

  return {
    requiresOtp: true,
    email: alvo,
    password,
  };
}

// ==========================================================
// ALTERAR SENHA DO USUÁRIO
// ==========================================================

export async function updatePasswordAction(
  _prevState: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const newPassword = (formData.get("newPassword") as string)?.trim();
  const confirmPassword = (formData.get("confirmPassword") as string)?.trim();

  if (!newPassword || newPassword.length < 6) {
    return { error: "A nova senha deve ter no mínimo 6 caracteres." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "As senhas digitadas não coincidem." };
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return { success: "Senha alterada com sucesso!" };
}

// ==========================================================
// LOGOUT TOTAL (LIMPEZA COMPLETA DE SESSÃO E COOKIES)
// ==========================================================

export async function logoutAction() {
  try {
    const cookieStore = cookies();
    cookieStore.delete("authjs.session-token");
    cookieStore.delete("__Secure-authjs.session-token");
    cookieStore.delete("tvhub_profile");
    cookieStore.delete("__Host-authjs.csrf-token");
    cookieStore.delete("authjs.csrf-token");
    cookieStore.delete("authjs.callback-url");
    cookieStore.delete("__Secure-authjs.callback-url");
  } catch {}

  await signOut({ redirectTo: "/login" });
}
