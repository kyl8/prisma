import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@/generated/prisma/client";
import { cachedResource, freshness } from "./siscomex.cache";
import { digits, loadSiscomexConfig, productVersion, redactPayload, SiscomexClient, SiscomexError, type Transport } from "./siscomex.client";
import { canonicalJson, compareProduct, mapNcm, mapOperator, mapProduct, mapRequirements, type LocalProduct } from "./siscomex.mapping";
import { SiscomexService } from "./siscomex.service";

const config = (extra: Record<string, string> = {}) => loadSiscomexConfig({ SISCOMEX_ENABLED: "true", SISCOMEX_CLIENT_ID: "test-client", SISCOMEX_CLIENT_SECRET: "test-secret", ...extra });
const response = (body: unknown, status = 200, headers = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const authResponse = () => response({}, 200, { "set-token": "test-jwt", "x-csrf-token": "test-csrf" });
const official = { codigo: 42, versao: "1", cpfCnpjRaiz: "44555666", denominacao: "Vinho tinto", ncm: "22042100", situacao: "ATIVADO", atributos: [{ atributo: "ATT_1", valor: false }], atributosMultivalorados: [{ atributo: "ATT_2", valores: ["01", "02"] }] };
const local: LocalProduct = { id: "product-a", name: "Vinho tinto", ncm: "2204.21.00", fields: [{ key: "ATT_1", label: "Envelhecido", value: "false" }, { key: "ATT_2", label: "Categorias", value: '["01","02"]' }] };

test("configuration defaults disabled, gates production, bounds retries and timeout", () => {
  const disabled = loadSiscomexConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.environment, "validation");
  assert.throws(() => config({ SISCOMEX_ENV: "production" }), /ALLOW_PRODUCTION/);
  assert.equal(config({ SISCOMEX_ENV: "production", SISCOMEX_ALLOW_PRODUCTION: "true" }).baseUrl, "https://portalunico.siscomex.gov.br");
  assert.throws(() => config({ SISCOMEX_ENV: "fake" }));
  assert.throws(() => config({ SISCOMEX_TIMEOUT_MS: "999999" }));
  assert.equal(config({ SISCOMEX_MAX_SERVER_RETRIES: "0" }).maxServerRetries, 0);
});

test("disabled integration and unsafe paths never reach the transport", async () => {
  let calls = 0;
  const transport: Transport = async () => { calls++; return response({}); };
  const disabled = new SiscomexClient(loadSiscomexConfig({}), transport);
  await assert.rejects(disabled.getNomenclature(), { code: "SISCOMEX_NOT_CONFIGURED" });
  const enabled = new SiscomexClient(config(), transport);
  for (const path of ["https://evil.test/", "//evil.test", "/catp/api/ext/../admin", "/catp/api/ext/\\evil"]) await assert.rejects(enabled.request({ path }), { code: "INVALID_INPUT" });
  assert.equal(calls, 0);
  assert.equal(digits("44.555.666/0001-81", [14], "CNPJ"), "44555666000181");
  assert.throws(() => digits("letters22042100", [8], "NCM"));
  assert.throws(() => productVersion("../1"));
});

test("only authentication POSTs; session rotation and single 401 reauthentication", async () => {
  let authCalls = 0;
  let getCalls = 0;
  const client = new SiscomexClient(config(), async (url, init) => {
    assert.equal(init?.redirect, "error");
    if (String(url).includes("autenticar")) {
      authCalls++;
      assert.equal(init?.method, "POST");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Client-Secret"), "test-secret");
      return response({}, 200, { "set-token": `jwt-${authCalls}`, "x-csrf-token": `csrf-${authCalls}` });
    }
    getCalls++;
    assert.equal(init?.method, "GET");
    const headers = new Headers(init?.headers);
    assert.equal(headers.has("Client-Secret"), false);
    if (getCalls === 1) return response({}, 401);
    assert.equal(headers.get("Authorization"), getCalls === 2 ? "jwt-2" : "rotated-jwt");
    return response(official, 200, { "set-token": "rotated-jwt", "x-csrf-token": "rotated-csrf" });
  });
  await client.getProduct("44555666", "42", "1");
  await client.getProduct("44555666", "42", "1");
  assert.equal(authCalls, 2); assert.equal(getCalls, 3);
});

test("concurrent requests serialize rotating session headers", async () => {
  let inFlight = 0; let maxInFlight = 0; let authCalls = 0;
  const client = new SiscomexClient(config(), async (url) => {
    if (String(url).includes("autenticar")) { authCalls++; return authResponse(); }
    inFlight++; maxInFlight = Math.max(inFlight, maxInFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    return response([]);
  });
  await Promise.all([client.listProducts("44555666"), client.listOperators("44555666")]);
  assert.equal(maxInFlight, 1); assert.equal(authCalls, 1);
});

test("transient 503 retries once; rate limit code does not retry; no body secrets leak", async () => {
  let calls = 0;
  const client = new SiscomexClient(config(), async (url) => {
    if (String(url).includes("autenticar")) return authResponse();
    calls++;
    return calls === 1 ? response({}, 503) : response(null, 204);
  });
  assert.equal(await client.getAttributes("22042100"), null); assert.equal(calls, 2);
  let rateCalls = 0;
  const limited = new SiscomexClient(config(), async (url) => {
    if (String(url).includes("autenticar")) return authResponse();
    rateCalls++;
    return response({ code: "PUCX-ER1001", message: "secret=DO_NOT_EXPOSE", other: "private upstream body" }, 422);
  });
  await assert.rejects(limited.listProducts("44555666"), (error: unknown) => error instanceof SiscomexError && error.code === "SISCOMEX_RATE_LIMITED" && !error.message.includes("DO_NOT_EXPOSE"));
  assert.equal(rateCalls, 1);
});

test("auth timeout is bounded, public nomenclature has no credentials", async () => {
  const timeout = new SiscomexClient(config({ SISCOMEX_TIMEOUT_MS: "5" }), async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  }));
  await assert.rejects(timeout.testConnection(), { code: "SISCOMEX_TIMEOUT" });
  const publicClient = new SiscomexClient(config(), async (_url, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.has("Authorization"), false); assert.equal(headers.has("Client-Secret"), false);
    return response({ Nomenclaturas: [] });
  });
  await publicClient.getNomenclature();
});

test("mapping preserves false, zero, multivalued and compound official attributes", () => {
  const mapped = mapProduct({ ...official, atributosCompostos: [{ atributo: "ATT_3", valores: [{ atributo: "ATT_4", valor: 0 }] }] });
  assert.equal(mapped.productCode, "0000000042");
  assert.equal(mapped.attributes[0].value, false);
  assert.deepEqual(mapped.attributes[1].value, ["01", "02"]);
  assert.equal(mapped.attributes[2].compound, true);
  assert.deepEqual(mapped.attributes[2].value, [{ atributo: "ATT_4", valor: 0 }]);
  assert.throws(() => mapProduct({}));
  assert.equal(mapOperator({ codigo: "OP_1", nome: "Fabricante" }).name, "Fabricante");
  assert.equal(mapNcm({ Nomenclaturas: [{ Codigo: "2204.21.00", Descricao: "Vinhos" }] }, "22042100")?.description, "Vinhos");
});

test("comparison normalizes NCM and JSON, conditional requirements are not mandatory gaps", () => {
  const requirements = mapRequirements([{ codigo: "ATT_10", nome: "Requerido", obrigatorio: "true", condicionados: [{ atributo: { codigo: "ATT_11", nome: "Condicional" }, obrigatorio: true, condicao: "ATT_10=1" }] }, { codigo: "ATT_12", nome: "Opcional", obrigatorio: "false" }]);
  const result = compareProduct(local, mapProduct(official), requirements);
  assert.equal(result.conflictCount, 0);
  assert.equal(result.missingRequiredAttributes.length, 1);
  assert.equal(result.conditionalAttributes.length, 1);
  assert.equal(requirements.find((item) => item.code === "ATT_12")?.required, false);
  assert.equal(result.catalogChanged, false); assert.equal(result.classificationAssigned, false);
  const changed = compareProduct({ ...local, ncm: "85011019", fields: [] }, mapProduct({ ...official, situacao: "DESATIVADO" }), requirements);
  assert.equal(changed.conflictCount, 1); assert.equal(changed.inactive, true);
});

test("freshness and stale fallback do not hide forbidden, missing or malformed data", async () => {
  const latest = { fetchedAt: new Date(1000), payload: { source: "official" } };
  assert.equal(freshness(latest.fetchedAt, 60, 2000), "FRESH");
  assert.equal(freshness(latest.fetchedAt, 60, 62000), "STALE");
  assert.equal(freshness("invalid", 60), "STALE");
  const fallback = await cachedResource({ latest, ttl: 1, force: true, fetchAndSave: async () => { throw new SiscomexError("SISCOMEX_TIMEOUT", "timeout", 504, true); } });
  assert.equal(fallback.cacheStatus, "STALE"); assert.equal(fallback.unavailableReason, "SISCOMEX_TIMEOUT");
  for (const code of ["SISCOMEX_ACCESS_DENIED", "SISCOMEX_NOT_FOUND", "SISCOMEX_INVALID_RESPONSE"]) {
    await assert.rejects(cachedResource({ latest, ttl: 1, force: true, fetchAndSave: async () => { throw new SiscomexError(code, "failure"); } }), { code });
  }
  const cached = await cachedResource({ latest: { fetchedAt: new Date() }, ttl: 60, fetchAndSave: async () => { throw new Error("must not fetch"); } });
  assert.equal(cached.fromCache, true);
});

test("recursive payload redaction", () => {
  assert.deepEqual(redactPayload({ Authorization: "private", nested: [{ "Client-Secret": "secret", value: 0 }] }), { Authorization: "[REDACTED]", nested: [{ "Client-Secret": "[REDACTED]", value: 0 }] });
});

test("audit comparison ignores PostgreSQL JSONB object key ordering", () => {
  assert.equal(canonicalJson({ z: { b: 2, a: 1 }, a: [false, 0] }), canonicalJson({ a: [false, 0], z: { a: 1, b: 2 } }));
  assert.notEqual(canonicalJson({ a: false }), canonicalJson({ a: "false" }));
});

function memoryDatabase() {
  type Row = Record<string, unknown>;
  const snapshots: Row[] = []; const runs: Row[] = []; const activities: Row[] = []; const notifications: Row[] = [];
  const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "in" in value) return (value.in as unknown[]).includes(row[key]);
    return value === row[key];
  });
  const model = (rows: Row[]) => ({
    findFirst: async ({ where }: { where: Row }) => [...rows].reverse().find((item) => matches(item, where)) ?? null,
    create: async ({ data }: { data: Row }) => { const row = { ...data, id: `test-${rows.length + 1}`, fetchedAt: new Date(), finishedAt: new Date() }; rows.push(row); return row; },
  });
  const db: Record<string, unknown> = {
    customsbroker: { findUnique: async ({ where }: { where: { userId: string } }) => where.userId === "broker" ? { id: "broker-profile", companyAccesses: [{ companyId: "company-a" }] } : null },
    importer: { findUnique: async () => ({ id: "company-a", user: { cnpj: "44.555.666/0001-81", enterprise: "Test company" } }) },
    product: { findFirst: async ({ where }: { where: { id: string; importerId: string } }) => where.id === "product-a" && where.importerId === "company-a" ? { ...local, name: "Local different name", fields: [], records: [] } : null,
      findUnique: async () => ({ importerId: "company-a" }) },
    siscomexSnapshot: model(snapshots), siscomexSyncRun: model(runs), activityEvent: model(activities), notification: model(notifications),
    $queryRaw: async () => [{ id: "product-a" }],
  };
  db.$transaction = async (callback: (tx: unknown) => Promise<unknown>) => callback(db);
  return { db: db as unknown as PrismaClient, snapshots, runs, activities, notifications };
}

test("company and product scopes reject before any external call or persistence", async () => {
  const { db, snapshots, runs } = memoryDatabase(); let calls = 0;
  const service = new SiscomexService(db, new SiscomexClient(config(), async () => { calls++; return response([]); }));
  await assert.rejects(service.catalog("importer", "company-a", true), { code: "FORBIDDEN" });
  await assert.rejects(service.catalog("broker", "company-b", true), { code: "FORBIDDEN" });
  await assert.rejects(service.sync("broker", "company-a", "product-from-other-company", { productCode: "42", version: "1", operationMode: "IMPORTACAO" }), { code: "NOT_FOUND" });
  assert.equal(calls, 0); assert.equal(snapshots.length, 0); assert.equal(runs.length, 0);
});

test("sync persists evidence, compares, records activity and notification once without catalog writes", async () => {
  const { db, snapshots, runs, activities, notifications } = memoryDatabase(); let calls = 0;
  const service = new SiscomexService(db, new SiscomexClient(config(), async (url) => {
    calls++;
    if (String(url).includes("autenticar")) return authResponse();
    if (String(url).includes("atributo-ncm")) return response([{ codigo: "ATT_REQUIRED", nome: "Required", obrigatorio: true }]);
    return response(official);
  }));
  const input = { productCode: "42", version: "1", operationMode: "IMPORTACAO" as const };
  const result = await service.sync("broker", "company-a", "product-a", input);
  assert.equal(result.diff.conflictCount, 1); assert.equal(result.diff.missingRequiredAttributes.length, 1);
  assert.equal(result.readOnly, true); assert.equal(result.diff.catalogChanged, false);
  assert.equal(snapshots.length, 2); assert.equal(activities.length, 1); assert.equal(notifications.length, 1);
  assert.equal(activities[0].visibility, "DISPATCHER_ONLY"); assert.equal(notifications[0].userId, "broker");
  assert.match(String(snapshots[0].payloadHash), /^[a-f0-9]{64}$/);
  await service.sync("broker", "company-a", "product-a", input);
  assert.equal(calls, 3); assert.equal(runs.length, 2); assert.equal(activities.length, 1); assert.equal(notifications.length, 1);
  assert.equal((await service.comparison("broker", "company-a", "product-a"))?.diff.conflictCount, 1);
});

test("upstream company mismatch never saves official payload", async () => {
  const { db, snapshots, runs } = memoryDatabase();
  const service = new SiscomexService(db, new SiscomexClient(config(), async (url) => String(url).includes("autenticar") ? authResponse() : response({ ...official, cpfCnpjRaiz: "99999999" })));
  await assert.rejects(service.sync("broker", "company-a", "product-a", { productCode: "42", version: "1", operationMode: "IMPORTACAO" }), { code: "SISCOMEX_SCOPE_MISMATCH" });
  assert.equal(snapshots.length, 0); assert.equal(runs[0].status, "UNAVAILABLE");
});

test("integration status is scoped and contains no credentials", async () => {
  const { db } = memoryDatabase();
  const service = new SiscomexService(db, new SiscomexClient(config()));
  const status = await service.status("broker");
  assert.equal(status.status, "CONFIGURED");
  assert.equal(JSON.stringify(status).includes("test-secret"), false);
  assert.equal(JSON.stringify(status).includes("test-client"), false);
});
