import assert from "node:assert/strict"
import test from "node:test"

import { resolveProductIdentities } from "../src/domain/products/resolve-product-identities.js"
import { createDefaultIngestionService } from "../src/ingestion/ingestion-service.js"

function resolver(documents) {
  let sequence = 0
  return resolveProductIdentities(documents, {
    idFactory: () => `identity-${++sequence}`,
    timestamp: "2026-09-20T12:00:00.000Z",
  })
}

function documents(invoiceItem, packingItem) {
  let sequence = 0
  const ingestion = createDefaultIngestionService({
    idFactory: () => `document-${++sequence}`,
  })
  return [
    ingestion.ingest({
      kind: "structured",
      document: {
        id: "invoice",
        type: "COMMERCIAL_INVOICE",
        items: [invoiceItem],
      },
    }),
    ingestion.ingest({
      kind: "structured",
      document: {
        id: "packing",
        type: "PACKING_LIST",
        items: [packingItem],
      },
    }),
  ]
}

test("same strong identifier creates one ProductEntity with provenance", () => {
  const result = resolver(documents(
    { fields: { "Part Number": "XP400-A", quantity: 10 } },
    { fields: { "Part Number": "XP400-A", quantity: 10 } },
  ))
  assert.equal(result.productIdentities.length, 1)
  assert.equal(result.productIdentities[0].status, "MATCHED")
  assert.equal(result.productIdentities[0].documentItemRefs.length, 2)
  assert.deepEqual(
    new Set(result.productIdentities[0].documentItemRefs.map((item) => item.documentId)),
    new Set(["invoice", "packing"]),
  )
  assert.equal(result.findings.length, 0)
})

test("equal descriptions alone never link products", () => {
  const result = resolver(documents(
    { fields: { description: "Industrial Pump" } },
    { fields: { description: "Industrial Pump" } },
  ))
  assert.equal(result.productIdentities.length, 0)
  assert.ok(result.findings.some(
    (finding) => finding.type === "INSUFFICIENT_PRODUCT_IDENTITY" && finding.blocking,
  ))
})

test("conflicting identifiers create a blocking Finding", () => {
  const result = resolver(documents(
    { fields: { model: "XP400", sku: "SKU-A" } },
    { fields: { model: "XP400", sku: "SKU-B" } },
  ))
  assert.equal(result.productIdentities.length, 1)
  assert.equal(result.productIdentities[0].status, "CONFLICTING")
  assert.ok(result.findings.some(
    (finding) => finding.type === "CONFLICTING_PRODUCT_IDENTITY" && finding.blocking,
  ))
})
