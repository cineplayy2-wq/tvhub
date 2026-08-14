"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireUser, ACTIVE_PROFILE_COOKIE, UNLOCKED_PROFILES_COOKIE } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { PROFILE } from "@/lib/constants";
import { fieldErrorsFrom } from "@/lib/validations/auth";
import {
  createProfileSchema,
  unlockProfileSchema,
  updateProfileSchema,
} from "@/lib/validations/profile";

export type ProfileFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** Sinaliza estouro do limite de dentro da transação, para o `catch` traduzir. */
class LimiteDePerfis extends Error {
  constructor() {
    super("Limite de perfis atingido");
    this.name = "LimiteDePerfis";
  }
}

/**
 * `secure` acompanha o ambiente — estava fixo em `false`.
 *
 * Sem a marca, o navegador manda o cookie também em http. Num site que roda em
 * https isso é caminho para downgrade: basta induzir uma única requisição em
 * texto claro (uma imagem, um link) para o cookie viajar legível na rede.
 *
 * O que trafega aqui não é enfeite: `tvhub_unlocked` é a prova de que o PIN de
 * um perfil adulto já foi digitado. Copiado, ele libera esse perfil em outro
 * navegador sem PIN nenhum.
 *
 * Fica `false` só em desenvolvimento, onde não existe https e um cookie
 * `secure` simplesmente não seria gravado.
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// ==========================================================
// SELEÇÃO E DESBLOQUEIO
// ==========================================================

export async function selectProfileAction(profileId: string) {
  const user = await requireUser();

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: user.id },
    select: { id: true, isKids: true, pinHash: true },
  });

  if (!profile) redirect("/perfis");

  // Perfil Kids nunca pede PIN
  if (!profile.isKids && profile.pinHash) redirect(`/perfis?desbloquear=${profile.id}`);

  cookies().set(ACTIVE_PROFILE_COOKIE, profile.id, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30,
  });

  // Perfil Kids entra diretamente no ambiente Infantil (/tv/kids)
  if (profile.isKids) {
    redirect("/tv/kids");
  }

  redirect("/tv");
}

export async function unlockProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const parsed = unlockProfileSchema.safeParse({
    id: formData.get("id"),
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const limit = await rateLimit("pin", `${user.id}:${parsed.data.id}`, 5, 10 * 60);
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return { error: `Muitas tentativas. Aguarde ${minutes} minuto(s).` };
  }

  const profile = await prisma.profile.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true, isKids: true, pinHash: true },
  });

  if (!profile?.pinHash) return { error: "Perfil não encontrado." };

  const isValid = await verifyPassword(parsed.data.pin, profile.pinHash);
  if (!isValid) return { fieldErrors: { pin: "PIN incorreto." } };

  const unlocked = new Set(
    (cookies().get(UNLOCKED_PROFILES_COOKIE)?.value ?? "")
      .split(",")
      .filter(Boolean),
  );
  unlocked.add(profile.id);

  cookies().set(UNLOCKED_PROFILES_COOKIE, [...unlocked].join(","), {
    ...COOKIE_OPTIONS,
  });

  cookies().set(ACTIVE_PROFILE_COOKIE, profile.id, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30,
  });

  if (profile.isKids) {
    redirect("/tv/kids");
  }

  redirect("/tv");
}

export async function switchProfileAction() {
  cookies().delete(ACTIVE_PROFILE_COOKIE);
  redirect("/perfis");
}

// ==========================================================
// CRUD
// ==========================================================

export async function createProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const parsed = createProfileSchema.safeParse({
    name: formData.get("name"),
    isKids: formData.get("isKids") === "on",
    avatarUrl: formData.get("avatarUrl") ?? "",
    pin: formData.get("pin") ?? "",
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { name, isKids, avatarUrl, pin } = parsed.data;

  // O hash é caro (bcrypt) e não pode rodar dentro da transação: seguraria a
  // linha do usuário pelo tempo do cálculo, multiplicando o risco de conflito.
  const pinHash = isKids ? null : pin ? await hashPassword(pin) : null;

  try {
    /**
     * Contar e depois criar é uma janela de corrida.
     *
     * Entre o `count()` e o `create()` não havia nada segurando o estado: dois
     * envios simultâneos do formulário liam a mesma contagem, os dois passavam
     * pela checagem e os dois criavam. O limite de perfis por conta — que é o
     * que sustenta a regra comercial de telas — virava sugestão.
     *
     * `Serializable` faz o Postgres abortar uma das transações concorrentes
     * quando elas dependem da mesma leitura, e o Prisma devolve isso como
     * P2034. Aí basta pedir para tentar de novo: na segunda passada a
     * contagem já enxerga o perfil da primeira e o limite é respeitado.
     */
    await prisma.$transaction(
      async (tx) => {
        const count = await tx.profile.count({ where: { userId: user.id } });
        if (count >= PROFILE.MAX_PER_ACCOUNT) {
          throw new LimiteDePerfis();
        }

        await tx.profile.create({
          data: {
            userId: user.id,
            name,
            isKids,
            avatarUrl: avatarUrl || null,
            maxAgeRating: isKids ? PROFILE.KIDS_MAX_AGE_RATING : "EIGHTEEN",
            pinHash,
            sortOrder: count,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof LimiteDePerfis) {
      return { error: `Limite de ${PROFILE.MAX_PER_ACCOUNT} perfis por conta.` };
    }

    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "P2002") {
        return { fieldErrors: { name: "Você já tem um perfil com esse nome." } };
      }
      // Conflito de serialização: outra criação simultânea ganhou a corrida.
      if (error.code === "P2034") {
        return { error: "Tente novamente." };
      }
    }
    throw error;
  }

  revalidatePath("/perfis");
  return {};
}

export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    isKids: formData.get("isKids") === "on",
    avatarUrl: formData.get("avatarUrl") ?? "",
    pin: formData.get("pin") ?? "",
    removePin: formData.get("removePin") === "on",
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { id, name, isKids, avatarUrl, pin, removePin } = parsed.data;

  const result = await prisma.profile.updateMany({
    where: { id, userId: user.id },
    data: {
      name,
      isKids,
      ...(avatarUrl ? { avatarUrl } : {}),
      maxAgeRating: isKids ? PROFILE.KIDS_MAX_AGE_RATING : "EIGHTEEN",
      ...(isKids || removePin
        ? { pinHash: null }
        : pin
          ? { pinHash: await hashPassword(pin) }
          : {}),
    },
  });

  if (result.count === 0) return { error: "Perfil não encontrado." };

  revalidatePath("/perfis");
  return {};
}

export async function deleteProfileAction(profileId: string) {
  const user = await requireUser();

  const count = await prisma.profile.count({ where: { userId: user.id } });
  if (count <= 1) return;

  await prisma.profile.deleteMany({
    where: { id: profileId, userId: user.id },
  });

  if (cookies().get(ACTIVE_PROFILE_COOKIE)?.value === profileId) {
    cookies().delete(ACTIVE_PROFILE_COOKIE);
  }

  revalidatePath("/perfis");
}
