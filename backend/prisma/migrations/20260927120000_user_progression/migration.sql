-- CreateEnum
CREATE TYPE "ProgressionAction" AS ENUM ('CAPTURE', 'ASK', 'RECALL', 'FREEZE');

-- CreateTable
CREATE TABLE "user_progression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "keeps" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TEXT,
    "freezeTokens" INTEGER NOT NULL DEFAULT 0,
    "equippedTitle" TEXT,
    "equippedAura" TEXT,
    "leaderboardVisible" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_progression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progression_events" (
    "id" TEXT NOT NULL,
    "progressionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "action" "ProgressionAction" NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "keepsAwarded" INTEGER NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "bonus" BOOLEAN NOT NULL DEFAULT false,
    "freezeUsed" INTEGER NOT NULL DEFAULT 0,
    "streakAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progression_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progression_unlocks" (
    "id" TEXT NOT NULL,
    "progressionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "streakGated" BOOLEAN NOT NULL DEFAULT true,
    "streakAtUnlock" INTEGER NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progression_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progression_peers" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progression_peers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_progression_userId_key" ON "user_progression"("userId");

-- CreateIndex
CREATE INDEX "user_progression_leaderboardVisible_xp_idx" ON "user_progression"("leaderboardVisible", "xp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "progression_events_progressionId_idempotencyKey_key" ON "progression_events"("progressionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "progression_events_progressionId_createdAt_idx" ON "progression_events"("progressionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "progression_unlocks_progressionId_key_key" ON "progression_unlocks"("progressionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "progression_peers_ownerId_peerId_key" ON "progression_peers"("ownerId", "peerId");

-- CreateIndex
CREATE INDEX "progression_peers_ownerId_idx" ON "progression_peers"("ownerId");

-- AddForeignKey
ALTER TABLE "user_progression" ADD CONSTRAINT "user_progression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_events" ADD CONSTRAINT "progression_events_progressionId_fkey" FOREIGN KEY ("progressionId") REFERENCES "user_progression"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_unlocks" ADD CONSTRAINT "progression_unlocks_progressionId_fkey" FOREIGN KEY ("progressionId") REFERENCES "user_progression"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_peers" ADD CONSTRAINT "progression_peers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_peers" ADD CONSTRAINT "progression_peers_peerId_fkey" FOREIGN KEY ("peerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
