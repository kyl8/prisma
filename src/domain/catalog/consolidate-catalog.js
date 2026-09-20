const STRONG_IDENTIFIER_TYPES = new Set([
  "SKU",
  "PART_NUMBER",
  "GTIN",
  "SUPPLIER_CODE",
  "PRODUCT_CODE",
  "EXTERNAL_KEY",
])

export const DEFAULT_ESSENTIAL_CATALOG_FIELDS = Object.freeze([
  "description",
  "manufacturer",
  "model",
  "partNumber",
  "reportedNcm",
  "originCountry",
])

const DIRECT_FIELDS = Object.freeze({
  description: "description",
  manufacturer: "manufacturer",
  model: "model",
  countryOfOrigin: "originCountry",
  originCountry: "originCountry",
  material: "material",
  application: "application",
  ncm: "reportedNcm",
  reportedNcm: "reportedNcm",
  unit: "quantityUnit",
  quantityUnit: "quantityUnit",
})

const IDENTIFIER_FIELDS = Object.freeze({
  SKU: "sku",
  PART_NUMBER: "partNumber",
  GTIN: "gtin",
  SUPPLIER_CODE: "supplierCode",
  PRODUCT_CODE: "productCode",
  EXTERNAL_KEY: "externalKey",
})

const RECOMMENDATION_LABELS = Object.freeze({
  description: "descrição",
  manufacturer: "fabricante",
  model: "modelo",
  partNumber: "part number",
  sku: "SKU",
  gtin: "GTIN",
  supplierCode: "código do fornecedor",
  productCode: "código do produto",
  reportedNcm: "NCM informada",
  originCountry: "país de origem",
  material: "material",
  application: "aplicação",
  quantityUnit: "unidade",
})

const GENERIC_DESCRIPTIONS = new Set([
  "PART",
  "PARTS",
  "INDUSTRIAL PART",
  "INDUSTRIAL PARTS",
  "PIECE",
  "PEÇA",
  "COMPONENT",
  "COMPONENTS",
  "PUMP",
])

function normalized(value) {
  if (typeof value === "string") {
    return value.trim().toLocaleUpperCase("pt-BR")
  }
  return JSON.stringify(value)
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== ""
}

function normalizeIdentifierType(type) {
  const normalizedType = String(type ?? "PRODUCT_CODE")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
  if (normalizedType === "PARTNUMBER") return "PART_NUMBER"
  if (normalizedType === "SUPPLIER_ITEM_CODE") return "SUPPLIER_CODE"
  if (normalizedType === "EAN") return "GTIN"
  return normalizedType
}

function identifiersForProduct(product) {
  return [
    ...(product.identifiers ?? []),
    { type: "SKU", value: product.sku },
    { type: "PART_NUMBER", value: product.partNumber },
    { type: "GTIN", value: product.gtin },
    { type: "SUPPLIER_CODE", value: product.supplierCode },
    { type: "PRODUCT_CODE", value: product.productIdentification },
    { type: "EXTERNAL_KEY", value: product.externalKey },
  ]
    .filter((identifier) => hasValue(identifier?.value))
    .map((identifier) => ({
      type: normalizeIdentifierType(identifier.type),
      value: identifier.value,
    }))
}

function strongIdentifierKeys(identifiers) {
  return identifiers
    .filter((identifier) => STRONG_IDENTIFIER_TYPES.has(identifier.type))
    .map((identifier) => `${identifier.type}:${normalized(identifier.value)}`)
}

function fieldForIdentifier(type) {
  return IDENTIFIER_FIELDS[normalizeIdentifierType(type)] ?? null
}

function outputFieldForEvidence(evidence) {
  if (evidence.field === "productIdentification") {
    return fieldForIdentifier(evidence.identifierType)
  }
  if (evidence.field === "classificationEvidence") return "reportedNcm"
  return DIRECT_FIELDS[evidence.field] ?? evidence.field
}

function publicSource(source) {
  return Object.fromEntries(
    Object.entries({
      type: source.type,
      productId: source.productId,
      documentId: source.documentId,
      documentType: source.documentType,
      documentItemId: source.documentItemId,
      page: source.page,
      section: source.section,
      sheet: source.sheet,
      row: source.row,
      column: source.column,
      cell: source.cell,
    }).filter(([, value]) => value !== undefined && value !== null),
  )
}

function sourceKey(source) {
  return JSON.stringify(publicSource(source))
}

function createCandidate({ value, rawValue, evidenceIds = [], source, status = "reported", classificationSupported = false }) {
  return {
    value,
    rawValue: rawValue === undefined ? value : rawValue,
    evidenceIds,
    source: publicSource(source),
    status,
    classificationSupported,
  }
}

function addCandidate(map, field, candidate) {
  if (!field || !hasValue(candidate.value)) return
  if (!map.has(field)) map.set(field, [])
  map.get(field).push(candidate)
}

function consolidateField(field, candidates) {
  if (!candidates?.length) {
    return {
      field,
      value: null,
      status: "MISSING",
      evidenceIds: [],
      sources: [],
      rawValues: [],
    }
  }
  const uniqueCandidates = [
    ...new Map(
      candidates.map((candidate) => [
        `${sourceKey(candidate.source)}:${normalized(candidate.value)}`,
        candidate,
      ]),
    ).values(),
  ]
  const genericCatalogCandidates = field === "description"
    ? uniqueCandidates.filter(
        (candidate) =>
          candidate.source.type === "existing_catalog" &&
          GENERIC_DESCRIPTIONS.has(normalized(candidate.value)),
      )
    : []
  const authoritativeCandidates = uniqueCandidates.filter(
    (candidate) => !genericCatalogCandidates.includes(candidate),
  )
  const effectiveCandidates =
    authoritativeCandidates.some((candidate) => candidate.source.type === "document")
      ? authoritativeCandidates
      : uniqueCandidates
  const values = new Map()
  for (const candidate of effectiveCandidates) {
    const key = normalized(candidate.value)
    if (!values.has(key)) values.set(key, candidate.value)
  }
  const evidenceIds = [...new Set(effectiveCandidates.flatMap((item) => item.evidenceIds))]
  const sources = [
    ...new Map(effectiveCandidates.map((item) => [sourceKey(item.source), item.source])).values(),
  ]
  const rawValues = uniqueCandidates.map((item) => ({
    value: item.rawValue,
    source: item.source,
  }))
  if (values.size > 1) {
    return {
      field,
      value: null,
      status: "CONFLICTING",
      values: [...values.values()],
      evidenceIds,
      sources,
      rawValues,
    }
  }
  const value = [...values.values()][0]
  if (field === "reportedNcm") {
    const supported = effectiveCandidates.some((item) => item.classificationSupported)
    return {
      field,
      value,
      status: supported ? "REPORTED" : "UNVERIFIED",
      evidenceIds,
      sources,
      rawValues,
    }
  }
  const independentlyReported = new Set(sources.map(sourceKey)).size > 1
  const allUnverified = effectiveCandidates.every((item) => item.status === "unverified")
  const allInferred = effectiveCandidates.every((item) => item.status === "inferred")
  const consolidated = {
    field,
    value,
    status: allUnverified
      ? "UNVERIFIED"
      : allInferred
        ? "INSUFFICIENT_EVIDENCE"
        : independentlyReported
          ? "CONFIRMED"
          : "REPORTED",
    evidenceIds,
    sources,
    rawValues,
  }
  if (genericCatalogCandidates.length > 0 && effectiveCandidates !== uniqueCandidates) {
    consolidated.selectionReason = "REPLACED_GENERIC_CATALOG_DESCRIPTION"
    consolidated.discardedValues = genericCatalogCandidates.map((item) => ({
      value: item.value,
      source: item.source,
    }))
  }
  return consolidated
}

function findingSummary(finding) {
  return {
    id: finding.id,
    type: finding.type,
    field: finding.field,
    reason: finding.reason,
    severity: finding.severity,
    blocking: finding.blocking,
    status: finding.status,
    evidenceIds: [...(finding.evidenceIds ?? [])],
  }
}

function recommendationForField(field, consolidated, findings) {
  const relatedFindings = findings.filter(
    (finding) =>
      outputFieldForEvidence({
        field: finding.field,
        identifierType: finding.identifierType,
      }) === field ||
      (finding.evidenceIds ?? []).some((id) => consolidated.evidenceIds.includes(id)),
  )
  const common = {
    field,
    findingIds: relatedFindings.map((finding) => finding.id),
    evidenceIds: [...consolidated.evidenceIds],
    priority: relatedFindings.some((finding) => finding.severity === "HIGH")
      ? "HIGH"
      : "MEDIUM",
  }
  const label = RECOMMENDATION_LABELS[field] ?? field
  if (consolidated.status === "CONFLICTING") {
    return {
      ...common,
      type: "CONFIRM_CONFLICTING_FIELD",
      reason: `Confirmar ${label} entre fontes conflitantes`,
    }
  }
  if (consolidated.status === "MISSING") {
    return {
      ...common,
      type: "PROVIDE_MISSING_FIELD",
      reason: `Adicionar ${label} com fonte rastreável`,
    }
  }
  if (field === "reportedNcm" && consolidated.status === "UNVERIFIED") {
    return {
      ...common,
      type: "REVIEW_CLASSIFICATION",
      reason: "Revisar a NCM informada; não há evidência técnica suficiente para validá-la",
    }
  }
  if (consolidated.status === "UNVERIFIED") {
    return {
      ...common,
      type: "VERIFY_FIELD",
      reason: `Verificar ${label} em fonte confiável`,
    }
  }
  if (consolidated.status === "INSUFFICIENT_EVIDENCE") {
    return {
      ...common,
      type: "COLLECT_EVIDENCE",
      reason: `Coletar evidência adicional para ${label}`,
    }
  }
  return null
}

function buildRecommendations(fields, essentialFields, findings, duplicateCount) {
  const recommendations = []
  for (const [field, consolidated] of Object.entries(fields)) {
    if (consolidated.status === "MISSING" && !essentialFields.includes(field)) continue
    const recommendation = recommendationForField(field, consolidated, findings)
    if (recommendation) recommendations.push(recommendation)
  }
  for (const finding of findings) {
    if (finding.type === "POSSIBLE_DUPLICATE") {
      recommendations.push({
        field: "productIdentification",
        type: "CONSOLIDATE_DUPLICATES",
        reason: "Revisar e consolidar cadastros equivalentes",
        findingIds: [finding.id],
        evidenceIds: [...(finding.evidenceIds ?? [])],
        priority: finding.severity ?? "MEDIUM",
      })
    }
    if (["INSUFFICIENT_PRODUCT_IDENTITY", "CONFLICTING_PRODUCT_IDENTITY"].includes(finding.type)) {
      recommendations.push({
        field: "productIdentification",
        type: "REVIEW_PRODUCT_IDENTITY",
        reason: finding.type === "CONFLICTING_PRODUCT_IDENTITY"
          ? "Resolver identificadores de produto conflitantes"
          : "Fornecer identificador forte para relacionar os itens",
        findingIds: [finding.id],
        evidenceIds: [...(finding.evidenceIds ?? [])],
        priority: finding.severity ?? "HIGH",
      })
    }
  }
  if (duplicateCount > 1 && !recommendations.some((item) => item.type === "CONSOLIDATE_DUPLICATES")) {
    recommendations.push({
      field: "productIdentification",
      type: "CONSOLIDATE_DUPLICATES",
      reason: "Revisar os cadastros ligados pelo mesmo identificador forte",
      findingIds: [],
      evidenceIds: [],
      priority: "MEDIUM",
    })
  }
  return [
    ...new Map(
      recommendations.map((item) => [
        `${item.type}:${item.field}:${item.reason}`,
        item,
      ]),
    ).values(),
  ]
}

function qualityFor(fields, essentialFields, findings) {
  const entries = Object.values(fields)
  const missingFields = essentialFields.filter(
    (field) => fields[field]?.status === "MISSING" || !fields[field],
  )
  const conflictingFields = entries
    .filter((item) => item.status === "CONFLICTING")
    .map((item) => item.field)
  const reasons = []
  for (const item of entries) {
    if (item.status === "CONFLICTING") reasons.push(`${item.field}_conflict`)
    if (item.status === "MISSING" && essentialFields.includes(item.field)) {
      reasons.push(`${item.field}_missing`)
    }
    if (item.status === "UNVERIFIED") reasons.push(`${item.field}_unverified`)
    if (item.status === "INSUFFICIENT_EVIDENCE") {
      reasons.push(`${item.field}_insufficient_evidence`)
    }
  }
  reasons.push(...findings.map((finding) => finding.reason))
  const presentFields = entries.filter(
    (item) => !["MISSING", "CONFLICTING"].includes(item.status),
  )
  const reviewFinding = findings.some(
    (finding) => !["MISSING_FIELD"].includes(finding.type),
  )
  const needsReview = entries.some(
    (item) => ["UNVERIFIED", "INSUFFICIENT_EVIDENCE"].includes(item.status),
  ) || reviewFinding
  const status = conflictingFields.length
    ? "CONFLICTING"
    : presentFields.length <= 1
      ? "INSUFFICIENT_DATA"
      : missingFields.length
        ? "PARTIAL"
        : needsReview
          ? "REQUIRES_REVIEW"
          : "COMPLETE"
  return {
    status,
    reasons: [...new Set(reasons)],
    missingFields,
    conflictingFields,
  }
}

function originalValue(product, field) {
  if (!product) return null
  const direct = {
    description: product.description,
    manufacturer: product.manufacturer,
    model: product.model,
    partNumber: product.partNumber,
    sku: product.sku,
    gtin: product.gtin,
    supplierCode: product.supplierCode,
    productCode: product.productIdentification,
    reportedNcm: product.reportedNcm ?? product.ncm,
    originCountry: product.originCountry ?? product.countryOfOrigin,
    material: product.material,
    application: product.application,
    quantityUnit: product.quantityUnit ?? product.unit,
  }[field]
  if (hasValue(direct)) return direct
  const identifierType = Object.entries(IDENTIFIER_FIELDS)
    .find(([, output]) => output === field)?.[0]
  return product.identifiers?.find(
    (identifier) => normalizeIdentifierType(identifier.type) === identifierType,
  )?.value ?? null
}

export function createCatalogDiff(record) {
  const beforeProduct = record.originalRecords[0] ?? null
  const diff = {
    catalogRecordId: record.catalogRecordId,
    productId: record.productId,
    changedFields: [],
    unchangedFields: [],
    conflictingFields: [],
    missingFields: [],
  }
  for (const [field, consolidated] of Object.entries(record.fields)) {
    const before = originalValue(beforeProduct, field)
    const common = {
      field,
      before,
      after: consolidated.value,
      evidenceIds: [...consolidated.evidenceIds],
    }
    if (consolidated.status === "CONFLICTING") {
      diff.conflictingFields.push({ ...common, values: consolidated.values })
    } else if (consolidated.status === "MISSING") {
      diff.missingFields.push(common)
    } else if (hasValue(before) && normalized(before) === normalized(consolidated.value)) {
      diff.unchangedFields.push(common)
    } else {
      diff.changedFields.push({
        ...common,
        changeType: hasValue(before) ? "CHANGED" : "ADDED",
      })
    }
  }
  diff.counts = {
    enriched: diff.changedFields.filter((item) => item.changeType === "ADDED").length,
    changed: diff.changedFields.filter((item) => item.changeType === "CHANGED").length,
    unchanged: diff.unchangedFields.length,
    conflicting: diff.conflictingFields.length,
    missing: diff.missingFields.length,
    unverified: Object.values(record.fields).filter(
      (item) => item.status === "UNVERIFIED",
    ).length,
  }
  return diff
}

function createNodes(operationalCase) {
  const nodes = []
  for (const product of operationalCase.products ?? []) {
    nodes.push({
      kind: "catalog",
      key: `catalog:${product.id}`,
      product,
      identifiers: identifiersForProduct(product),
    })
  }
  for (const document of operationalCase.documents ?? []) {
    for (const item of document.items ?? []) {
      nodes.push({
        kind: "documentItem",
        key: `item:${item.documentItemId}`,
        document,
        item,
        identifiers: (item.identifiers ?? []).map((identifier) => ({
          type: normalizeIdentifierType(identifier.type),
          value: identifier.value,
        })),
      })
    }
  }
  if (nodes.length === 0 && (operationalCase.evidences ?? []).length > 0) {
    nodes.push({ kind: "case", key: `case:${operationalCase.id}`, identifiers: [] })
  }
  return nodes
}

function groupNodes(nodes) {
  const parent = nodes.map((_, index) => index)
  const root = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]]
      index = parent[index]
    }
    return index
  }
  const join = (left, right) => {
    left = root(left)
    right = root(right)
    if (left !== right) parent[right] = left
  }
  const owners = new Map()
  nodes.forEach((node, index) => {
    for (const key of strongIdentifierKeys(node.identifiers)) {
      if (owners.has(key)) join(index, owners.get(key))
      else owners.set(key, index)
    }
  })
  const groups = new Map()
  nodes.forEach((node, index) => {
    const key = root(index)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(node)
  })
  return [...groups.values()]
}

function evidenceForItem(operationalCase, item, field, identifierType, value) {
  return (operationalCase.evidences ?? []).filter(
    (evidence) =>
      evidence.entityType === "documentItem" &&
      evidence.entityId === item.documentItemId &&
      evidence.field === field &&
      (!identifierType ||
        !evidence.identifierType ||
        normalizeIdentifierType(evidence.identifierType) === normalizeIdentifierType(identifierType)) &&
      normalized(evidence.normalizedValue) === normalized(value),
  )
}

function collectGroupCandidates(operationalCase, group, attachCaseEvidence) {
  const fields = new Map()
  const attributes = new Map()
  for (const node of group) {
    if (node.kind === "catalog") {
      const product = node.product
      for (const [input, output] of Object.entries(DIRECT_FIELDS)) {
        if (!hasValue(product[input])) continue
        addCandidate(fields, output, createCandidate({
          value: product[input],
          source: { type: "existing_catalog", productId: product.id },
          classificationSupported:
            output === "reportedNcm" && Boolean(product.classificationEvidence),
        }))
      }
      for (const identifier of node.identifiers) {
        addCandidate(fields, fieldForIdentifier(identifier.type), createCandidate({
          value: identifier.value,
          source: { type: "existing_catalog", productId: product.id },
        }))
      }
      for (const [field, value] of Object.entries(product.attributes ?? {})) {
        addCandidate(attributes, field, createCandidate({
          value,
          source: { type: "existing_catalog", productId: product.id },
        }))
      }
    }
    if (node.kind === "documentItem") {
      for (const field of node.item.fields ?? []) {
        const output = field.field === "productIdentification"
          ? fieldForIdentifier(field.identifierType)
          : DIRECT_FIELDS[field.field] ?? field.field
        const evidences = evidenceForItem(
          operationalCase,
          node.item,
          field.field,
          field.identifierType,
          field.normalizedValue,
        )
        addCandidate(fields, output, createCandidate({
          value: field.normalizedValue,
          rawValue: field.rawValue,
          evidenceIds: evidences.map((item) => item.id),
          status: field.status,
          source: {
            type: "document",
            documentId: node.document.id,
            documentType: node.document.type,
            documentItemId: node.item.documentItemId,
            ...field.source,
          },
        }))
      }
      for (const unknown of node.item.unknownFields ?? []) {
        addCandidate(attributes, unknown.originalField, createCandidate({
          value: unknown.normalizedValue,
          rawValue: unknown.rawValue,
          source: {
            type: "document",
            documentId: node.document.id,
            documentType: node.document.type,
            documentItemId: node.item.documentItemId,
            ...unknown.source,
          },
          status: unknown.status,
        }))
      }
    }
  }
  if (attachCaseEvidence) {
    for (const evidence of operationalCase.evidences ?? []) {
      if (evidence.entityType !== "case" || evidence.status === "missing") continue
      addCandidate(fields, outputFieldForEvidence(evidence), createCandidate({
        value: evidence.normalizedValue,
        rawValue: evidence.rawValue,
        evidenceIds: [evidence.id],
        status: evidence.status,
        source: { ...evidence.source },
      }))
    }
  }
  return { fields, attributes }
}

function relevantFindings(operationalCase, group, evidenceIds, onlyRecord) {
  const productIds = new Set(
    group.filter((node) => node.kind === "catalog").map((node) => node.product.id),
  )
  const evidenceIdSet = new Set(evidenceIds)
  return (operationalCase.findings ?? []).filter(
    (finding) =>
      finding.status === "OPEN" &&
      (productIds.has(finding.entityId) ||
        (finding.evidenceIds ?? []).some((id) => evidenceIdSet.has(id)) ||
        (onlyRecord && finding.entityType === "case")),
  )
}

function productIdentityForGroup(operationalCase, group) {
  const itemIds = new Set(
    group
      .filter((node) => node.kind === "documentItem")
      .map((node) => node.item.documentItemId),
  )
  return (operationalCase.productIdentities ?? []).find((identity) =>
    identity.documentItemRefs.some((ref) => itemIds.has(ref.documentItemId)),
  )
}

function recordFromGroup(operationalCase, group, essentialFields, groupCount) {
  const originalRecords = group
    .filter((node) => node.kind === "catalog")
    .map((node) => node.product)
  const recordEssentialFields = [
    ...new Set([
      ...essentialFields,
      ...originalRecords.flatMap((product) =>
        (product.requiredFields ?? []).map(
          (field) => DIRECT_FIELDS[field] ?? field,
        ),
      ),
    ]),
  ]
  const identity = productIdentityForGroup(operationalCase, group)
  const productId = originalRecords[0]?.id ?? identity?.productId ?? group[0].key
  const collected = collectGroupCandidates(
    operationalCase,
    group,
    groupCount === 1,
  )
  const allFieldNames = new Set([
    ...recordEssentialFields,
    ...collected.fields.keys(),
  ])
  const fields = Object.fromEntries(
    [...allFieldNames].map((field) => [
      field,
      consolidateField(field, collected.fields.get(field)),
    ]),
  )
  const attributes = Object.fromEntries(
    [...collected.attributes].map(([field, candidates]) => [
      field,
      consolidateField(field, candidates),
    ]),
  )
  const evidenceIds = [
    ...new Set([
      ...Object.values(fields).flatMap((field) => field.evidenceIds),
      ...Object.values(attributes).flatMap((field) => field.evidenceIds),
    ]),
  ]
  const findings = relevantFindings(
    operationalCase,
    group,
    evidenceIds,
    groupCount === 1,
  )
  const quality = qualityFor(fields, recordEssentialFields, findings)
  const recommendations = buildRecommendations(
    fields,
    recordEssentialFields,
    findings,
    originalRecords.length,
  )
  const identifiers = [
    ...new Map(
      group.flatMap((node) => node.identifiers).map((identifier) => [
        `${identifier.type}:${normalized(identifier.value)}`,
        identifier,
      ]),
    ).values(),
  ]
  const sourceDocuments = [
    ...new Map(
      [
        ...group
          .filter((node) => node.kind === "documentItem")
          .map((node) => ({
            documentId: node.document.id,
            type: node.document.type,
          })),
        ...Object.values(fields)
          .flatMap((field) => field.sources)
          .filter((source) => source.documentId)
          .map((source) => ({
            documentId: source.documentId,
            type: source.documentType ?? null,
          })),
      ].map((document) => [document.documentId, document]),
    ).values(),
  ]
  const record = {
    catalogRecordId: `catalog:${productId}`,
    productId,
    sourceProductIds: originalRecords.map((product) => product.id),
    essentialFields: recordEssentialFields,
    identifiers,
    qualityStatus: quality.status,
    qualityReasons: quality.reasons,
    fields,
    attributes,
    missingFields: quality.missingFields,
    conflictingFields: quality.conflictingFields,
    findings: findings.map(findingSummary),
    recommendations,
    sourceDocuments,
    updatedAt: operationalCase.updatedAt,
    originalRecords,
  }
  record.diff = createCatalogDiff(record)
  return record
}

export function createCatalogSummary(records) {
  const count = (status) => records.filter((record) => record.qualityStatus === status).length
  const issues = new Map()
  for (const record of records) {
    for (const reason of new Set(record.qualityReasons)) {
      issues.set(reason, (issues.get(reason) ?? 0) + 1)
    }
  }
  return {
    products: records.length,
    complete: count("COMPLETE"),
    partial: count("PARTIAL"),
    requiresReview: count("REQUIRES_REVIEW"),
    conflicting: count("CONFLICTING"),
    insufficientData: count("INSUFFICIENT_DATA"),
    topIssues: [...issues]
      .map(([type, issueCount]) => ({ type, count: issueCount }))
      .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
  }
}

export function consolidateCatalog(operationalCase, policy = {}) {
  const essentialFields = [
    ...new Set(
      policy.essentialFields ??
      operationalCase.metadata?.catalogPolicy?.essentialFields ??
      DEFAULT_ESSENTIAL_CATALOG_FIELDS,
    ),
  ]
  const groups = groupNodes(createNodes(operationalCase))
  const records = groups.map((group) =>
    recordFromGroup(operationalCase, group, essentialFields, groups.length),
  )
  return {
    caseId: operationalCase.id,
    generatedAt: operationalCase.updatedAt,
    policy: { essentialFields },
    summary: createCatalogSummary(records),
    records,
  }
}
