import { z } from "zod";
import { PROFILE } from "@/lib/constants";
import { ehAvatarValido } from "@/lib/profile/avatars";

/**
 * O avatar tem que estar no catálogo.
 *
 * O campo chega de um `input hidden`, ou seja, é texto que o cliente controla.
 * Sem esta checagem daria para gravar qualquer URL em `Profile.avatarUrl` — e
 * a imagem do perfil passaria a ser carregada de um host arbitrário em toda
 * tela do app.
 */
export const avatarSchema = z
  .string()
  .refine((valor) => valor === "" || ehAvatarValido(valor), "Avatar inválido")
  .optional();

export const profileNameSchema = z
  .string()
  .min(1, "Informe um nome")
  .max(24, "Máximo de 24 caracteres")
  .transform((value) => value.trim());

export const pinSchema = z
  .string()
  .length(PROFILE.PIN_LENGTH, `O PIN precisa ter ${PROFILE.PIN_LENGTH} dígitos`)
  .regex(/^\d+$/, "O PIN deve conter apenas números");

export const createProfileSchema = z.object({
  name: profileNameSchema,
  isKids: z.coerce.boolean().default(false),
  avatarUrl: avatarSchema,
  // Campo vazio no formulário significa "sem PIN", não PIN inválido
  pin: z.union([pinSchema, z.literal("")]).optional(),
});

export const updateProfileSchema = createProfileSchema.extend({
  id: z.string().min(1),
  /** Marca para remover o PIN existente. */
  removePin: z.coerce.boolean().default(false),
});

export const unlockProfileSchema = z.object({
  id: z.string().min(1),
  pin: pinSchema,
});
