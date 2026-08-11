-- Tabelas do IPTV: M3uPlaylist, M3uGroup e M3uChannel.
--
-- POR QUE ESTA MIGRATION NASCEU DEPOIS DAS OUTRAS MAS TEM DATA ANTERIOR
-- --------------------------------------------------------------------
-- Estas três tabelas — o núcleo do produto — existiam em produção e no
-- schema.prisma, mas em NENHUMA migration. Foram criadas com `prisma db push`,
-- que aplica o schema direto no banco sem deixar registro.
--
-- O efeito prático: `prisma migrate deploy` num banco vazio FALHAVA. A
-- migration 20260810_watchprogress_iptv cria uma foreign key apontando para
-- "M3uChannel", e a tabela não existia. Ou seja: era impossível levantar o
-- projeto do zero a partir do repositório. Para quem clona a primeira vez,
-- isso é a diferença entre "rodou" e "não roda e ninguém sabe por quê".
--
-- Por isso o nome tem timestamp anterior ao da 20260810: o nome do diretório é
-- a chave de ordenação do Prisma, e esta precisa rodar ANTES daquela. Nenhum
-- banco havia aplicado a 20260810 ainda, então não há histórico a reescrever.
--
-- Tudo aqui é idempotente de propósito. Em produção as tabelas já existem e
-- cada comando vira no-op; num banco novo, cria tudo. As duas pontas
-- convergem para o mesmo estado.

-- ---------- Enums ----------
-- Postgres não tem CREATE TYPE IF NOT EXISTS. O bloco abaixo é o equivalente.
DO $$ BEGIN
  CREATE TYPE "M3uSourceType" AS ENUM ('URL', 'XTREAM', 'RAW_TEXT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "M3uSyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- Tabelas ----------
CREATE TABLE IF NOT EXISTS "M3uPlaylist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceType" "M3uSourceType" NOT NULL DEFAULT 'URL',
    "sourceUrl" TEXT,
    "rawContent" TEXT,
    "xtreamServer" TEXT,
    "xtreamUsername" TEXT,
    "xtreamPassword" TEXT,
    "backupSourceUrl" TEXT,
    "backupXtreamServer" TEXT,
    "backupXtreamUsername" TEXT,
    "backupXtreamPassword" TEXT,
    "epgUrl" TEXT,
    "syncStatus" "M3uSyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "autoSyncHours" INTEGER NOT NULL DEFAULT 0,
    "nextSyncAt" TIMESTAMP(3),
    "totalChannels" INTEGER NOT NULL DEFAULT 0,
    "totalGroups" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "M3uPlaylist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "M3uGroup" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "iconUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,

    CONSTRAINT "M3uGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "M3uChannel" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "streamUrl" TEXT NOT NULL,
    "backupStreamUrl" TEXT,
    "logoUrl" TEXT,
    "tvgId" TEXT,
    "tvgName" TEXT,
    "nameKey" TEXT,
    "fromBackup" BOOLEAN NOT NULL DEFAULT false,
    "quality" TEXT,
    "language" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "M3uChannel_pkey" PRIMARY KEY ("id")
);

-- ---------- Colunas que faltam onde a tabela JÁ existe ----------
-- Os CREATE TABLE acima não fazem nada em produção, onde as tabelas já estão
-- de pé. Colunas adicionadas ao schema.prisma depois do `db push` original só
-- chegam lá por ALTER.
--
-- `fromBackup` é o caso concreto que motivou esta migration: o schema.prisma e
-- o lib/iptv/sync-service.ts já usam a coluna, mas o banco de produção não a
-- tem. O próximo deploy do código atual quebraria a sincronização da lista —
-- e o erro apareceria como uma lista de canais vazia, não como uma falha óbvia.
ALTER TABLE "M3uChannel" ADD COLUMN IF NOT EXISTS "fromBackup" BOOLEAN NOT NULL DEFAULT false;

-- ---------- Índices ----------
CREATE UNIQUE INDEX IF NOT EXISTS "M3uPlaylist_userId_key" ON "M3uPlaylist"("userId");
CREATE INDEX IF NOT EXISTS "M3uPlaylist_syncStatus_idx" ON "M3uPlaylist"("syncStatus");
CREATE INDEX IF NOT EXISTS "M3uPlaylist_nextSyncAt_idx" ON "M3uPlaylist"("nextSyncAt");

CREATE INDEX IF NOT EXISTS "M3uGroup_playlistId_sortOrder_idx" ON "M3uGroup"("playlistId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "M3uGroup_playlistId_name_key" ON "M3uGroup"("playlistId", "name");

CREATE INDEX IF NOT EXISTS "M3uChannel_playlistId_groupId_idx" ON "M3uChannel"("playlistId", "groupId");
CREATE INDEX IF NOT EXISTS "M3uChannel_playlistId_isFavorite_idx" ON "M3uChannel"("playlistId", "isFavorite");
CREATE INDEX IF NOT EXISTS "M3uChannel_playlistId_relevanceScore_idx" ON "M3uChannel"("playlistId", "relevanceScore");
-- Índice que casa o MESMO canal entre a lista principal e a de backup.
CREATE INDEX IF NOT EXISTS "M3uChannel_playlistId_nameKey_idx" ON "M3uChannel"("playlistId", "nameKey");
CREATE INDEX IF NOT EXISTS "M3uChannel_name_idx" ON "M3uChannel"("name");

-- ---------- Foreign keys ----------
-- Só adiciona se não existir. Recriar à toa custaria um ACCESS EXCLUSIVE e uma
-- varredura de validação em 60 mil canais, em produção, sem necessidade.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'M3uPlaylist_userId_fkey') THEN
    ALTER TABLE "M3uPlaylist" ADD CONSTRAINT "M3uPlaylist_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'M3uGroup_playlistId_fkey') THEN
    ALTER TABLE "M3uGroup" ADD CONSTRAINT "M3uGroup_playlistId_fkey"
      FOREIGN KEY ("playlistId") REFERENCES "M3uPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'M3uChannel_playlistId_fkey') THEN
    ALTER TABLE "M3uChannel" ADD CONSTRAINT "M3uChannel_playlistId_fkey"
      FOREIGN KEY ("playlistId") REFERENCES "M3uPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'M3uChannel_groupId_fkey') THEN
    ALTER TABLE "M3uChannel" ADD CONSTRAINT "M3uChannel_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "M3uGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
