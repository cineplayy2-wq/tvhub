-- Progresso de reprodução para conteúdo IPTV.
--
-- Antes: titleId era NOT NULL e apontava para o catálogo próprio (tabela
-- Title), que está vazia nesta instalação. Toda gravação de progresso era
-- descartada, e o "continuar assistindo" nunca tinha o que mostrar.
--
-- Depois: titleId vira opcional e entra channelId, apontando para o canal da
-- lista IPTV, que é o que o assinante realmente assiste.
BEGIN;

ALTER TABLE "WatchProgress" ALTER COLUMN "titleId" DROP NOT NULL;

ALTER TABLE "WatchProgress" ADD COLUMN IF NOT EXISTS "channelId" TEXT;

CREATE INDEX IF NOT EXISTS "WatchProgress_channelId_idx"
  ON "WatchProgress"("channelId");

ALTER TABLE "WatchProgress"
  DROP CONSTRAINT IF EXISTS "WatchProgress_channelId_fkey";

ALTER TABLE "WatchProgress"
  ADD CONSTRAINT "WatchProgress_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "M3uChannel"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
