-- CreateTable
CREATE TABLE "CatalogRequest" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "kind" TEXT NOT NULL DEFAULT 'fill',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "CatalogRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogRequestProduct" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "CatalogRequestProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogRequestResponse" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "CatalogRequestResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogRequest_tokenHash_key" ON "CatalogRequest"("tokenHash");
CREATE INDEX "CatalogRequest_companyId_status_idx" ON "CatalogRequest"("companyId", "status");
CREATE INDEX "CatalogRequest_expiresAt_idx" ON "CatalogRequest"("expiresAt");
CREATE INDEX "CatalogRequestProduct_productId_idx" ON "CatalogRequestProduct"("productId");
CREATE UNIQUE INDEX "CatalogRequestProduct_requestId_productId_key" ON "CatalogRequestProduct"("requestId", "productId");
CREATE INDEX "CatalogRequestResponse_productId_fieldKey_idx" ON "CatalogRequestResponse"("productId", "fieldKey");
CREATE UNIQUE INDEX "CatalogRequestResponse_requestId_productId_fieldKey_key" ON "CatalogRequestResponse"("requestId", "productId", "fieldKey");

ALTER TABLE "CatalogRequest" ADD CONSTRAINT "CatalogRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogRequest" ADD CONSTRAINT "CatalogRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogRequestProduct" ADD CONSTRAINT "CatalogRequestProduct_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CatalogRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogRequestProduct" ADD CONSTRAINT "CatalogRequestProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogRequestResponse" ADD CONSTRAINT "CatalogRequestResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CatalogRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogRequestResponse" ADD CONSTRAINT "CatalogRequestResponse_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
