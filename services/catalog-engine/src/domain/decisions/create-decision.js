const DECISION_BY_READINESS = Object.freeze({
  READY: "PROCEED",
  CONDITIONAL: "PROCEED_WITH_CONDITIONS",
  BLOCKED: "HOLD_FOR_VALIDATION",
})

export function createDecision(readiness, { id, timestamp }) {
  return {
    id,
    type: DECISION_BY_READINESS[readiness.status],
    confidence: "HIGH",
    justification: [...readiness.reasons],
    evidenceIds: [...readiness.evidenceIds],
    conditions: [...readiness.conditions],
    risks: readiness.blockingFields.map((field) => `${field}_unresolved`),
    createdAt: timestamp,
  }
}
