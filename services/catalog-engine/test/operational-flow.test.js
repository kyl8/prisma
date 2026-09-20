import assert from "node:assert/strict"
import test from "node:test"

import { evaluateCatalog } from "../src/domain/catalog/evaluate-catalog.js"
import { createEvidence } from "../src/domain/evidence/evidence.js"
import { reconcileDocuments } from "../src/domain/reconciliation/reconcile-documents.js"
import { InMemoryOperationalCaseRepository } from "../src/repositories/in-memory-operational-case-repository.js"
import { OperationalCaseService } from "../src/services/operational-case-service.js"

function createHarness() {
  let sequence = 0
  const idFactory = () => `id-${++sequence}`
  const clock = () => "2026-09-20T12:00:00.000Z"
  const repository = new InMemoryOperationalCaseRepository()
  const service = new OperationalCaseService({ repository, idFactory, clock })
  return { service, idFactory, clock }
}

function completeFields(overrides = {}) {
  return {
    description: "Industrial Pump XP400",
    quantity: 10,
    grossWeight: 720,
    manufacturer: "ABC Machinery",
    model: "XP400",
    ncm: "8413.x",
    ...overrides,
  }
}

function completeProduct(overrides = {}) {
  return {
    id: "product-1",
    description: "Industrial Pump XP400",
    manufacturer: "ABC Machinery",
    model: "XP400",
    ncm: "8413.x",
    classificationEvidence: { type: "technical_sheet" },
    ...overrides,
  }
}

test("creates an OperationalCase with an audit event", () => {
  const { service } = createHarness()
  const operationalCase = service.createCase({
    shipment: { reference: "shipment-1" },
    importer: { name: "Importer" },
  })

  assert.ok(operationalCase.id)
  assert.equal(operationalCase.status, "OPEN")
  assert.equal(operationalCase.shipment.reference, "shipment-1")
  assert.equal(operationalCase.operationalMetrics.delayOccurred, null)
  assert.equal(operationalCase.timeline[0].type, "CASE_CREATED")
})

test("creates traceable evidence without promoting reports to facts", () => {
  const evidence = createEvidence(
    {
      field: "manufacturer",
      value: "ABC Machinery",
      entityType: "product",
      entityId: "product-1",
      status: "reported",
      source: {
        type: "document",
        documentId: "invoice-1",
        documentName: "invoice.pdf",
        page: 2,
      },
      confidence: "medium",
    },
    { id: "evidence-1", timestamp: "2026-09-20T12:00:00.000Z" },
  )

  assert.equal(evidence.status, "reported")
  assert.equal(evidence.source.page, 2)
  assert.equal(evidence.entityId, "product-1")
})

test("detects a conflict and a missing field between documents", () => {
  const { idFactory, clock } = createHarness()
  const result = reconcileDocuments(
    [
      {
        id: "invoice",
        type: "invoice",
        fields: completeFields({ model: undefined }),
      },
      {
        id: "packing-list",
        type: "packing_list",
        fields: completeFields({ grossWeight: 680, model: undefined }),
      },
    ],
    {
      idFactory,
      timestamp: clock(),
      requiredFields: ["grossWeight", "model"],
    },
  )

  assert.equal(result.divergences[0].field, "grossWeight")
  assert.equal(result.divergences[0].severity, "high")
  assert.ok(result.missingFields.some((item) => item.field === "model"))
  assert.ok(
    result.evidences.some(
      (evidence) =>
        evidence.field === "grossWeight" && evidence.status === "conflicting",
    ),
  )
})

test("flags generic and insufficiently supported catalog data", () => {
  const result = evaluateCatalog([
    {
      id: "product-1",
      description: "Pump",
      ncm: "8413.x",
      manufacturer: "",
      model: "",
    },
  ])

  assert.equal(result.status, "requires_review")
  assert.equal(result.products[0].classificationStatus, "insufficient_evidence")
  assert.ok(result.products[0].reasons.includes("generic_description"))
  assert.ok(result.products[0].reasons.includes("manufacturer_missing"))
})

test("requires real classification evidence and scopes duplicate findings", () => {
  const result = evaluateCatalog([
    completeProduct({ id: "product-1", classificationEvidence: [] }),
    completeProduct({ id: "product-2" }),
    completeProduct({
      id: "product-3",
      description: "Valve VX",
      model: "VX",
    }),
  ])

  assert.equal(
    result.products[0].classificationStatus,
    "insufficient_evidence",
  )
  assert.ok(result.products[0].reasons.includes("possible_duplicate"))
  assert.ok(result.products[1].reasons.includes("possible_duplicate"))
  assert.ok(!result.products[2].reasons.includes("possible_duplicate"))
})

test("maps a complete and consistent case to READY and PROCEED", () => {
  const { service } = createHarness()
  const operationalCase = service.createCase({
    documents: [
      { id: "invoice", type: "invoice", fields: completeFields() },
      { id: "packing", type: "packing_list", fields: completeFields() },
    ],
    products: [completeProduct()],
  })
  const result = service.analyze(operationalCase.id)

  assert.equal(result.readiness.status, "READY")
  assert.equal(result.decision.type, "PROCEED")
  assert.equal(result.actions.length, 0)

  const repeated = service.analyze(operationalCase.id)
  assert.equal(repeated.actions.length, 0)
})

test("maps a non-blocking gap to CONDITIONAL", () => {
  const { service } = createHarness()
  const fields = completeFields({ model: undefined })
  const operationalCase = service.createCase({
    documents: [
      { id: "invoice", type: "invoice", fields },
      { id: "packing", type: "packing_list", fields },
    ],
    products: [completeProduct({ model: undefined })],
  })
  const result = service.analyze(operationalCase.id)

  assert.equal(result.readiness.status, "CONDITIONAL")
  assert.equal(result.decision.type, "PROCEED_WITH_CONDITIONS")
  assert.ok(result.actions.some((action) => action.field === "model"))
})

test("blocks conflicts, creates actions, resolves them and records timeline", () => {
  const { service } = createHarness()
  const operationalCase = service.createCase({
    documents: [
      {
        id: "invoice",
        type: "invoice",
        fields: completeFields({
          grossWeight: 720,
          manufacturer: "ABC Machinery",
        }),
      },
      {
        id: "packing",
        type: "packing_list",
        fields: completeFields({
          grossWeight: 680,
          manufacturer: "ABC Industrial",
          model: undefined,
        }),
      },
    ],
    products: [
      completeProduct({
        description: "Pump",
        manufacturer: "",
        model: "",
        classificationEvidence: undefined,
      }),
    ],
  })

  let result = service.analyze(operationalCase.id)
  assert.equal(result.readiness.status, "BLOCKED")
  assert.equal(result.decision.type, "HOLD_FOR_VALIDATION")
  assert.equal(result.quantitativePrediction.status, "UNAVAILABLE")
  assert.ok(result.divergences.some((item) => item.field === "grossWeight"))
  assert.ok(result.divergences.some((item) => item.field === "manufacturer"))
  assert.ok(
    result.actions.some(
      (action) => action.field === "grossWeight" && action.blocking,
    ),
  )

  const resolutions = {
    grossWeight: 700,
    manufacturer: "ABC Machinery",
    description: "Industrial Pump XP400",
    model: "XP400",
    classificationEvidence: { type: "technical_sheet" },
  }
  for (const action of result.actions) {
    result = service.resolveAction(operationalCase.id, action.id, {
      value: resolutions[action.field] ?? true,
      source: { type: "resolution", reference: "manual-review" },
      confidence: "high",
    })
  }

  assert.equal(result.readiness.status, "READY")
  assert.equal(result.decision.type, "PROCEED")
  assert.equal(result.catalogGovernance.status, "compliant")
  assert.ok(result.actions.every((action) => action.status === "RESOLVED"))
  assert.ok(
    result.timeline.some((event) => event.type === "ACTION_RESOLVED"),
  )
  assert.ok(
    result.timeline.some(
      (event) =>
        event.type === "READINESS_CHANGED" && event.details.to === "READY",
    ),
  )
})
