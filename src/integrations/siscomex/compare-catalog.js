function normalized(value) {
  if (value === undefined || value === null) return null
  if (typeof value === "object") return JSON.stringify(value)
  return String(value).trim().toLowerCase()
}

function fieldValue(record, field) {
  const consolidated = record.fields[field] ?? record.attributes[field]
  if (!consolidated || ["MISSING", "CONFLICTING"].includes(consolidated.status)) {
    return null
  }
  return consolidated.value
}

function sameFieldValue(field, left, right) {
  if (field === "reportedNcm") {
    return String(left).replace(/\D/g, "") === String(right).replace(/\D/g, "")
  }
  return normalized(left) === normalized(right)
}

function finding({
  idFactory,
  timestamp,
  type = "CATALOG_INCONSISTENCY",
  field,
  productId,
  reason,
  evidenceIds,
  resolutionCriteria,
  severity = "MEDIUM",
}) {
  return {
    id: idFactory(),
    key: `${type}:${productId}:${field}:${reason}`,
    type,
    field,
    entityType: "product",
    entityId: productId,
    reason,
    severity,
    blocking: false,
    status: "OPEN",
    evidenceIds: [...new Set(evidenceIds)],
    resolutionCriteria: [resolutionCriteria],
    source: { type: "SISCOMEX" },
    createdAt: timestamp,
    resolvedAt: null,
    dismissedAt: null,
    resolutionReason: null,
    resolutionEvidenceId: null,
    version: 1,
  }
}

function evidenceFor(evidences, field) {
  return evidences.filter((item) => item.field === field).map((item) => item.id)
}

function presentOfficialFields(product, operator) {
  return [
    ["description", product.denomination ?? product.complementaryDescription],
    ["reportedNcm", product.ncm],
    ["manufacturer", operator?.name],
    ["officialStatus", product.status],
    ["operationMode", product.operationMode],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "")
}

export function compareCatalogWithSiscomex({
  record,
  product,
  operator = null,
  requirements = [],
  evidences = [],
  localProduct = {},
  idFactory,
  timestamp,
}) {
  const result = {
    productId: record.productId,
    officialReference: {
      responsibleRootId: product.responsibleRootId,
      productCode: product.productCode,
      version: product.version,
      status: product.status,
      referenceDate: product.referenceDate,
      foreignOperatorCode: operator?.operatorCode ?? null,
    },
    matchingFields: [],
    localOnlyFields: [],
    officialOnlyFields: [],
    conflictingFields: [],
    missingRequiredAttributes: [],
    conditionalAttributesRequired: [],
    findings: [],
    recommendations: [],
  }

  const officialFields = new Map(presentOfficialFields(product, operator))
  for (const [field, officialValue] of officialFields) {
    const localValue = fieldValue(record, field)
    const common = {
      field,
      localValue,
      officialValue,
      evidenceIds: evidenceFor(evidences, field),
    }
    if (localValue === null) {
      result.officialOnlyFields.push(common)
    } else if (sameFieldValue(field, localValue, officialValue)) {
      result.matchingFields.push(common)
    } else {
      result.conflictingFields.push(common)
      result.findings.push(finding({
        idFactory,
        timestamp,
        field,
        productId: record.productId,
        reason: `official_${field}_conflict`,
        evidenceIds: [
          ...(record.fields[field]?.evidenceIds ?? []),
          ...common.evidenceIds,
        ],
        resolutionCriteria: `Revisar a divergência de ${field} sem sobrescrever as fontes`,
        severity: field === "reportedNcm" ? "HIGH" : "MEDIUM",
      }))
    }
  }

  for (const [field, consolidated] of Object.entries(record.fields)) {
    if (
      consolidated.value !== null &&
      !officialFields.has(field) &&
      !["MISSING", "CONFLICTING"].includes(consolidated.status)
    ) {
      result.localOnlyFields.push({ field, localValue: consolidated.value })
    }
  }

  for (const requirement of requirements) {
    const localAttribute = record.attributes[requirement.code]
    const missing = !localAttribute || localAttribute.status === "MISSING"
    const requirementEvidenceIds = evidenceFor(
      evidences,
      `attributeRequirement.${requirement.code}`,
    )
    if (requirement.required && !requirement.conditional && missing) {
      const gap = {
        code: requirement.code,
        name: requirement.name,
        evidenceIds: requirementEvidenceIds,
      }
      result.missingRequiredAttributes.push(gap)
      result.findings.push(finding({
        idFactory,
        timestamp,
        type: "MISSING_FIELD",
        field: `attributes.${requirement.code}`,
        productId: record.productId,
        reason: "official_required_attribute_missing",
        evidenceIds: requirementEvidenceIds,
        resolutionCriteria: `Obter/preencher ${requirement.name ?? requirement.code}`,
      }))
      result.recommendations.push({
        type: "COLLECT_OFFICIAL_ATTRIBUTE",
        field: `attributes.${requirement.code}`,
        reason: `Obter/preencher ${requirement.name ?? requirement.code}`,
        evidenceIds: requirementEvidenceIds,
      })
    }
    if (requirement.conditional && missing) {
      result.conditionalAttributesRequired.push({
        code: requirement.code,
        name: requirement.name,
        conditions: requirement.conditions,
        evidenceIds: requirementEvidenceIds,
      })
    }
  }

  const localVersion = localProduct.siscomexVersion ?? localProduct.officialVersion
  if (localVersion && String(localVersion) !== String(product.version)) {
    result.findings.push(finding({
      idFactory,
      timestamp,
      field: "siscomexProductVersion",
      productId: record.productId,
      reason: "official_version_divergence",
      evidenceIds: evidenceFor(evidences, "siscomexProductVersion"),
      resolutionCriteria: "Revisar a versão oficial vinculada ao produto",
    }))
  }
  if (["desativado", "1"].includes(normalized(product.status))) {
    result.findings.push(finding({
      idFactory,
      timestamp,
      field: "officialStatus",
      productId: record.productId,
      reason: "official_product_inactive",
      evidenceIds: evidenceFor(evidences, "officialStatus"),
      resolutionCriteria: "Revisar o uso de produto desativado no CATP",
      severity: "HIGH",
    }))
  }

  return result
}
