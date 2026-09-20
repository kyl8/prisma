CREATE TYPE "ActivityVisibility" AS ENUM ('SHARED', 'DISPATCHER_ONLY', 'IMPORTER_ONLY', 'SYSTEM_INTERNAL');
CREATE TYPE "ActivityType" AS ENUM ('REQUEST_CREATED', 'REQUEST_STARTED', 'REQUEST_SUBMITTED', 'PRODUCT_UPDATED', 'PRODUCT_SUBMITTED', 'PRODUCT_APPROVED', 'CORRECTION_REQUESTED', 'CORRECTION_RESOLVED', 'REMINDER_SENT', 'CATALOG_IMPORTED', 'CATALOG_INCONSISTENCY_FOUND');

CREATE TABLE "CustomsBrokerCompanyAccess" (
    "id" TEXT NOT NULL,
    "customsBrokerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomsBrokerCompanyAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "ActivityType" NOT NULL,
    "visibility" "ActivityVisibility" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "productId" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

DROP INDEX "Notification_userId_key";
ALTER TABLE "Notification" ADD COLUMN "entityType" TEXT, ADD COLUMN "entityId" TEXT, ADD COLUMN "readAt" TIMESTAMP(3), ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "CustomsBrokerCompanyAccess_customsBrokerId_companyId_key" ON "CustomsBrokerCompanyAccess"("customsBrokerId", "companyId");
CREATE INDEX "CustomsBrokerCompanyAccess_companyId_idx" ON "CustomsBrokerCompanyAccess"("companyId");
CREATE INDEX "ActivityEvent_companyId_createdAt_idx" ON "ActivityEvent"("companyId", "createdAt");
CREATE INDEX "ActivityEvent_actorUserId_idx" ON "ActivityEvent"("actorUserId");
CREATE INDEX "ActivityEvent_productId_idx" ON "ActivityEvent"("productId");
CREATE INDEX "ActivityEvent_requestId_idx" ON "ActivityEvent"("requestId");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

ALTER TABLE "CustomsBrokerCompanyAccess" ADD CONSTRAINT "CustomsBrokerCompanyAccess_customsBrokerId_fkey" FOREIGN KEY ("customsBrokerId") REFERENCES "customsbroker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomsBrokerCompanyAccess" ADD CONSTRAINT "CustomsBrokerCompanyAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CatalogRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
