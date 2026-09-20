export const FINDING_STATUSES = Object.freeze(["OPEN", "RESOLVED", "DISMISSED"])

export const FINDING_TYPES = Object.freeze([
  "FIELD_CONFLICT",
  "MISSING_FIELD",
  "CATALOG_INCONSISTENCY",
  "INSUFFICIENT_EVIDENCE",
  "POSSIBLE_DUPLICATE",
  "UNVERIFIED_CLASSIFICATION",
  "INSUFFICIENT_PRODUCT_IDENTITY",
  "CONFLICTING_PRODUCT_IDENTITY",
])

function catalogFindingType(reason) {
  if (reason === "possible_duplicate") return "POSSIBLE_DUPLICATE"
  if (reason === "classification_insufficient_evidence") {
    return "UNVERIFIED_CLASSIFICATION"
  }
  if (reason.endsWith("_missing")) return "MISSING_FIELD"
  if (reason.includes("insufficient")) return "INSUFFICIENT_EVIDENCE"
  return "CATALOG_INCONSISTENCY"
}

function catalogField(reason) {
  if (reason === "generic_description") return "description"
  if (reason === "classification_insufficient_evidence") {
    return "classificationEvidence"
  }
  if (reason === "possible_duplicate") return "duplicateReview"
  return reason.split("_")[0]
}

function findingKey(type, field, reason, entityId = null) {
  return `${type}:${entityId ?? "case"}:${field ?? "none"}:${reason}`
}

export function createFindingsFromAnalysis(
  { divergences, missingFields, catalogGovernance },
  { idFactory, timestamp },
) {
  const findings = []

  for (const divergence of divergences) {
    if (divergence.status === "resolved") continue
    findings.push({
      id: idFactory(),
      key: findingKey("FIELD_CONFLICT", divergence.field, divergence.type),
      type: "FIELD_CONFLICT",
      field: divergence.field,
      entityType: "case",
      entityId: null,
      reason: divergence.type,
      severity: divergence.severity.toUpperCase(),
      blocking: divergence.blocking,
      status: "OPEN",
      evidenceIds: [...divergence.evidenceIds],
      resolutionCriteria: [
        `Confirmar ${divergence.field} usando fonte confiável`,
      ],
      createdAt: timestamp,
      resolvedAt: null,
      dismissedAt: null,
      resolutionReason: null,
      resolutionEvidenceId: null,
      version: 1,
    })
  }

  for (const missing of missingFields) {
    findings.push({
      id: idFactory(),
      key: findingKey("MISSING_FIELD", missing.field, "missing_field"),
      type: "MISSING_FIELD",
      field: missing.field,
      entityType: "case",
      entityId: null,
      reason: "missing_field",
      severity: missing.severity.toUpperCase(),
      blocking: missing.blocking,
      status: "OPEN",
      evidenceIds: [...missing.evidenceIds],
      resolutionCriteria: [`Fornecer evidência confiável para ${missing.field}`],
      createdAt: timestamp,
      resolvedAt: null,
      dismissedAt: null,
      resolutionReason: null,
      resolutionEvidenceId: null,
      version: 1,
    })
  }

  for (const product of catalogGovernance.products) {
    for (const reason of product.reasons) {
      const type = catalogFindingType(reason)
      const field = catalogField(reason)
      findings.push({
        id: idFactory(),
        key: findingKey(type, field, reason, product.productId),
        type,
        field,
        entityType: "product",
        entityId: product.productId,
        reason,
        severity: "MEDIUM",
        blocking: false,
        status: "OPEN",
        evidenceIds: [],
        resolutionCriteria: ["Atualizar o cadastro com evidência rastreável"],
        createdAt: timestamp,
        resolvedAt: null,
        dismissedAt: null,
        resolutionReason: null,
        resolutionEvidenceId: null,
        version: 1,
      })
    }
  }

  return [...new Map(findings.map((finding) => [finding.key, finding])).values()]
}

export function mergeFindings(existingFindings, proposedFindings, timestamp) {
  const existingByKey = new Map(
    existingFindings.map((finding) => [finding.key, finding]),
  )
  const proposedKeys = new Set(proposedFindings.map((finding) => finding.key))
  const merged = proposedFindings.map((finding) => {
    const existing = existingByKey.get(finding.key)
    if (!existing) return finding
    if (existing.status === "DISMISSED") return existing
    return {
      ...finding,
      id: existing.id,
      createdAt: existing.createdAt,
      version:
        existing.status === finding.status
          ? existing.version ?? 1
          : (existing.version ?? 1) + 1,
    }
  })

  for (const existing of existingFindings) {
    if (proposedKeys.has(existing.key)) continue
    if (existing.status === "OPEN") {
      merged.push({
        ...existing,
        status: "RESOLVED",
        resolvedAt: timestamp,
        resolutionReason: "NO_LONGER_DETECTED",
        version: (existing.version ?? 1) + 1,
      })
    } else {
      merged.push(existing)
    }
  }

  return merged
}
