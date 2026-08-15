-- Em quais servidores cada conteudo existe, e sob qual endereco em cada um.
--
-- Sem isto o catalogo era uma lista plana sem procedencia: a sincronizacao nao
-- conseguia unificar o mesmo canal vindo de servidores diferentes, e a
-- alocacao de linha mandava o assinante para um servidor que podia nem ter o
-- conteudo pedido -- o "clicou e nao roda" que nao aparecia em log nenhum.
CREATE TABLE IF NOT EXISTS "ChannelSource" (
  "id"         TEXT NOT NULL,
  "channelId"  TEXT NOT NULL,
  "serverCode" TEXT NOT NULL,
  "streamUrl"  TEXT NOT NULL,
  "vistoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChannelSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelSource_channelId_serverCode_key"
  ON "ChannelSource"("channelId", "serverCode");
CREATE INDEX IF NOT EXISTS "ChannelSource_channelId_idx" ON "ChannelSource"("channelId");
CREATE INDEX IF NOT EXISTS "ChannelSource_serverCode_idx" ON "ChannelSource"("serverCode");

DO $$
BEGIN
  ALTER TABLE "ChannelSource"
    ADD CONSTRAINT "ChannelSource_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "M3uChannel"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: o catalogo que ja existe vira fonte do servidor de origem.
--
-- O serverCode e deduzido do HOST da streamUrl cruzado com IptvLine.serverUrl.
-- Sem correspondencia, cai em 'C1' -- e melhor uma fonte atribuida ao servidor
-- principal do que canal sem fonte nenhuma, que ficaria inalcancavel ate a
-- proxima sincronizacao.
INSERT INTO "ChannelSource" ("id", "channelId", "serverCode", "streamUrl", "vistoEm", "criadoEm")
SELECT
  gen_random_uuid()::text,
  c."id",
  COALESCE(
    (
      SELECT l."serverCode"
      FROM "IptvLine" l
      WHERE position(
        split_part(split_part(replace(replace(l."serverUrl", 'http://', ''), 'https://', ''), '/', 1), ':', 1)
        IN c."streamUrl"
      ) > 0
      LIMIT 1
    ),
    'C1'
  ),
  c."streamUrl",
  now(),
  now()
FROM "M3uChannel" c
WHERE c."isActive"
ON CONFLICT ("channelId", "serverCode") DO NOTHING;
