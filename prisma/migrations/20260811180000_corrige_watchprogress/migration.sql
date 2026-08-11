-- Acerta o WatchProgress com o schema.prisma.
--
-- Duas divergências que só existiam porque o deploy aplicava ALTER TABLE na
-- mão, direto no banco, fora do controle das migrations.

-- ---------- 1. watchCount ----------
-- A coluna foi criada pelo script de deploy como `INTEGER DEFAULT 1`, sem o
-- NOT NULL que o schema.prisma declara (`Int @default(1)`). Um Prisma que
-- espera Int e recebe null quebra na leitura, não na escrita — o erro apareceria
-- longe da causa.
ALTER TABLE "WatchProgress" ADD COLUMN IF NOT EXISTS "watchCount" INTEGER DEFAULT 1;
UPDATE "WatchProgress" SET "watchCount" = 1 WHERE "watchCount" IS NULL;
ALTER TABLE "WatchProgress" ALTER COLUMN "watchCount" SET DEFAULT 1;
ALTER TABLE "WatchProgress" ALTER COLUMN "watchCount" SET NOT NULL;

-- ---------- 2. WatchProgress → M3uChannel: CASCADE vira SET NULL ----------
-- Este é um bug de perda de dados que está ativo em produção.
--
-- O schema.prisma declara `onDelete: SetNull`, mas a foreign key no banco está
-- como ON DELETE CASCADE. Toda sincronização da lista IPTV apaga os canais que
-- sumiram do provedor — e com CASCADE o Postgres apaga junto as linhas de
-- WatchProgress daqueles canais. Ou seja: a cada sync, o "continuar assistindo"
-- do assinante perde histórico em silêncio, sem erro em log nenhum.
--
-- Com SET NULL a linha de progresso sobrevive com channelId nulo, que é
-- exatamente o motivo de channelId ser opcional no schema.
ALTER TABLE "WatchProgress" DROP CONSTRAINT IF EXISTS "WatchProgress_channelId_fkey";
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "M3uChannel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
