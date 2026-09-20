const GENERIC_DESCRIPTIONS = new Set([
  "part",
  "parts",
  "industrial part",
  "industrial parts",
  "piece",
  "peça",
  "peça metálica",
  "component",
  "components",
  "componente",
  "componentes",
  "pump",
])

function normalize(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("pt-BR")
    : value
}

function isGenericDescription(description) {
  return !description || GENERIC_DESCRIPTIONS.has(normalize(description))
}

function hasClassificationEvidence(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "string") return value.trim().length > 0
  if (value && typeof value === "object") return Object.keys(value).length > 0
  return false
}

function documentedValues(evidences, field) {
  return new Set(
    evidences
      .filter(
        (evidence) =>
          evidence.field === field &&
          evidence.source.type === "document" &&
          evidence.status !== "conflicting",
      )
      .map((evidence) => normalize(evidence.value)),
  )
}

export function evaluateCatalog(products, reconciliation = {}) {
  const evidences = reconciliation.evidences ?? []
  const results = products.map((product) => {
    const reasons = []
    const conflicts = []

    if (isGenericDescription(product.description)) {
      reasons.push("generic_description")
    }

    const requiredFields = new Set([
      "manufacturer",
      "model",
      ...(product.requiredFields ?? []),
    ])
    for (const field of requiredFields) {
      if (!product[field]) {
        reasons.push(`${field}_missing`)
      }
    }

    if (!product.ncm) {
      reasons.push("ncm_missing")
    }

    const classificationStatus = product.ncm
      ? hasClassificationEvidence(product.classificationEvidence)
        ? "reported_with_evidence"
        : "insufficient_evidence"
      : "insufficient_evidence"

    if (product.ncm && classificationStatus === "insufficient_evidence") {
      reasons.push("classification_insufficient_evidence")
    }

    if (product.outdated === true) {
      reasons.push("outdated_information")
    }

    for (const field of [
      "description",
      "manufacturer",
      "model",
      "countryOfOrigin",
      "ncm",
    ]) {
      if (!product[field]) continue
      const values = documentedValues(evidences, field)
      if (values.size > 0 && !values.has(normalize(product[field]))) {
        conflicts.push({ field, catalogValue: product[field] })
        reasons.push(`${field}_catalog_conflict`)
      }
    }

    return {
      productId: product.id ?? null,
      status:
        conflicts.length > 0
          ? "conflicting"
          : reasons.length > 0
            ? "requires_review"
            : "compliant",
      classificationStatus,
      reasons,
      conflicts,
    }
  })

  const duplicateGroups = new Map()
  for (const [index, product] of products.entries()) {
    const key = [product.description, product.manufacturer, product.model]
      .map((value) => normalize(value ?? ""))
      .join("|")
    const group = duplicateGroups.get(key) ?? []
    group.push({
      index,
      productId: product.id ?? null,
      reviewed: product.duplicateReview === true,
    })
    duplicateGroups.set(key, group)
  }

  const duplicateEntries = [...duplicateGroups.values()].filter(
    (group) => group.length > 1 && group.some((entry) => !entry.reviewed),
  )
  const possibleDuplicates = duplicateEntries.map((group) =>
    group.map(({ productId }) => productId),
  )

  for (const group of duplicateEntries) {
    for (const { index, reviewed } of group) {
      if (reviewed) continue
      const result = results[index]
      result.reasons.push("possible_duplicate")
      if (result.status === "compliant") result.status = "requires_review"
    }
  }

  const status = results.some((result) => result.status === "conflicting")
    ? "conflicting"
    : results.some((result) => result.status === "requires_review")
      ? "requires_review"
      : products.length === 0
        ? "insufficient_data"
        : "compliant"

  return { status, products: results, possibleDuplicates }
}
