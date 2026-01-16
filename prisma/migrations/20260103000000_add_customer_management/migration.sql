-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "CustomerTagType" AS ENUM ('PREFERRED', 'VIP', 'BLACKLIST', 'FRAUD_RISK', 'HIGH_VALUE', 'COMPLAINT', 'LOYAL', 'NEW', 'CUSTOM');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "dni" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "segment" TEXT,
    "preferredChannel" "Channel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tags" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CustomerTagType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_normalizedPhone_key" ON "customers"("normalizedPhone");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_normalizedPhone_idx" ON "customers"("normalizedPhone");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customers_createdAt_idx" ON "customers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tags_customerId_type_label_key" ON "customer_tags"("customerId", "type", "label");

-- CreateIndex
CREATE INDEX "customer_tags_customerId_idx" ON "customer_tags"("customerId");

-- CreateIndex
CREATE INDEX "customer_tags_type_idx" ON "customer_tags"("type");

-- CreateIndex
CREATE INDEX "customer_notes_customerId_idx" ON "customer_notes"("customerId");

-- CreateIndex
CREATE INDEX "customer_notes_createdAt_idx" ON "customer_notes"("createdAt");

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
