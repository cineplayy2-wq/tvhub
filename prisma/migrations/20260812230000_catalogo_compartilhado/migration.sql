-- Catálogo compartilhado: permissões por cliente e favoritos por perfil.
-- Só adiciona. Nada é removido — o código antigo continua lendo os campos
-- legados até o deploy da virada.

-- Módulo adulto no usuário (fonte da verdade daqui pra frente).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adultUnlocked" BOOLEAN NOT NULL DEFAULT false;

-- Marca o catálogo do sistema (um só, compartilhado).
ALTER TABLE "M3uPlaylist" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "M3uPlaylist_isSystem_idx" ON "M3uPlaylist"("isSystem");

-- Travas de categoria por assinante.
CREATE TABLE IF NOT EXISTS "UserCategoryLock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCategoryLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserCategoryLock_userId_category_key"
  ON "UserCategoryLock"("userId", "category");
CREATE INDEX IF NOT EXISTS "UserCategoryLock_userId_idx"
  ON "UserCategoryLock"("userId");

DO $$ BEGIN
  ALTER TABLE "UserCategoryLock"
    ADD CONSTRAINT "UserCategoryLock_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Favoritos IPTV por perfil.
CREATE TABLE IF NOT EXISTS "ChannelFavorite" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelFavorite_profileId_channelId_key"
  ON "ChannelFavorite"("profileId", "channelId");
CREATE INDEX IF NOT EXISTS "ChannelFavorite_channelId_idx"
  ON "ChannelFavorite"("channelId");

DO $$ BEGIN
  ALTER TABLE "ChannelFavorite"
    ADD CONSTRAINT "ChannelFavorite_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChannelFavorite"
    ADD CONSTRAINT "ChannelFavorite_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "M3uChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: a playlist existente vira o catálogo do sistema.
UPDATE "M3uPlaylist" SET "isSystem" = true
 WHERE id = (SELECT id FROM "M3uPlaylist" ORDER BY "createdAt" ASC LIMIT 1);

-- Copia o módulo adulto da playlist para o usuário dono.
UPDATE "User" AS u
   SET "adultUnlocked" = p."adultUnlocked"
  FROM "M3uPlaylist" AS p
 WHERE p."userId" = u.id
   AND p."adultUnlocked" = true;

-- Copia as travas de categoria que hoje estão em M3uGroup.isHidden
-- (exceto adulto, que continua higiene global do grupo).
INSERT INTO "UserCategoryLock" ("id", "userId", "category", "createdAt")
SELECT gen_random_uuid()::text, p."userId", g.category, now()
  FROM "M3uGroup" g
  JOIN "M3uPlaylist" p ON p.id = g."playlistId"
 WHERE g."isHidden" = true
   AND g.category IS NOT NULL
   AND g.category <> 'adult'
 GROUP BY p."userId", g.category
ON CONFLICT ("userId", "category") DO NOTHING;

-- Copia favoritos do canal para o primeiro perfil do dono da playlist.
-- É o melhor que dá sem tabela histórica de quem favoritou o quê.
INSERT INTO "ChannelFavorite" ("id", "profileId", "channelId", "createdAt")
SELECT gen_random_uuid()::text, pr.id, c.id, now()
  FROM "M3uChannel" c
  JOIN "M3uPlaylist" p ON p.id = c."playlistId"
  JOIN LATERAL (
    SELECT id FROM "Profile"
     WHERE "userId" = p."userId"
     ORDER BY "sortOrder" ASC, "createdAt" ASC
     LIMIT 1
  ) pr ON true
 WHERE c."isFavorite" = true
ON CONFLICT ("profileId", "channelId") DO NOTHING;
