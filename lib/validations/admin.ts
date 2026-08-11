import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  // Aceita caminho interno (/uploads/...) e URL absoluta; vazio vira null
  .refine(
    (value) => value === "" || value.startsWith("/") || /^https?:\/\//.test(value),
    "Informe uma URL válida",
  )
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

/** "ação, drama" → ["acao", "drama"] no client; aqui chegam os slugs. */
const slugList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .default("");

export const titleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Informe o título").max(160),
  slug: z
    .string()
    .trim()
    .min(1, "Informe o slug")
    .max(160)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use apenas letras minúsculas, números e hífens",
    ),
  synopsis: z.string().trim().min(1, "Informe a sinopse").max(4000),
  type: z.enum(["MOVIE", "SERIES"]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),

  posterUrl: optionalUrl,
  backdropUrl: optionalUrl,
  logoUrl: optionalUrl,
  trailerUrl: optionalUrl,

  videoProvider: z.enum(["BUNNY", "MUX", "EXTERNAL"]).default("BUNNY"),
  videoProviderId: optionalText,
  videoUrl: optionalUrl,
  videoStatus: z.enum(["PENDING", "PROCESSING", "READY", "ERROR"]),

  releaseYear: z.coerce
    .number()
    .int()
    .min(1888, "Ano inválido") // primeiro filme registrado
    .max(new Date().getFullYear() + 5, "Ano muito no futuro")
    .nullable()
    .optional(),
  durationSeconds: z.coerce.number().int().min(0).nullable().optional(),
  ageRating: z.enum(["L", "TEN", "TWELVE", "FOURTEEN", "SIXTEEN", "EIGHTEEN"]),
  director: optionalText,
  country: optionalText,

  // Vazio vira null, não 0 — 0 é um tmdbId válido em tese e criaria colisão
  // no índice único assim que dois títulos fossem salvos sem TMDB.
  tmdbId: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
    .transform((value) => (value === "" || value === null ? null : value))
    .optional(),
  tmdbRating: z
    .union([z.coerce.number().min(0).max(10), z.literal(""), z.null()])
    .transform((value) => (value === "" || value === null ? null : value))
    .optional(),
  originalName: optionalText,

  genres: slugList,
  cast: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .default(""),

  isFeatured: z.coerce.boolean().default(false),
  popularity: z.coerce.number().int().min(0).max(10000).default(0),
});

export const episodeSchema = z.object({
  id: z.string().optional(),
  titleId: z.string().min(1),
  season: z.coerce.number().int().min(1, "Temporada inválida"),
  number: z.coerce.number().int().min(1, "Episódio inválido"),
  name: z.string().trim().min(1, "Informe o nome").max(160),
  synopsis: optionalText,
  thumbnailUrl: optionalUrl,
  videoProviderId: optionalText,
  videoUrl: optionalUrl,
  videoStatus: z.enum(["PENDING", "PROCESSING", "READY", "ERROR"]),
  durationSeconds: z.coerce.number().int().min(0).nullable().optional(),
});

export const blockUserSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().max(280).optional(),
});

export type TitleInput = z.infer<typeof titleSchema>;
export type EpisodeInput = z.infer<typeof episodeSchema>;
