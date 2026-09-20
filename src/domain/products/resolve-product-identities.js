const CRITICAL_TYPES = new Set(["COMMERCIAL_INVOICE", "PACKING_LIST"])

function normalized(value) {
  return String(value ?? "").trim().toLocaleUpperCase("en-US")
}

function itemIdentifiers(item) {
  return (item.identifiers ?? [])
    .filter((identifier) => normalized(identifier.value))
    .map((identifier) => ({
      type: identifier.type,
      value: normalized(identifier.value),
    }))
}

function finding({ id, key, type, reason, blocking, evidenceIds, timestamp }) {
  return {
    id,
    key,
    type,
    field: "productIdentification",
    entityType: "case",
    entityId: null,
    reason,
    severity: blocking ? "HIGH" : "MEDIUM",
    blocking,
    status: "OPEN",
    evidenceIds,
    resolutionCriteria: [
      "Fornecer SKU, part number, GTIN, model ou codigo externo confiavel",
    ],
    createdAt: timestamp,
    resolvedAt: null,
    dismissedAt: null,
    resolutionReason: null,
    version: 1,
  }
}

export function resolveProductIdentities(
  documents,
  { idFactory, timestamp, evidenceIdsByItem = new Map() },
) {
  const refs = documents.flatMap((document) =>
    (document.items ?? []).map((item) => ({
      documentId: document.id,
      documentType: document.type,
      documentItemId: item.documentItemId,
      identifiers: itemIdentifiers(item),
    })),
  )
  const parent = refs.map((_, index) => index)
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
  const identifierOwner = new Map()
  refs.forEach((ref, index) => {
    for (const identifier of ref.identifiers) {
      const key = `${identifier.type}:${identifier.value}`
      if (identifierOwner.has(key)) join(index, identifierOwner.get(key))
      else identifierOwner.set(key, index)
    }
  })

  const groups = new Map()
  refs.forEach((ref, index) => {
    if (ref.identifiers.length === 0) return
    const key = root(index)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(ref)
  })

  const findings = []
  const productIdentities = []
  for (const group of groups.values()) {
    const identifiers = [
      ...new Map(
        group.flatMap((ref) => ref.identifiers).map((item) => [
          `${item.type}:${item.value}`,
          item,
        ]),
      ).values(),
    ]
    const valuesByType = new Map()
    for (const identifier of identifiers) {
      if (!valuesByType.has(identifier.type)) valuesByType.set(identifier.type, new Set())
      valuesByType.get(identifier.type).add(identifier.value)
    }
    const conflictingTypes = [...valuesByType]
      .filter(([, values]) => values.size > 1)
      .map(([type]) => type)
    const productId = idFactory()
    productIdentities.push({
      productId,
      identifiers,
      documentItemRefs: group.map((ref) => ({
        documentId: ref.documentId,
        documentItemId: ref.documentItemId,
      })),
      status: conflictingTypes.length ? "CONFLICTING" : "MATCHED",
    })
    if (conflictingTypes.length) {
      findings.push(
        finding({
          id: idFactory(),
          key: `CONFLICTING_PRODUCT_IDENTITY:${group
            .map((ref) => ref.documentItemId)
            .sort()
            .join("|")}`,
          type: "CONFLICTING_PRODUCT_IDENTITY",
          reason: `conflicting_identifiers:${conflictingTypes.join(",")}`,
          blocking: true,
          evidenceIds: group.flatMap(
            (ref) => evidenceIdsByItem.get(ref.documentItemId) ?? [],
          ),
          timestamp,
        }),
      )
    }
  }

  const unidentified = refs.filter((ref) => ref.identifiers.length === 0)
  const criticalDocuments = new Set(
    refs
      .filter((ref) => CRITICAL_TYPES.has(ref.documentType))
      .map((ref) => ref.documentId),
  )
  if (unidentified.length > 0 && criticalDocuments.size >= 2) {
    findings.push(
      finding({
        id: idFactory(),
        key: `INSUFFICIENT_PRODUCT_IDENTITY:${unidentified
          .map((ref) => ref.documentItemId)
          .sort()
          .join("|")}`,
        type: "INSUFFICIENT_PRODUCT_IDENTITY",
        reason: "unable_to_match_document_items_reliably",
        blocking: true,
        evidenceIds: unidentified.flatMap(
          (ref) => evidenceIdsByItem.get(ref.documentItemId) ?? [],
        ),
        timestamp,
      }),
    )
  }

  return { productIdentities, findings }
}
