-- Corrective migration: Ensure partial unique index filters out NULL stockReservationItemIds safely
DROP INDEX IF EXISTS "picking_items_active_stock_reservation_idx";
CREATE UNIQUE INDEX "picking_items_active_stock_reservation_idx"
ON "picking_items" ("stockReservationItemId")
WHERE "status" NOT IN ('CANCELLED') AND "stockReservationItemId" IS NOT NULL;
