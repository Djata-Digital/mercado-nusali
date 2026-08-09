-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'TRADEMARK_REGISTRATION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'BRAND_AUTHORIZATION';

-- AlterTable seller_documents
ALTER TABLE "seller_documents" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable store_invitations safely for existing data
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_invitations' AND column_name = 'tokenHash') THEN
        ALTER TABLE "store_invitations" ADD COLUMN "tokenHash" TEXT;
        
        -- Mark all existing PENDING invitations as EXPIRED (legacy invitations must be reissued)
        UPDATE "store_invitations" SET "status" = 'EXPIRED' WHERE "status" = 'PENDING';

        -- Set dummy unique tokenHash for legacy rows
        UPDATE "store_invitations" SET "tokenHash" = 'EXPIRED_' || "id" WHERE "tokenHash" IS NULL;

        ALTER TABLE "store_invitations" ALTER COLUMN "tokenHash" SET NOT NULL;
    END IF;
END $$;

ALTER TABLE "store_invitations" DROP COLUMN IF EXISTS "token";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "store_invitations_tokenHash_key" ON "store_invitations"("tokenHash");
