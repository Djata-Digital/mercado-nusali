-- AlterTable
ALTER TABLE "picking_items" ADD COLUMN "stockReservationItemId" TEXT,
ADD COLUMN "inventoryItemId" TEXT;

-- CreateIndex
CREATE INDEX "picking_items_stockReservationItemId_idx" ON "picking_items"("stockReservationItemId");
CREATE INDEX "picking_items_inventoryItemId_idx" ON "picking_items"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "picking_items" ADD CONSTRAINT "picking_items_stockReservationItemId_fkey" FOREIGN KEY ("stockReservationItemId") REFERENCES "stock_reservation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "picking_items" ADD CONSTRAINT "picking_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
