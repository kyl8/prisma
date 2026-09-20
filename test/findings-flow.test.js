import assert from "node:assert/strict"
import test from "node:test"
import * as XLSX from "xlsx"

import { createFindingsFromAnalysis } from "../src/domain/findings/findings.js"
import { evaluateReadiness } from "../src/domain/readiness/evaluate-readiness.js"
import { InMemoryOperationalCaseRepository } from "../src/repositories/in-memory-operational-case-repository.js"
import { OperationalCaseService } from "../src/services/operational-case-service.js"

function finding(overrides = {}) {
  return {
    id: "finding-1",
    type: "FIELD_CONFLICT",
    field: "grossWeight",
    reason: "value_conflict",
    severity: "HIGH",
    blocking: true,
    status: "OPEN",
    evidenceIds: ["evidence-1"],
    resolutionCriteria: ["Confirmar peso bruto"],
    ...overrides,
  }
}

function harness() {
  let sequence = 0
  return new OperationalCaseService({
    repository: new InMemoryOperationalCaseRepository(),
    idFactory: () => `id-${++sequence}`,
    clock: () => "2026-09-20T12:00:00.000Z",
  })
}

function completeFields(grossWeight) {
  return {
    description: "Industrial Pump XP400",
    quantity: 10,
    grossWeight,
    manufacturer: "ABC Machinery",
    model: "XP400",
    ncm: "8413.x",
  }
}

function completeProduct() {
  return {
    id: "product-1",
    description: "Industrial Pump XP400",
    manufacturer: "ABC Machinery",
    model: "XP400",
    ncm: "8413.x",
    classificationEvidence: { type: "technical_sheet" },
  }
}

test("creates findings for conflicts, missing fields and catalog issues", () => {
  let sequence = 0
  const findings = createFindingsFromAnalysis(
    {
      divergences: [
        {
          field: "grossWeight",
          type: "value_conflict",
          severity: "high",
          blocking: true,
          evidenceIds: ["e1", "e2"],
        },
      ],
      missingFields: [
        {
          field: "model",
          severity: "medium",
          blocking: false,
          evidenceIds: ["e3"],
        },
      ],
      catalogGovernance: {
        products: [
          {
            productId: "product-1",
            reasons: ["classification_insufficient_evidence"],
          },
        ],
      },
    },
    {
      idFactory: () => `finding-${++sequence}`,
      timestamp: "2026-09-20T12:00:00.000Z",
    },
  )

  assert.deepEqual(
    findings.map((item) => item.type),
    ["FIELD_CONFLICT", "MISSING_FIELD", "UNVERIFIED_CLASSIFICATION"],
  )
  assert.equal(findings[0].blocking, true)
  assert.equal(findings[1].blocking, false)
})

test("readiness is derived from findings, even when no action exists", () => {
  assert.equal(evaluateReadiness([finding()], []).status, "BLOCKED")
  assert.equal(
    evaluateReadiness([finding({ blocking: false })], []).status,
    "CONDITIONAL",
  )
  assert.equal(
    evaluateReadiness([finding({ status: "RESOLVED" })], []).status,
    "READY",
  )
})

test("resolving an action without evidence keeps its finding open", () => {
  const service = harness()
  const operationalCase = service.createCase({
    documents: [
      { id: "invoice", type: "invoice", fields: completeFields(720) },
      { id: "packing", type: "packing_list", fields: completeFields(680) },
    ],
    products: [completeProduct()],
  })
  let result = service.analyze(operationalCase.id)
  const action = result.actions.find((item) => item.field === "grossWeight")

  result = service.resolveAction(operationalCase.id, action.id, {
    notes: "Administrative ticket closed without confirmation",
  })

  assert.equal(result.actions.find((item) => item.id === action.id).status, "RESOLVED")
  assert.equal(
    result.findings.find((item) => item.id === action.findingId).status,
    "OPEN",
  )
  assert.equal(result.readiness.status, "BLOCKED")
  assert.equal(result.decision.type, "HOLD_FOR_VALIDATION")
})

test("valid resolution evidence resolves the finding and recalculates the case", () => {
  const service = harness()
  const operationalCase = service.createCase({
    documents: [
      { id: "invoice", type: "invoice", fields: completeFields(720) },
      { id: "packing", type: "packing_list", fields: completeFields(680) },
    ],
    products: [completeProduct()],
  })
  let result = service.analyze(operationalCase.id)
  const action = result.actions.find((item) => item.field === "grossWeight")
  result = service.resolveAction(operationalCase.id, action.id, {})
  result = service.resolveAction(operationalCase.id, action.id, {
    value: 700,
    rawValue: "700 KG",
    source: { type: "manual", actor: "broker-1", role: "BROKER" },
  })

  assert.equal(
    result.findings.find((item) => item.id === action.findingId).status,
    "RESOLVED",
  )
  assert.equal(result.readiness.status, "READY")
  assert.equal(result.decision.type, "PROCEED")
  assert.ok(result.timeline.some((event) => event.type === "FINDING_STATUS_CHANGED"))
})

test("spreadsheet and OCR ingestion produce linked blocking findings and actions", () => {
  const service = harness()
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Produto", "Quantidade", "Peso", "Fabricante", "Modelo", "NCM"],
    ["Industrial Pump XP400", 10, "680 KG", "ABC Industrial", "XP400", "8413.x"],
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products")
  const operationalCase = service.createCase({ products: [completeProduct()] })

  service.ingest(operationalCase.id, {
    kind: "spreadsheet",
    fileName: "packing.xlsx",
    documentType: "PACKING_LIST",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  })
  service.ingest(operationalCase.id, {
    kind: "ocr",
    payload: {
      id: "invoice-ocr",
      type: "COMMERCIAL_INVOICE",
      fileName: "invoice.pdf",
      fields: [
        { field: "description", value: "Industrial Pump XP400", page: 1 },
        { field: "quantity", value: "10 PCS", page: 1 },
        { field: "grossWeight", value: "720 KG", page: 1 },
        { field: "manufacturer", value: "ABC Machinery", page: 1 },
        { field: "model", value: "XP400", page: 1 },
        { field: "ncm", value: "8413.x", page: 1 },
      ],
    },
  })

  const result = service.analyze(operationalCase.id)
  const weightFinding = result.findings.find(
    (item) => item.field === "grossWeight" && item.status === "OPEN",
  )
  const manufacturerFinding = result.findings.find(
    (item) => item.field === "manufacturer" && item.status === "OPEN",
  )

  assert.equal(result.readiness.status, "BLOCKED")
  assert.equal(result.decision.type, "HOLD_FOR_VALIDATION")
  assert.equal(weightFinding.blocking, true)
  assert.equal(manufacturerFinding.blocking, true)
  assert.ok(result.actions.some((action) => action.findingId === weightFinding.id))
  assert.equal(result.quantitativePrediction.status, "UNAVAILABLE")
})
