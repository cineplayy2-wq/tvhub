import { z } from "zod";

export const m3uPlaylistSchema = z
  .object({
    userId: z.string().min(1, "Selecione um cliente"),
    label: z.string().trim().min(1, "Informe um nome para a lista").max(120),
    sourceType: z.enum(["URL", "XTREAM", "RAW_TEXT"]),
    sourceUrl: z
      .string()
      .trim()
      .url("Informe uma URL válida")
      .nullable()
      .optional(),
    rawContent: z.string().trim().nullable().optional(),
    xtreamServer: z
      .string()
      .trim()
      .url("Informe a URL do servidor")
      .nullable()
      .optional(),
    xtreamUsername: z.string().trim().nullable().optional(),
    xtreamPassword: z.string().trim().nullable().optional(),
    autoSyncHours: z.coerce.number().int().min(0).max(168).default(0),

    // Campos da Lista de Backup (Secundária para Failover)
    backupSourceUrl: z.string().trim().nullable().optional(),
    backupXtreamServer: z.string().trim().nullable().optional(),
    backupXtreamUsername: z.string().trim().nullable().optional(),
    backupXtreamPassword: z.string().trim().nullable().optional(),

    // Guia de programação (XMLTV). Opcional: a lista funciona sem EPG.
    epgUrl: z.string().trim().url("Informe uma URL de EPG válida").nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "URL" && !data.sourceUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a URL da lista M3U",
        path: ["sourceUrl"],
      });
    }
    if (data.sourceType === "RAW_TEXT" && !data.rawContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cole o conteúdo da lista M3U",
        path: ["rawContent"],
      });
    }
    if (data.sourceType === "XTREAM") {
      if (!data.xtreamServer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o servidor Xtream",
          path: ["xtreamServer"],
        });
      }
      if (!data.xtreamUsername) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o username Xtream",
          path: ["xtreamUsername"],
        });
      }
      if (!data.xtreamPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a senha Xtream",
          path: ["xtreamPassword"],
        });
      }
    }
  });

export type M3uPlaylistInput = z.infer<typeof m3uPlaylistSchema>;
