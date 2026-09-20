import { createEvidence } from "../evidence/evidence.js"
import { generateDocumentEvidences } from "../evidence/generate-document-evidence.js"

export const RECONCILIATION_FIELDS = Object.freeze({
  description: { severity: "medium", blocking: false },
  quantity: { severity: "high", blocking: true },
  netWeight: { severity: "high", blocking: true },
  grossWeight: { severity: "high", blocking: true },
  value: { severity: "medium", blocking: false },
  manufacturer: { severity: "high", blocking: true },
  model: { severity: "medium", blocking: false },
  countryOfOrigin: { severity: "medium", blocking: false },
  ncm: { severity: "medium", blocking: false },
  unit: { severity: "medium", blocking: false },
  productIdentification: { severity: "high", blocking: true },
})

const DEFAULT_REQUIRED_FIELDS = Object.freeze([
  "description",
  "quantity",
  "grossWeight",
  "manufacturer",
  "model",
  "ncm",
])

function normalizedKey(value) {
  if (typeof value === "string") return value.trim().toLocaleLowerCase("pt-BR")
  return JSON.stringify(value)
}

export function reconcileDocuments(
  documents,
  {
    idFactory,
    timestamp,
    requiredFields = DEFAULT_REQUIRED_FIELDS,
    resolvedFields = {},
    evidences = null,
    immutableEvidenceIds = new Set(),
  },
) {
  const ledger = evidences
    ? [...evidences]
    : generateDocumentEvidences(documents, { idFactory, timestamp })
  const divergences = []
  const missingFields = []

  for (const [field, configuration] of Object.entries(RECONCILIATION_FIELDS)) {
    const resolved = resolvedFields[field]
    if (resolved) {
      ledger.push(resolved.evidence)
      continue
    }

    const values = ledger.filter(
      (evidence) =>
        evidence.field === field &&
        evidence.entityType === "case" &&
        evidence.status !== "missing",
    )

    if (values.length === 0) {
      if (requiredFields.includes(field)) {
        const evidence = createEvidence(
          {
            field,
            value: null,
            entityType: "case",
            status: "missing",
            source: { type: "system" },
            confidence: "high",
            extraction: null,
          },
          { id: idFactory(), timestamp },
        )
        ledger.push(evidence)
        missingFields.push({
          field,
          severity: configuration.severity,
          blocking: configuration.blocking,
          evidenceIds: [evidence.id],
        })
      }
      continue
    }

    const distinctValues = new Set(
      values.map((evidence) => normalizedKey(evidence.normalizedValue)),
    )
    const hasConflict = distinctValues.size > 1
    const status = hasConflict
      ? "conflicting"
      : values.length > 1
        ? "confirmed"
        : values[0].status === "unverified"
          ? "unverified"
          : "reported"

    for (const evidence of values) {
      if (immutableEvidenceIds.has(evidence.id)) continue
      evidence.status = status
      evidence.confidence = hasConflict ? "low" : values.length > 1 ? "high" : "medium"
    }

    if (hasConflict) {
      divergences.push({
        id: idFactory(),
        field,
        type: "value_conflict",
        severity: configuration.severity,
        blocking: configuration.blocking,
        status: "open",
        sources: values.map((evidence) => ({
          documentId: evidence.source.documentId,
          documentType: evidence.source.documentType ?? null,
          value: evidence.normalizedValue,
          rawValue: evidence.rawValue,
          page: evidence.source.page ?? null,
          sheet: evidence.source.sheet ?? null,
          cell: evidence.source.cell ?? null,
        })),
        evidenceIds: values.map((evidence) => evidence.id),
      })
    }
  }

  return { evidences: ledger, divergences, missingFields }
}
