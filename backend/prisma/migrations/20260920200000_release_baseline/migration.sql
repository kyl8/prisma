-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ActivityVisibility" AS ENUM ('SHARED', 'DISPATCHER_ONLY', 'IMPORTER_ONLY', 'SYSTEM_INTERNAL');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('REQUEST_CREATED', 'REQUEST_STARTED', 'REQUEST_SUBMITTED', 'PRODUCT_UPDATED', 'PRODUCT_SUBMITTED', 'PRODUCT_APPROVED', 'CORRECTION_REQUESTED', 'CORRECTION_RESOLVED', 'REMINDER_SENT', 'CATALOG_IMPORTED', 'CATALOG_INCONSISTENCY_FOUND');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enterprise" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("userId","credentialID")
);

-- CreateTable
CREATE TABLE "Importer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Importer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customsbroker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL DEFAULT 'Não informada',

    CONSTRAINT "customsbroker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomsBrokerCompanyAccess" (
    "id" TEXT NOT NULL,
    "customsBrokerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomsBrokerCompanyAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "importerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ncm" TEXT NOT NULL,
    "completeness" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "identifierStatus" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductField" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdFieldResp" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "response" TEXT NOT NULL,

    CONSTRAINT "ProdFieldResp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identifier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "duimpId" TEXT NOT NULL,

    CONSTRAINT "Identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
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

-- CreateTable
CREATE TABLE "CatalogRequestProduct" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "CatalogRequestProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");

-- CreateIndex
CREATE UNIQUE INDEX "Importer_userId_key" ON "Importer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "customsbroker_userId_key" ON "customsbroker"("userId");

-- CreateIndex
CREATE INDEX "CustomsBrokerCompanyAccess_companyId_idx" ON "CustomsBrokerCompanyAccess"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomsBrokerCompanyAccess_customsBrokerId_companyId_key" ON "CustomsBrokerCompanyAccess"("customsBrokerId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Identifier_productId_key" ON "Identifier"("productId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogRequest_tokenHash_key" ON "CatalogRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "CatalogRequest_companyId_status_idx" ON "CatalogRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "CatalogRequest_expiresAt_idx" ON "CatalogRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_companyId_createdAt_idx" ON "ActivityEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorUserId_idx" ON "ActivityEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "ActivityEvent_productId_idx" ON "ActivityEvent"("productId");

-- CreateIndex
CREATE INDEX "ActivityEvent_requestId_idx" ON "ActivityEvent"("requestId");

-- CreateIndex
CREATE INDEX "CatalogRequestProduct_productId_idx" ON "CatalogRequestProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogRequestProduct_requestId_productId_key" ON "CatalogRequestProduct"("requestId", "productId");

-- CreateIndex
CREATE INDEX "CatalogRequestResponse_productId_fieldKey_idx" ON "CatalogRequestResponse"("productId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogRequestResponse_requestId_productId_fieldKey_key" ON "CatalogRequestResponse"("requestId", "productId", "fieldKey");

-- CreateIndex
CREATE INDEX "SiscomexSnapshot_scope_resource_date_idx" ON "SiscomexSnapshot"("companyId", "environment", "resourceType", "resourceKey", "fetchedAt");

-- CreateIndex
CREATE INDEX "SiscomexSyncRun_companyId_environment_finishedAt_idx" ON "SiscomexSyncRun"("companyId", "environment", "finishedAt");

-- CreateIndex
CREATE INDEX "SiscomexSyncRun_productId_environment_finishedAt_idx" ON "SiscomexSyncRun"("productId", "environment", "finishedAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Importer" ADD CONSTRAINT "Importer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customsbroker" ADD CONSTRAINT "customsbroker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomsBrokerCompanyAccess" ADD CONSTRAINT "CustomsBrokerCompanyAccess_customsBrokerId_fkey" FOREIGN KEY ("customsBrokerId") REFERENCES "customsbroker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomsBrokerCompanyAccess" ADD CONSTRAINT "CustomsBrokerCompanyAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "Importer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductField" ADD CONSTRAINT "ProductField_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdFieldResp" ADD CONSTRAINT "ProdFieldResp_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ProductField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdFieldResp" ADD CONSTRAINT "ProdFieldResp_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogRequest" ADD CONSTRAINT "CatalogRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogRequest" ADD CONSTRAINT "CatalogRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CatalogRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogRequestProduct" ADD CONSTRAINT "CatalogRequestProduct_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CatalogRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogRequestProduct" ADD CONSTRAINT "CatalogRequestProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogRequestResponse" ADD CONSTRAINT "CatalogRequestResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CatalogRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogRequestResponse" ADD CONSTRAINT "CatalogRequestResponse_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiscomexSnapshot" ADD CONSTRAINT "SiscomexSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiscomexSyncRun" ADD CONSTRAINT "SiscomexSyncRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Importer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiscomexSyncRun" ADD CONSTRAINT "SiscomexSyncRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;


