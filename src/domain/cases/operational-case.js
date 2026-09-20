import { ValidationError } from "../shared/errors.js"

export function createOperationalCase(
  input,
  { id, timestamp, eventId, actor = { type: "SYSTEM", id: "prisma" } },
) {
  if (!id) {
    throw new ValidationError("OperationalCase requires an id")
  }

  return {
    id,
    version: 1,
    status: "OPEN",
    metadata: { ...(input.metadata ?? {}) },
    shipment: input.shipment ?? {},
    operationalMetrics: {
      stoppedAt: input.operationalMetrics?.stoppedAt ?? null,
      releasedAt: input.operationalMetrics?.releasedAt ?? null,
      stoppedDurationHours:
        input.operationalMetrics?.stoppedDurationHours ?? null,
      delayOccurred: input.operationalMetrics?.delayOccurred ?? null,
      storageCost: input.operationalMetrics?.storageCost ?? null,
      storageCurrency: input.operationalMetrics?.storageCurrency ?? null,
      inspectionOccurred: input.operationalMetrics?.inspectionOccurred ?? null,
      requirementOccurred: input.operationalMetrics?.requirementOccurred ?? null,
    },
    parties: {
      importer: input.importer ?? input.parties?.importer ?? null,
      supplier: input.supplier ?? input.parties?.supplier ?? null,
      terminal: input.terminal ?? input.parties?.terminal ?? null,
    },
    documents: [...(input.documents ?? [])],
    products: [...(input.products ?? [])],
    evidences: [],
    divergences: [],
    missingFields: [],
    findings: [],
    risks: [],
    actions: [],
    decisions: [],
    timeline: [
      {
        eventId,
        caseId: id,
        type: "CASE_CREATED",
        timestamp,
        actor,
        metadata: { status: "OPEN" },
        details: { status: "OPEN" },
        caseVersion: 1,
      },
    ],
    catalogGovernance: null,
    readiness: null,
    decision: null,
    resolvedFields: {},
    productIdentities: [],
    idempotencyKeys: {},
    quantitativePrediction: {
      status: "UNAVAILABLE",
      reason: "INSUFFICIENT_HISTORICAL_DATA",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
