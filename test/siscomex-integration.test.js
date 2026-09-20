import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { loadSiscomexConfig } from "../src/integrations/siscomex/config.js"
import { createSiscomexIntegration } from "../src/integrations/siscomex/index.js"
import { InMemoryOperationalCaseRepository } from "../src/repositories/in-memory-operational-case-repository.js"
import { OperationalCaseService } from "../src/services/operational-case-service.js"

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/siscomex-wine.json", import.meta.url), "utf8"),
)

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

function harness({ cacheTtlSeconds = 3600 } = {}) {
  const calls = []
  let nowValue = Date.parse("2026-09-20T12:00:00.000Z")
  let unavailable = false
  const config = loadSiscomexConfig({
    SISCOMEX_ENABLED: "true",
    SISCOMEX_ENV: "validation",
    SISCOMEX_CLIENT_ID: "client-id",
    SISCOMEX_CLIENT_SECRET: "client-secret",
    SISCOMEX_CACHE_TTL_SECONDS: String(cacheTtlSeconds),
  })
  const transport = async (url, options) => {
    calls.push({ url, method: options.method, headers: options.headers })
    if (unavailable && !url.endsWith("/portal/api/autenticar/chave-acesso")) {
      throw new Error("network unavailable")
    }
    if (url.endsWith("/portal/api/autenticar/chave-acesso")) {
      return jsonResponse({}, 200, {
        "set-token": "jwt",
        "x-csrf-token": "csrf",
        "x-csrf-expiration": String(nowValue + 3_600_000),
      })
    }
    const sessionHeaders = {
      "set-token": "jwt-next",
      "x-csrf-token": "csrf-next",
      "x-csrf-expiration": String(nowValue + 3_600_000),
    }
    if (url.includes("/catp/api/ext/produto/")) {
      return jsonResponse(fixture.product, 200, sessionHeaders)
    }
    if (url.includes("/catp/api/ext/operador-estrangeiro/")) {
      return jsonResponse(fixture.foreignOperator, 200, sessionHeaders)
    }
    if (url.includes("/cadatributos/api/ext/atributo-ncm/")) {
      return jsonResponse(fixture.cada, 200, sessionHeaders)
    }
    throw new Error(`Unexpected URL: ${url}`)
  }
  const repository = new InMemoryOperationalCaseRepository()
  const integration = createSiscomexIntegration({
    config,
    repository,
    transport,
    clock: () => new Date(nowValue).toISOString(),
    now: () => nowValue,
  })
  const service = new OperationalCaseService({
    repository,
    siscomexIntegration: integration,
    clock: () => new Date(nowValue).toISOString(),
  })
  return {
    service,
    repository,
    calls,
    advance(milliseconds) {
      nowValue += milliseconds
    },
    setUnavailable(value) {
      unavailable = value
    },
  }
}

test("manual sync enriches CatalogRecord with official evidence and immutable cache", async () => {
  const { service, repository, calls } = harness()
  service.createCase({
    id: "case-wine",
    products: [{
      id: "wine",
      description: "Wine",
      manufacturer: null,
      model: null,
      reportedNcm: "2204.21.00",
    }],
  })
  const input = {
    productId: "wine",
    responsibleRootId: "12345678",
    productCode: "0000000001",
    version: "1",
    foreignOperator: { country: "FR", code: "OPE_2", version: "1" },
  }
  const result = await service.syncSiscomex("case-wine", input)
  assert.equal(result.environment, "validation")
  assert.equal(result.officialProduct.version, "1")
  assert.equal(result.officialOperator.name, "SAS MOREAU NAUDET")
  assert.equal(result.catalogRecord.fields.manufacturer.value, "SAS MOREAU NAUDET")
  assert.equal(result.catalogRecord.fields.manufacturer.status, "REPORTED")
  assert.equal(result.catalogRecord.fields.reportedNcm.status, "UNVERIFIED")
  assert.equal(result.catalogRecord.attributes.ATT_CATEGORY.value, "VINHO FINO")
  assert.ok(result.diff.matchingFields.some((item) => item.field === "reportedNcm"))
  assert.ok(result.diff.missingRequiredAttributes.some((item) => item.code === "ATT_CATEGORY"))
  assert.ok(result.recommendations.some((item) => item.reason.includes("Categoria da bebida")))

  const savedCase = service.getCase("case-wine")
  assert.ok(savedCase.evidences.some((item) =>
    item.source.type === "SISCOMEX" && item.source.snapshotId
  ))
  assert.equal(repository.listSiscomexSnapshots({ caseId: "case-wine" }).length, 3)
  const remoteCalls = calls.length
  const evidenceCount = savedCase.evidences.length
  await service.syncSiscomex("case-wine", input)
  assert.equal(calls.length, remoteCalls)
  assert.equal(repository.listSiscomexSnapshots({ caseId: "case-wine" }).length, 3)
  assert.equal(service.getCase("case-wine").evidences.length, evidenceCount)
})

test("official manufacturer disagreement remains an open conflict", async () => {
  const { service } = harness()
  service.createCase({
    id: "case-conflict",
    products: [{
      id: "wine",
      description: "VINHO FINO BRANCO SECO PETIT CHABLIS",
      manufacturer: "XYZ WINES",
      reportedNcm: "22042100",
    }],
  })
  const result = await service.syncSiscomex("case-conflict", {
    productId: "wine",
    responsibleRootId: "12345678",
    productCode: "0000000001",
    version: "1",
    foreignOperator: { country: "FR", code: "OPE_2", version: "1" },
  })
  assert.equal(result.catalogRecord.fields.manufacturer.status, "CONFLICTING")
  assert.equal(result.catalogRecord.fields.manufacturer.value, null)
  assert.ok(result.findings.some((item) =>
    item.status === "OPEN" && item.reason === "official_manufacturer_conflict"
  ))
  assert.equal(result.catalogRecord.qualityStatus, "CONFLICTING")
})

test("stale snapshots keep local analysis available during an outage", async () => {
  const harnessResult = harness({ cacheTtlSeconds: 1 })
  const { service } = harnessResult
  service.createCase({
    id: "case-stale",
    products: [{
      id: "wine",
      description: "Wine",
      reportedNcm: "22042100",
    }],
  })
  const input = {
    productId: "wine",
    responsibleRootId: "12345678",
    productCode: "0000000001",
    version: "1",
  }
  await service.syncSiscomex("case-stale", input)
  harnessResult.advance(2_000)
  harnessResult.setUnavailable(true)
  const stale = await service.syncSiscomex("case-stale", input)
  assert.equal(stale.cacheStatus, "STALE")
  assert.equal(stale.officialProduct.productCode, "0000000001")
  assert.equal(service.getSiscomexStatus().status, "UNAVAILABLE")
  assert.equal(
    service.getSiscomexCatalog("case-stale").snapshots[0].cacheStatus,
    "STALE",
  )
})
