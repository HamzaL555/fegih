-- Lifeline scope: SESSION (once per game) vs QUESTION (granted per question).
-- The unique index is what makes 50/50, skip and extra time appear only on the
-- question they belong to.
CREATE TYPE "LifelineScope" AS ENUM ('SESSION', 'QUESTION');

ALTER TABLE "GameLifeline" ADD COLUMN "scope" "LifelineScope" NOT NULL DEFAULT 'SESSION';

-- Drop the old one-per-session-per-type constraint: per-question lifelines need
-- one row per (question, type).
DROP INDEX "QuizSessionLifeline_sessionId_type_key";

ALTER TABLE "QuizSessionLifeline" ADD COLUMN "questionId" TEXT;
CREATE INDEX "QuizSessionLifeline_questionId_idx" ON "QuizSessionLifeline"("questionId");
CREATE UNIQUE INDEX "QuizSessionLifeline_sessionId_questionId_type_key" ON "QuizSessionLifeline"("sessionId", "questionId", "type");
ALTER TABLE "QuizSessionLifeline" ADD CONSTRAINT "QuizSessionLifeline_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SessionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Skip and extra time only make sense for the question in front of the player.
UPDATE "GameLifeline" SET "scope" = 'QUESTION' WHERE "type" IN ('SKIP', 'EXTRA_TIME');

-- Backfill: one copy of every per-question lifeline for every question already
-- in a running session, so in-progress games keep their lifelines.
INSERT INTO "QuizSessionLifeline" ("id", "sessionId", "questionId", "type", "status", "cost", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, sq."sessionId", sq."id", gl."type", 'AVAILABLE', gl."cost", NOW(), NOW()
FROM "SessionQuestion" sq
JOIN "QuizSession" qs ON qs."id" = sq."sessionId"
JOIN "GameLifeline" gl ON gl."gameId" = qs."gameId" AND gl."scope" = 'QUESTION'
WHERE qs."status" = 'IN_PROGRESS'
  AND NOT EXISTS (
    SELECT 1 FROM "QuizSessionLifeline" e
    WHERE e."sessionId" = sq."sessionId" AND e."type" = gl."type" AND e."questionId" IS NULL
  );