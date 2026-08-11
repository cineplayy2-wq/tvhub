-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "tmdbId" INTEGER,
ADD COLUMN     "tmdbRating" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "Title_tmdbId_key" ON "Title"("tmdbId");