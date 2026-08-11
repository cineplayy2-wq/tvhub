import { z } from "zod";
import { PROFILE } from "@/lib/constants";

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
