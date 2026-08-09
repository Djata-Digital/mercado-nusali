-- AlterTable
ALTER TABLE "carrier_accounts" ADD COLUMN     "providerType" TEXT;

-- AlterTable
ALTER TABLE "carriers" ADD COLUMN     "providerType" TEXT NOT NULL DEFAULT 'GENERIC';

-- AlterTable
ALTER TABLE "picking_items" ALTER COLUMN "stockReservationItemId" DROP NOT NULL,
ALTER COLUMN "inventoryItemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "hub_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ledger_entries_credit_idx" RENAME TO "ledger_entries_creditAccount_idx";

-- RenameIndex
ALTER INDEX "ledger_entries_debit_idx" RENAME TO "ledger_entries_debitAccount_idx";

-- RenameIndex
ALTER INDEX "ledger_entries_ref_idx" RENAME TO "ledger_entries_referenceType_referenceId_idx";

-- RenameIndex
ALTER INDEX "wallet_transactions_ref_idx" RENAME TO "wallet_transactions_referenceType_referenceId_idx";
