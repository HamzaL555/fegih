-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountTierPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
