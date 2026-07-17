/*
  Warnings:

  - You are about to drop the column `shopifyMethodDefinitionId` on the `ShippingMethod` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ShippingMethod" DROP COLUMN "shopifyMethodDefinitionId",
ADD COLUMN     "shopifyMethodDefinitions" TEXT;
