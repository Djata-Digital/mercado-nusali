-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='password_reset_tokens' AND column_name='token') THEN 
        ALTER TABLE "password_reset_tokens" RENAME COLUMN "token" TO "tokenHash";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verification_tokens' AND column_name='token') THEN 
        ALTER TABLE "verification_tokens" RENAME COLUMN "token" TO "tokenHash";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verification_tokens' AND column_name='attempts') THEN 
        ALTER TABLE "verification_tokens" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verification_tokens' AND column_name='usedAt') THEN 
        ALTER TABLE "verification_tokens" ADD COLUMN "usedAt" TIMESTAMP(3);
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'refresh_tokens_sessionId_fkey') THEN 
        ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
