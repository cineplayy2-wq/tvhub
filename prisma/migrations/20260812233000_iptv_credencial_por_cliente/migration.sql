-- Credencial IPTV por assinante. Só adiciona.
-- O catálogo continua único; cada cliente leva a própria linha no provedor.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "iptvUsername" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "iptvPassword" TEXT;

-- Backfill: quem já era dono técnico da playlist herda a linha da M3U,
-- para o play não quebrar no dia da virada.
UPDATE "User" AS u
   SET "iptvUsername" = coalesce(
         u."iptvUsername",
         p."xtreamUsername",
         substring(p."sourceUrl" from 'username=([^&]+)'),
         substring(p."backupSourceUrl" from 'username=([^&]+)')
       ),
       "iptvPassword" = coalesce(
         u."iptvPassword",
         p."xtreamPassword",
         substring(p."sourceUrl" from 'password=([^&]+)'),
         substring(p."backupSourceUrl" from 'password=([^&]+)')
       )
  FROM "M3uPlaylist" AS p
 WHERE p."userId" = u.id
   AND (p."isSystem" = true OR p."sourceUrl" IS NOT NULL OR p."xtreamUsername" IS NOT NULL);
