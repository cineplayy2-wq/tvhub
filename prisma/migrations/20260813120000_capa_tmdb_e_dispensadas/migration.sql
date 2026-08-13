-- Cache de arte do TMDB no próprio canal.
--
-- O cruzamento com o TMDB era refeito a cada renderização, com teto de 24
-- itens por trilha; o que passava do teto ficava sem capa, porque VOD de M3U
-- quase nunca traz tvg-logo. Gravando o resultado, a busca acontece uma vez
-- por título e a listagem seguinte sai do banco.
ALTER TABLE "M3uChannel"
  ADD COLUMN IF NOT EXISTS "tmdbId"          INTEGER,
  ADD COLUMN IF NOT EXISTS "tmdbMediaType"   TEXT,
  ADD COLUMN IF NOT EXISTS "tmdbPosterUrl"   TEXT,
  ADD COLUMN IF NOT EXISTS "tmdbBackdropUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "tmdbRating"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "tmdbYear"        INTEGER,
  ADD COLUMN IF NOT EXISTS "tmdbOverview"    TEXT,
  ADD COLUMN IF NOT EXISTS "tmdbSyncedAt"    TIMESTAMP(3);

-- Serve para varrer o que ainda não foi consultado sem escanear a tabela toda.
CREATE INDEX IF NOT EXISTS "M3uChannel_playlistId_tmdbSyncedAt_idx"
  ON "M3uChannel"("playlistId", "tmdbSyncedAt");

-- Recomendações dispensadas, por perfil.
--
-- O "x" das trilhas de sugestão gravava só em localStorage: sumia ao trocar de
-- aparelho e voltava a recomendar o mesmo título. Aqui a dispensa é do PERFIL,
-- não do navegador. Guarda o canal quando ele existe e sempre o `itemKey`
-- normalizado — a lista do provedor recria IDs na sincronização, e sem a chave
-- estável a dispensa se perderia junto.
CREATE TABLE IF NOT EXISTS "DismissedRecommendation" (
  "id"        TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "itemKey"   TEXT NOT NULL,
  "channelId" TEXT,
  "tmdbId"    INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DismissedRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DismissedRecommendation_profileId_itemKey_key"
  ON "DismissedRecommendation"("profileId", "itemKey");

CREATE INDEX IF NOT EXISTS "DismissedRecommendation_profileId_idx"
  ON "DismissedRecommendation"("profileId");

DO $$
BEGIN
  ALTER TABLE "DismissedRecommendation"
    ADD CONSTRAINT "DismissedRecommendation_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
