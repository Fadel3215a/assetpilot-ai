-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('image', 'video', 'audio', 'THREE_D', 'other');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'PRODUCTION_READY');

-- CreateEnum
CREATE TYPE "ReviewDecisionType" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'PENDING');

-- CreateEnum
CREATE TYPE "QueuePriority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ComparisonDecisionType" AS ENUM ('PREFER_A', 'PREFER_B', 'KEEP_BOTH', 'REJECT_BOTH');

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('ai', 'curator');

-- CreateEnum
CREATE TYPE "AISuggestionType" AS ENUM ('tag', 'collection', 'observation');

-- CreateEnum
CREATE TYPE "CuratorFeedbackAction" AS ENUM ('accepted', 'edited', 'dismissed');

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "collectionId" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "priority" "QueuePriority" NOT NULL DEFAULT 'medium',
    "currentVersionId" TEXT,
    "usageNotes" TEXT,
    "isSessionUpload" BOOLEAN NOT NULL DEFAULT false,
    "extractedMetadata" JSONB,
    "aiAnalysis" JSONB NOT NULL,
    "aiSessionState" JSONB NOT NULL,
    "productionReadiness" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetVersion" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "thumbnailPath" TEXT NOT NULL,
    "previewPath" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "metadata" JSONB NOT NULL,
    "qualityScore" JSONB NOT NULL,
    "reviewDecision" JSONB NOT NULL,
    "curatorChecklist" JSONB,
    "curatorScore" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionHistoryEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "previousStatus" "AssetStatus" NOT NULL,
    "newStatus" "AssetStatus" NOT NULL,
    "decision" "ReviewDecisionType" NOT NULL,
    "reason" TEXT,
    "curatorScore" INTEGER,

    CONSTRAINT "DecisionHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityItem" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" "ActivitySource" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonRecord" (
    "id" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "itemAAssetId" TEXT NOT NULL,
    "itemAVersionId" TEXT NOT NULL,
    "itemALabel" TEXT NOT NULL,
    "itemBAssetId" TEXT NOT NULL,
    "itemBVersionId" TEXT NOT NULL,
    "itemBLabel" TEXT NOT NULL,
    "decision" "ComparisonDecisionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuratorFeedbackEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "suggestionType" "AISuggestionType" NOT NULL,
    "suggestion" TEXT NOT NULL,
    "curatorAction" "CuratorFeedbackAction" NOT NULL,
    "finalValue" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuratorFeedbackEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IgnoredDuplicate" (
    "duplicateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgnoredDuplicate_pkey" PRIMARY KEY ("duplicateId")
);

-- CreateIndex
CREATE INDEX "Collection_name_idx" ON "Collection"("name");

-- CreateIndex
CREATE INDEX "Asset_collectionId_idx" ON "Asset"("collectionId");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "AssetVersion_assetId_idx" ON "AssetVersion"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetVersion_assetId_versionNumber_key" ON "AssetVersion"("assetId", "versionNumber");

-- CreateIndex
CREATE INDEX "DecisionHistoryEntry_assetId_timestamp_idx" ON "DecisionHistoryEntry"("assetId", "timestamp");

-- CreateIndex
CREATE INDEX "ActivityItem_timestamp_idx" ON "ActivityItem"("timestamp");

-- CreateIndex
CREATE INDEX "ActivityItem_assetId_idx" ON "ActivityItem"("assetId");

-- CreateIndex
CREATE INDEX "ComparisonRecord_timestamp_idx" ON "ComparisonRecord"("timestamp");

-- CreateIndex
CREATE INDEX "CuratorFeedbackEntry_assetId_idx" ON "CuratorFeedbackEntry"("assetId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVersion" ADD CONSTRAINT "AssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionHistoryEntry" ADD CONSTRAINT "DecisionHistoryEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuratorFeedbackEntry" ADD CONSTRAINT "CuratorFeedbackEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
