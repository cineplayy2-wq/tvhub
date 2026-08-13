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

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
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

  const count = await prisma.profile.count({ where: { userId: user.id } });
  if (count >= PROFILE.MAX_PER_ACCOUNT) {
    return { error: `Limite de ${PROFILE.MAX_PER_ACCOUNT} perfis por conta.` };
  }

  const { name, isKids, avatarUrl, pin } = parsed.data;

  try {
    await prisma.profile.create({
      data: {
        userId: user.id,
        name,
        isKids,
        avatarUrl: avatarUrl || null,
        maxAgeRating: isKids ? PROFILE.KIDS_MAX_AGE_RATING : "EIGHTEEN",
        pinHash: isKids ? null : pin ? await hashPassword(pin) : null,
        sortOrder: count,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return { fieldErrors: { name: "Você já tem um perfil com esse nome." } };
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
