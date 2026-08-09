DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verification_tokens' AND column_name='challengeId') THEN 
        ALTER TABLE "verification_tokens" ADD COLUMN "challengeId" TEXT NOT NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_challengeId_key" ON "verification_tokens"("challengeId");

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "sessionId" SET NOT NULL;
