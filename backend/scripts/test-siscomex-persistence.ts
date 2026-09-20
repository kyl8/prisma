/** Real PostgreSQL integration check. All fixtures and side effects are rolled back. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import { loadSiscomexConfig, SiscomexClient } from "../src/modules/siscomex/siscomex.client";
import { SiscomexService } from "../src/modules/siscomex/siscomex.service";

const rollback = new Error("SISCOMEX_TEST_ROLLBACK");
async function main() {
  const suffix = randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      const broker = await tx.user.create({ data: { name: "SISCOMEX transaction test", email: `siscomex-broker-${suffix}@example.invalid`, cnpj: "00000000000000", enterprise: "Test", custbrok: { create: {} } }, include: { custbrok: true } });
      const importer = await tx.user.create({ data: { name: "SISCOMEX transaction test", email: `siscomex-importer-${suffix}@example.invalid`, cnpj: "44555666000181", enterprise: "Test", importer: { create: {} } }, include: { importer: true } });
      const companyId = importer.importer!.id;
      await tx.customsBrokerCompanyAccess.create({ data: { customsBrokerId: broker.custbrok!.id, companyId } });
      const product = await tx.product.create({ data: { importerId: companyId, name: `SISCOMEX persistence test ${suffix}`, code: `SISCOMEX-${suffix}`, ncm: "22042100", completeness: "0%", status: "Ativo", updatedAt: new Date() } });
      const db = { ...tx, $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx) } as unknown as PrismaClient;
      const service = new SiscomexService(db, new SiscomexClient(loadSiscomexConfig({ SISCOMEX_ENABLED: "true", SISCOMEX_CLIENT_ID: "test", SISCOMEX_CLIENT_SECRET: "test" }), async (url) => {
        if (String(url).includes("autenticar")) return new Response("{}", { headers: { "set-token": "test-jwt", "x-csrf-token": "test-csrf" } });
        if (String(url).includes("atributo-ncm")) return Response.json([{ codigo: "ATT_TEST", nome: "Test attribute", obrigatorio: true }]);
        return Response.json({ codigo: 42, versao: "1", cpfCnpjRaiz: "44555666", denominacao: "Official test product", ncm: "22042100", atributos: [] });
      }));
      const input = { productCode: "42", version: "1", operationMode: "IMPORTACAO" as const };
      await service.sync(broker.id, companyId, product.id, input);
      await service.sync(broker.id, companyId, product.id, input);
      const comparison = await service.comparison(broker.id, companyId, product.id);
      assert.equal(comparison?.diff.conflictCount, 1);
      assert.equal(comparison?.diff.missingRequiredAttributes.length, 1);
      assert.equal(await tx.siscomexSnapshot.count({ where: { companyId } }), 2);
      assert.equal(await tx.siscomexSyncRun.count({ where: { companyId } }), 2);
      assert.equal(await tx.activityEvent.count({ where: { companyId } }), 1, "Repeated identical comparison must not duplicate activity");
      assert.equal(await tx.notification.count({ where: { userId: broker.id } }), 1);
      assert.deepEqual(await tx.product.findUnique({ where: { id: product.id } }), product, "Official reads must not update local product");
      await assert.rejects(service.catalog(importer.id, companyId), { code: "FORBIDDEN" });
      console.log("PASS: real PostgreSQL snapshots, cache, comparison, access, audit, notification deduplication and unchanged product");
      throw rollback;
    }, { timeout: 20000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal(await prisma.user.count({ where: { email: { endsWith: `${suffix}@example.invalid` } } }), 0);
  console.log("PASS: rollback confirmed; no test data remains in the database");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Persistence check failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
