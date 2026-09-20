import { ValidationError } from "../shared/errors.js"

export const EVIDENCE_STATUSES = Object.freeze([
  "confirmed",
  "reported",
  "conflicting",
  "missing",
  "inferred",
  "unverified",
])

export const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low"])

export function createEvidence(input, { id, timestamp }) {
  if (!input.field || !input.entityType || !input.source?.type) {
    throw new ValidationError(
      "Evidence requires field, entityType and source.type",
    )
  }

  if (!EVIDENCE_STATUSES.includes(input.status)) {
    throw new ValidationError(`Invalid evidence status: ${input.status}`)
  }

  if (!CONFIDENCE_LEVELS.includes(input.confidence)) {
    throw new ValidationError(`Invalid confidence: ${input.confidence}`)
  }

  return {
    id,
    field: input.field,
    value: input.value ?? null,
    normalizedValue:
      input.normalizedValue === undefined
        ? input.value ?? null
        : input.normalizedValue,
    rawValue: input.rawValue === undefined ? null : input.rawValue,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    status: input.status,
    source: { ...input.source },
    confidence: input.confidence,
    extraction: input.extraction ? { ...input.extraction } : null,
    extractedAt: input.extractedAt ?? timestamp,
  }
}
