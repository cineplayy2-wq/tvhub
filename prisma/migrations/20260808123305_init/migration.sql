-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "VideoQuality" AS ENUM ('SD', 'HD', 'FULL_HD', 'UHD_4K');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('PIX_PROVIDER', 'MERCADO_PAGO', 'ASAAS', 'STRIPE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'BOLETO', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('MOVIE', 'SERIES');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AgeRating" AS ENUM ('L', 'TEN', 'TWELVE', 'FOURTEEN', 'SIXTEEN', 'EIGHTEEN');

-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('BUNNY', 'MUX', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "StreamEndReason" AS ENUM ('STOPPED', 'HEARTBEAT_TIMEOUT', 'REVOKED_BY_USER', 'LIMIT_EXCEEDED', 'ADMIN_REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerified" TIMESTAMP(3),
    "externalCustomerId" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isKids" BOOLEAN NOT NULL DEFAULT false,
    "maxAgeRating" "AgeRating" NOT NULL DEFAULT 'EIGHTEEN',
    "pinHash" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "interval" "PlanInterval" NOT NULL,
    "compareAtPriceCents" INTEGER,
    "deviceLimit" INTEGER NOT NULL DEFAULT 2,
    "maxProfiles" INTEGER NOT NULL DEFAULT 4,
    "maxQuality" "VideoQuality" NOT NULL DEFAULT 'FULL_HD',
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "externalProductId" TEXT,
    "externalPriceId" TEXT,
    "features" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "externalSubscriptionId" TEXT,
    "externalCustomerId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "nextChargeAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'PIX_PROVIDER',
    "method" "PaymentMethod" NOT NULL DEFAULT 'PIX',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "pixTxId" TEXT,
    "pixQrCodeUrl" TEXT,
    "pixCopyPaste" TEXT,
    "pixExpiresAt" TIMESTAMP(3),
    "invoiceUrl" TEXT,
    "description" TEXT,
    "failureCode" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Title" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "type" "ContentType" NOT NULL DEFAULT 'MOVIE',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "logoUrl" TEXT,
    "trailerUrl" TEXT,
    "videoProvider" "VideoProvider" NOT NULL DEFAULT 'BUNNY',
    "videoProviderId" TEXT,
    "videoUrl" TEXT,
    "videoStatus" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "durationSeconds" INTEGER,
    "releaseYear" INTEGER,
    "ageRating" "AgeRating" NOT NULL DEFAULT 'L',
    "director" TEXT,
    "cast" TEXT[],
    "tags" TEXT[],
    "country" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "synopsis" TEXT,
    "thumbnailUrl" TEXT,
    "videoProvider" "VideoProvider" NOT NULL DEFAULT 'BUNNY',
    "videoProviderId" TEXT,
    "videoUrl" TEXT,
    "videoStatus" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "durationSeconds" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "episodeId" TEXT,
    "itemKey" TEXT NOT NULL,
    "positionSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastWatched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "profileId" TEXT,
    "titleId" TEXT,
    "episodeId" TEXT,
    "deviceId" TEXT,
    "deviceLabel" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" "StreamEndReason",

    CONSTRAINT "StreamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GenreToTitle" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalCustomerId_key" ON "User"("externalCustomerId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_name_key" ON "Profile"("userId", "name");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_externalPriceId_key" ON "Plan"("externalPriceId");

-- CreateIndex
CREATE INDEX "Plan_isActive_sortOrder_idx" ON "Plan"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_externalSubscriptionId_key" ON "Subscription"("externalSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Subscription_nextChargeAt_idx" ON "Subscription"("nextChargeAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalId_key" ON "Payment"("externalId");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_pixTxId_idx" ON "Payment"("pixTxId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_gateway_externalId_key" ON "WebhookEvent"("gateway", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Title_slug_key" ON "Title"("slug");

-- CreateIndex
CREATE INDEX "Title_status_publishedAt_idx" ON "Title"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Title_status_popularity_idx" ON "Title"("status", "popularity");

-- CreateIndex
CREATE INDEX "Title_status_isFeatured_idx" ON "Title"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "Title_status_ageRating_idx" ON "Title"("status", "ageRating");

-- CreateIndex
CREATE INDEX "Title_type_idx" ON "Title"("type");

-- CreateIndex
CREATE INDEX "Title_name_idx" ON "Title"("name");

-- CreateIndex
CREATE INDEX "Episode_titleId_idx" ON "Episode"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_titleId_season_number_key" ON "Episode"("titleId", "season", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_isActive_sortOrder_idx" ON "Collection"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CollectionItem_titleId_idx" ON "CollectionItem"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_titleId_key" ON "CollectionItem"("collectionId", "titleId");

-- CreateIndex
CREATE INDEX "WatchlistItem_titleId_idx" ON "WatchlistItem"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_profileId_titleId_key" ON "WatchlistItem"("profileId", "titleId");

-- CreateIndex
CREATE INDEX "WatchProgress_profileId_lastWatched_idx" ON "WatchProgress"("profileId", "lastWatched");

-- CreateIndex
CREATE INDEX "WatchProgress_titleId_idx" ON "WatchProgress"("titleId");

-- CreateIndex
CREATE INDEX "WatchProgress_episodeId_idx" ON "WatchProgress"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_profileId_itemKey_key" ON "WatchProgress"("profileId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "StreamSession_sessionId_key" ON "StreamSession"("sessionId");

-- CreateIndex
CREATE INDEX "StreamSession_userId_isActive_idx" ON "StreamSession"("userId", "isActive");

-- CreateIndex
CREATE INDEX "StreamSession_lastSeenAt_idx" ON "StreamSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "StreamSession_profileId_idx" ON "StreamSession"("profileId");

-- CreateIndex
CREATE INDEX "StreamSession_titleId_idx" ON "StreamSession"("titleId");

-- CreateIndex
CREATE INDEX "StreamSession_episodeId_idx" ON "StreamSession"("episodeId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "_GenreToTitle_AB_unique" ON "_GenreToTitle"("A", "B");

-- CreateIndex
CREATE INDEX "_GenreToTitle_B_index" ON "_GenreToTitle"("B");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToTitle" ADD CONSTRAINT "_GenreToTitle_A_fkey" FOREIGN KEY ("A") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToTitle" ADD CONSTRAINT "_GenreToTitle_B_fkey" FOREIGN KEY ("B") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
