const FIELD_LABELS = Object.freeze({
  description: "descrição",
  quantity: "quantidade",
  netWeight: "peso líquido",
  grossWeight: "peso bruto",
  value: "valor",
  manufacturer: "fabricante",
  model: "modelo",
  countryOfOrigin: "país de origem",
  ncm: "NCM informada",
  unit: "unidade",
  productIdentification: "identificação do produto",
})

export const ACTION_STATUSES = Object.freeze([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED",
])

export const ACTION_PRIORITIES = Object.freeze([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
])

function fieldLabel(field) {
  return FIELD_LABELS[field] ?? field
}

function actionTypeFor(finding) {
  if (finding.type === "FIELD_CONFLICT") return "VALIDATE_FIELD"
  if (finding.type === "MISSING_FIELD") return "REQUEST_FIELD"
  return "REVIEW_CATALOG"
}

function descriptionFor(finding) {
  if (finding.type === "FIELD_CONFLICT") {
    return `Confirmar ${fieldLabel(finding.field)} correto da carga.`
  }
  if (finding.type === "MISSING_FIELD") {
    return `Obter ${fieldLabel(finding.field)} da carga.`
  }
  return `Revisar catálogo: ${finding.reason}.`
}

export function createActionsFromFindings(findings, { idFactory, timestamp }) {
  return findings
    .filter((finding) => finding.status === "OPEN")
    .map((finding) => ({
      id: idFactory(),
      key: `FINDING:${finding.id}`,
      findingId: finding.id,
      type: actionTypeFor(finding),
      field: finding.field,
      entityType: finding.entityType,
      entityId: finding.entityId,
      cause: finding.reason,
      priority: finding.severity,
      status: "OPEN",
      assignedRole: "IMPORTER_OR_BROKER",
      description: descriptionFor(finding),
      blocking: finding.blocking,
      evidenceIds: [...finding.evidenceIds],
      completionCriteria: [...finding.resolutionCriteria],
      readinessImpact: finding.blocking ? "BLOCKED" : "CONDITIONAL",
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      resolution: null,
      resolutionEvidenceId: null,
    }))
}

export function mergeActions(existingActions, proposedActions, timestamp) {
  const activeByFinding = new Map(
    existingActions
      .filter((action) => ["OPEN", "IN_PROGRESS"].includes(action.status))
      .map((action) => [action.findingId, action]),
  )
  const proposedKeys = new Set(proposedActions.map((action) => action.key))
  const merged = [...existingActions]

  for (const proposed of proposedActions) {
    if (activeByFinding.has(proposed.findingId)) continue
    const hasClosedPredecessor = existingActions.some(
      (action) => action.findingId === proposed.findingId,
    )
    merged.push({
      ...proposed,
      key: hasClosedPredecessor
        ? `FINDING:${proposed.findingId}:FOLLOWUP:${proposed.id}`
        : proposed.key,
      predecessorActionId: hasClosedPredecessor
        ? existingActions
            .filter((action) => action.findingId === proposed.findingId)
            .at(-1)?.id ?? null
        : null,
    })
  }

  for (const action of existingActions) {
    if (
      proposedKeys.has(action.key) ||
      proposedActions.some((item) => item.findingId === action.findingId)
    ) continue
    if (["OPEN", "IN_PROGRESS"].includes(action.status)) {
      const target = merged.find((item) => item.id === action.id)
      Object.assign(target, {
        status: "CANCELLED",
        cancelledAt: timestamp,
        cancellationReason: "FINDING_NO_LONGER_ACTIVE",
        updatedAt: timestamp,
        version: (target.version ?? 1) + 1,
      })
    }
  }

  return merged
}
