import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ProfileSummary } from "@/types";

export const ACTIVE_PROFILE_COOKIE = "tvhub_profile";
/** Perfis desbloqueados por PIN nesta sessão do navegador. */
export const UNLOCKED_PROFILES_COOKIE = "tvhub_unlocked";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Exige sessão. Redireciona para /login preservando o destino. */
export async function requireUser(returnTo?: string) {
  const user = await getCurrentUser();

  if (!user) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${next}`);
  }

  return user;
}

/**
 * Exige ADMIN.
 * A checagem também existe no middleware, mas é repetida aqui de propósito:
 * o middleware não cobre server actions nem route handlers, então confiar
 * só nele deixaria o CRUD do admin exposto a qualquer sessão autenticada.
 */
export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/inicio");
  }

  return user;
}

export async function listProfiles(userId: string): Promise<ProfileSummary[]> {
  const profiles = await prisma.profile.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      isKids: true,
      maxAgeRating: true,
      pinHash: true,
    },
  });

  // pinHash nunca sai do servidor — o client só precisa saber se existe PIN
  return profiles.map(({ pinHash, ...profile }) => ({
    ...profile,
    hasPin: pinHash !== null,
  }));
}

/**
 * Perfil ativo a partir do cookie.
 *
 * O cookie carrega só o id, e ele é sempre reconferido contra o userId da
 * sessão: trocar o valor do cookie no navegador não dá acesso ao perfil de
 * outra conta.
 */
export async function getActiveProfile(userId: string) {
  const profileId = cookies().get(ACTIVE_PROFILE_COOKIE)?.value;
  if (!profileId) return null;

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      isKids: true,
      maxAgeRating: true,
      pinHash: true,
    },
  });

  if (!profile) return null;

  // Perfil com PIN só vale se foi desbloqueado nesta sessão
  if (profile.pinHash && !isProfileUnlocked(profile.id)) return null;

  const { pinHash, ...safe } = profile;
  return { ...safe, hasPin: pinHash !== null } satisfies ProfileSummary;
}

/** Exige perfil ativo. Manda escolher um quando não há. */
export async function requireProfile(userId: string) {
  const profile = await getActiveProfile(userId);
  if (!profile) redirect("/perfis");
  return profile;
}

export function isProfileUnlocked(profileId: string) {
  const raw = cookies().get(UNLOCKED_PROFILES_COOKIE)?.value;
  if (!raw) return false;
  return raw.split(",").includes(profileId);
}
