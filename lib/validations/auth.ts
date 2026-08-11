import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, "Informe seu e-mail")
  .transform((value) => value.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(1, "Informe sua senha");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  otpCode: z.string().optional(),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Informe seu nome")
      .max(80, "Nome muito longo")
      .transform((value) => value.trim()),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha"),
    plan: z.enum(["mensal", "anual"]).default("anual"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.errors) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}
