-- Step 1: Clean up any legacy orphaned picking items where stockReservationItemId or inventoryItemId is NULL
DELETE FROM "picking_items" WHERE "stockReservationItemId" IS NULL OR "inventoryItemId" IS NULL;

-- Step 2: Alter columns to NOT NULL
ALTER TABLE "picking_items" ALTER COLUMN "stockReservationItemId" SET NOT NULL;
ALTER TABLE "picking_items" ALTER COLUMN "inventoryItemId" SET NOT NULL;

-- Step 3: Partial Unique Index in PostgreSQL to guarantee that active PickingItems cannot share a stockReservationItemId
DROP INDEX IF EXISTS "picking_items_active_stock_reservation_idx";
CREATE UNIQUE INDEX "picking_items_active_stock_reservation_idx"
ON "picking_items" ("stockReservationItemId")
WHERE "status" NOT IN ('CANCELLED');
