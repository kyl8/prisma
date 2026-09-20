-- Existing requests establish a real broker-to-company relationship. This is idempotent
-- and intentionally does not grant access to unrelated companies.
INSERT INTO "CustomsBrokerCompanyAccess" ("id", "customsBrokerId", "companyId", "createdAt")
SELECT CONCAT('access_', md5(cr."createdById" || cr."companyId")), cb."id", cr."companyId", CURRENT_TIMESTAMP
FROM "CatalogRequest" cr
JOIN "customsbroker" cb ON cb."userId" = cr."createdById"
ON CONFLICT ("customsBrokerId", "companyId") DO NOTHING;
