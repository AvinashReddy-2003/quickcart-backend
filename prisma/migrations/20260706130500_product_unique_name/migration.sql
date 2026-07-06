-- Enforce one product name per store; enables safe upsert-by-(storeId,name).
CREATE UNIQUE INDEX "products_storeId_name_key" ON "products"("storeId", "name");
