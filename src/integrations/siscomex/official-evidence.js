import { createEvidence } from "../../domain/evidence/evidence.js"

function hasValue(value) {
  return value !== undefined && value !== null && value !== ""
}

function source(snapshot, entity, extra = {}) {
  return {
    type: "SISCOMEX",
    subsystem: snapshot.subsystem,
    environment: snapshot.environment,
    entity,
    snapshotId: snapshot.id,
    fetchedAt: snapshot.fetchedAt,
    payloadHash: snapshot.payloadHash,
    ...extra,
  }
}

function evidence(input, context) {
  return createEvidence({
    ...input,
    status: "reported",
    confidence: "high",
    extraction: { method: "OFFICIAL_API", confidence: 1 },
  }, context)
}

export function officialProductEvidence(product, snapshot, {
  productId,
  idFactory,
  timestamp,
}) {
  const common = {
    entityType: "product",
    entityId: productId,
  }
  const fields = [
    ["siscomexProductCode", product.productCode],
    ["siscomexProductVersion", product.version],
    ["officialStatus", product.status],
    ["operationMode", product.operationMode],
    ["reportedNcm", product.ncm],
    ["description", product.denomination ?? product.complementaryDescription],
  ]
  const result = fields
    .filter(([, value]) => hasValue(value))
    .map(([field, value]) => evidence({
      ...common,
      field,
      value,
      normalizedValue: value,
      rawValue: value,
      source: source(snapshot, "PRODUCT", {
        productCode: product.productCode,
        version: product.version,
      }),
    }, { id: idFactory(), timestamp }))
  for (const attribute of product.attributes) {
    result.push(evidence({
      ...common,
      field: `attributes.${attribute.code}`,
      value: attribute.value,
      normalizedValue: attribute.value,
      rawValue: attribute.rawPayload,
      source: source(snapshot, "PRODUCT_ATTRIBUTE", {
        productCode: product.productCode,
        version: product.version,
        attributeCode: attribute.code,
      }),
    }, { id: idFactory(), timestamp }))
  }
  return result
}

export function officialOperatorEvidence(operator, snapshot, {
  productId,
  idFactory,
  timestamp,
}) {
  const fields = [
    ["manufacturer", operator.name],
    ["manufacturer.country", operator.country],
    ["manufacturer.tin", operator.tin],
    ["manufacturer.city", operator.city],
    ["manufacturer.subdivision", operator.subdivision],
  ]
  return fields
    .filter(([, value]) => hasValue(value))
    .map(([field, value]) => evidence({
      field,
      value,
      normalizedValue: value,
      rawValue: value,
      entityType: "product",
      entityId: productId,
      source: source(snapshot, "FOREIGN_OPERATOR", {
        operatorCode: operator.operatorCode,
        version: operator.version,
      }),
    }, { id: idFactory(), timestamp }))
}

export function officialAttributeRequirementEvidence(requirements, snapshot, {
  productId,
  idFactory,
  timestamp,
}) {
  return requirements.map((requirement) => evidence({
    field: `attributeRequirement.${requirement.code}`,
    value: {
      required: requirement.required,
      conditional: requirement.conditional,
      conditions: requirement.conditions,
    },
    normalizedValue: requirement.code,
    rawValue: requirement.rawPayload,
    entityType: "product",
    entityId: productId,
    source: source(snapshot, "ATTRIBUTE_REQUIREMENT", {
      ncm: requirement.ncm,
      attributeCode: requirement.code,
    }),
  }, { id: idFactory(), timestamp }))
}
