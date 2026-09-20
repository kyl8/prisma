import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import * as XLSX from "xlsx"

import {
  consolidateCatalog,
  createCatalogSummary,
} from "../src/domain/catalog/consolidate-catalog.js"
import { exportCatalog } from "../src/domain/catalog/export-catalog.js"
import { InMemoryOperationalCaseRepository } from "../src/repositories/in-memory-operational-case-repository.js"
import { OperationalCaseService } from "../src/services/operational-case-service.js"

const demo = JSON.parse(
  readFileSync(join(process.cwd(), "fixtures", "catalog-demo.json"), "utf8"),
)

function serviceHarness() {
  let sequence = 0
  const repository = new InMemoryOperationalCaseRepository()
  const service = new OperationalCaseService({
    repository,
    idFactory: () => `catalog-id-${++sequence}`,
    clock: () => "2026-09-20T15:00:00.000Z",
  })
  return { repository, service }
}

function analyzedDemo() {
  const harness = serviceHarness()
  harness.service.createCase(demo.case)
  harness.service.analyze(demo.case.id)
  return { ...harness, catalog: harness.service.getCatalog(demo.case.id) }
}

function caseWithProducts(products, findings = []) {
  return {
    id: "case-quality",
    metadata: {},
    products,
    documents: [],
    evidences: [],
    findings,
    productIdentities: [],
    updatedAt: "2026-09-20T15:00:00.000Z",
  }
}

function completeProduct(overrides = {}) {
  return {
    id: "product-complete",
    sku: "SKU-COMPLETE",
    description: "Industrial Pump XP400",
    manufacturer: "ABC Machinery Ltd.",
    model: "XP400",
    partNumber: "XP400-A",
    ncm: "8413.70",
    countryOfOrigin: "China",
    classificationEvidence: { type: "technical_datasheet" },
    ...overrides,
  }
}

test("CatalogRecord consolidates multiple sources with raw provenance", () => {
  const { catalog } = analyzedDemo()
  assert.equal(catalog.records.length, demo.expected.records)
  const record = catalog.records.find(
    (item) => item.productId === demo.expected.enrichedProductId,
  )
  assert.equal(record.fields.description.value, "Industrial Centrifugal Pump XP400")
  assert.equal(record.fields.description.status, "CONFIRMED")
  assert.equal(
    record.fields.description.selectionReason,
    "REPLACED_GENERIC_CATALOG_DESCRIPTION",
  )
  assert.ok(record.fields.description.rawValues.some((item) => item.value === "Pump"))
  assert.ok(record.fields.description.evidenceIds.length >= 2)
  assert.ok(record.fields.description.sources.every((source) => source.documentId))
  assert.equal(record.fields.manufacturer.value, "ABC Machinery Ltd.")
  assert.equal(record.fields.partNumber.value, "XP400-A")
  assert.equal(record.fields.reportedNcm.status, "UNVERIFIED")
})

test("consolidation confirms equal values, reports one source, preserves missing and refuses conflicts", () => {
  const { catalog } = analyzedDemo()
  const enriched = catalog.records.find((item) => item.productId === "catalog-xp400")
  const conflicting = catalog.records.find((item) => item.productId === "catalog-v10")
  assert.equal(enriched.fields.model.status, "CONFIRMED")
  assert.equal(enriched.fields.application.status, "REPORTED")
  assert.equal(conflicting.fields.manufacturer.status, "CONFLICTING")
  assert.equal(conflicting.fields.manufacturer.value, null)
  assert.deepEqual(
    new Set(conflicting.fields.manufacturer.values),
    new Set(["Atlas Valves", "Apex Valves"]),
  )
  assert.equal(conflicting.fields.partNumber.status, "MISSING")
})

test("Data Quality emits every explicit state without a percentage score", () => {
  const complete = consolidateCatalog(caseWithProducts([completeProduct()])).records[0]
  const partial = consolidateCatalog(caseWithProducts([
    completeProduct({ partNumber: undefined }),
  ])).records[0]
  const requiresReview = consolidateCatalog(caseWithProducts([
    completeProduct({ classificationEvidence: undefined }),
  ])).records[0]
  const insufficient = consolidateCatalog(caseWithProducts([{
    id: "product-insufficient",
    description: "Unknown part",
  }])).records[0]
  const conflicting = consolidateCatalog(caseWithProducts([
    completeProduct({ id: "duplicate-a" }),
    completeProduct({ id: "duplicate-b", manufacturer: "Other Manufacturer" }),
  ])).records[0]

  assert.equal(complete.qualityStatus, "COMPLETE")
  assert.equal(partial.qualityStatus, "PARTIAL")
  assert.equal(requiresReview.qualityStatus, "REQUIRES_REVIEW")
  assert.equal(insufficient.qualityStatus, "INSUFFICIENT_DATA")
  assert.equal(conflicting.qualityStatus, "CONFLICTING")
  for (const record of [complete, partial, requiresReview, insufficient, conflicting]) {
    assert.equal("qualityScore" in record, false)
    assert.ok(Array.isArray(record.qualityReasons))
  }
})

test("only strong identifiers merge records; equal descriptions remain separate", () => {
  const strong = consolidateCatalog(caseWithProducts([
    completeProduct({ id: "strong-a", sku: "SHARED-SKU" }),
    completeProduct({ id: "strong-b", sku: "SHARED-SKU" }),
  ]))
  const descriptionsOnly = consolidateCatalog(caseWithProducts([
    { id: "description-a", description: "Same product" },
    { id: "description-b", description: "Same product" },
  ]))
  assert.equal(strong.records.length, 1)
  assert.deepEqual(strong.records[0].sourceProductIds, ["strong-a", "strong-b"])
  assert.equal(descriptionsOnly.records.length, 2)
})

test("Catalog Diff exposes added, changed, conflicting and missing fields", () => {
  const { catalog } = analyzedDemo()
  const enriched = catalog.records.find((item) => item.productId === "catalog-xp400")
  const conflicting = catalog.records.find((item) => item.productId === "catalog-v10")
  assert.ok(enriched.diff.changedFields.some(
    (item) => item.field === "manufacturer" && item.before === null,
  ))
  assert.ok(enriched.diff.changedFields.some(
    (item) =>
      item.field === "description" &&
      item.before === "Pump" &&
      item.after === "Industrial Centrifugal Pump XP400",
  ))
  assert.ok(conflicting.diff.conflictingFields.some(
    (item) => item.field === "manufacturer" && item.after === null,
  ))
  assert.ok(conflicting.diff.missingFields.some((item) => item.field === "partNumber"))
})

test("Recommendations retain Finding and Evidence links", () => {
  const { catalog } = analyzedDemo()
  const enriched = catalog.records.find((item) => item.productId === "catalog-xp400")
  const conflicting = catalog.records.find((item) => item.productId === "catalog-v10")
  const ncm = enriched.recommendations.find((item) => item.type === "REVIEW_CLASSIFICATION")
  const conflict = conflicting.recommendations.find(
    (item) => item.field === "manufacturer" && item.type === "CONFIRM_CONFLICTING_FIELD",
  )
  const missing = conflicting.recommendations.find(
    (item) => item.field === "partNumber" && item.type === "PROVIDE_MISSING_FIELD",
  )
  assert.ok(ncm.findingIds.length > 0)
  assert.ok(ncm.evidenceIds.length > 0)
  assert.ok(conflict.evidenceIds.length > 0)
  assert.ok(conflict.findingIds.length > 0)
  assert.ok(missing.findingIds.length > 0)
})

test("Catalog Summary counts statuses and factual issue frequency", () => {
  const records = [
    { qualityStatus: "COMPLETE", qualityReasons: [] },
    { qualityStatus: "PARTIAL", qualityReasons: ["model_missing"] },
    { qualityStatus: "REQUIRES_REVIEW", qualityReasons: ["ncm_unverified"] },
    { qualityStatus: "CONFLICTING", qualityReasons: ["manufacturer_conflict"] },
    { qualityStatus: "INSUFFICIENT_DATA", qualityReasons: ["model_missing"] },
  ]
  const summary = createCatalogSummary(records)
  assert.deepEqual(
    {
      products: summary.products,
      complete: summary.complete,
      partial: summary.partial,
      requiresReview: summary.requiresReview,
      conflicting: summary.conflicting,
      insufficientData: summary.insufficientData,
    },
    {
      products: 5,
      complete: 1,
      partial: 1,
      requiresReview: 1,
      conflicting: 1,
      insufficientData: 1,
    },
  )
  assert.deepEqual(summary.topIssues[0], { type: "model_missing", count: 2 })
})

test("JSON, CSV and XLSX exports keep identifiers and quality without internal paths", () => {
  const { catalog } = analyzedDemo()
  const json = exportCatalog(catalog, "json")
  const jsonBody = JSON.parse(json.body.toString("utf8"))
  assert.equal(jsonBody.records.length, 2)
  assert.ok(jsonBody.records[0].identifiers.length > 0)
  assert.ok(jsonBody.records[0].qualityStatus)
  assert.ok(!json.body.toString("utf8").includes("storageKey"))

  const csv = exportCatalog(catalog, "csv")
  const csvBody = csv.body.toString("utf8")
  assert.ok(csvBody.includes("product_id"))
  assert.ok(csvBody.includes("quality_status"))
  assert.ok(csvBody.includes("XP400-SKU"))
  assert.ok(!csvBody.includes("storageKey"))

  const xlsx = exportCatalog(catalog, "xlsx")
  const workbook = XLSX.read(xlsx.body, { type: "buffer" })
  assert.deepEqual(workbook.SheetNames, ["Catalog", "Evidence", "Findings"])
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Catalog)
  assert.equal(rows.length, 2)
  assert.ok(rows.every((row) => row.quality_status))
  assert.ok(rows.some((row) => row.sku === "XP400-SKU"))
})

test("Catalog output is identical without Actions", () => {
  const { repository, service, catalog } = analyzedDemo()
  const operationalCase = repository.findById(demo.case.id)
  const withoutActions = consolidateCatalog({ ...operationalCase, actions: [] })
  assert.deepEqual(
    withoutActions.records.map((record) => ({
      productId: record.productId,
      qualityStatus: record.qualityStatus,
      fields: record.fields,
    })),
    catalog.records.map((record) => ({
      productId: record.productId,
      qualityStatus: record.qualityStatus,
      fields: record.fields,
    })),
  )
  assert.ok(service.getCase(demo.case.id).actions.length > 0)
})
