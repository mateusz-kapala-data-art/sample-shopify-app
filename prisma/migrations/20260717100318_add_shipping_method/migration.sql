-- CreateTable
CREATE TABLE "ShippingMethod" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceAmount" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "conditionOperator" TEXT,
    "conditionAmount" DECIMAL(10,2),
    "shopifyMethodDefinitionId" TEXT,
    "shopifyProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingMethod_shop_idx" ON "ShippingMethod"("shop");
