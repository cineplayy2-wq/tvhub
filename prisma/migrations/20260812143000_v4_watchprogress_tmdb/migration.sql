-- AlterTable
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WatchProgress" ADD COLUMN IF NOT EXISTS "tmdbId" INTEGER,
ADD COLUMN IF NOT EXISTS "tmdbMediaType" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WatchProgress_profileId_tmdbId_idx" ON "WatchProgress"("profileId", "tmdbId");
