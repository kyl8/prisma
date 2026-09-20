CREATE TABLE "SiscomexSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "subsystem" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiscomexSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SiscomexSyncRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "result" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiscomexSyncRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SiscomexSnapshot_scope_resource_date_idx"
    ON "SiscomexSnapshot"("companyId", "environment", "resourceType", "resourceKey", "fetchedAt");
CREATE INDEX "SiscomexSyncRun_companyId_environment_finishedAt_idx" ON "SiscomexSyncRun"("companyId", "environment", "finishedAt");
CREATE INDEX "SiscomexSyncRun_productId_environment_finishedAt_idx" ON "SiscomexSyncRun"("productId", "environment", "finishedAt");
ALTER TABLE "SiscomexSnapshot" ADD CONSTRAINT "SiscomexSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiscomexSyncRun" ADD CONSTRAINT "SiscomexSyncRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiscomexSyncRun" ADD CONSTRAINT "SiscomexSyncRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
