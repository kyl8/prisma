import { createHash } from "node:crypto"

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`
    ).join(",")}}`
  }
  return JSON.stringify(value)
}

export function siscomexPayloadHash(payload) {
  return createHash("sha256").update(canonical(payload)).digest("hex")
}

export function createSiscomexSnapshot(input, { id, timestamp }) {
  const payloadHash = siscomexPayloadHash(input.payload)
  return {
    id,
    caseId: input.caseId ?? null,
    productId: input.productId ?? null,
    subsystem: input.subsystem,
    environment: input.environment,
    resourceType: input.resourceType,
    resourceKey: input.resourceKey,
    externalProductCode: input.externalProductCode ?? null,
    externalVersion: input.externalVersion === undefined
      ? null
      : String(input.externalVersion),
    foreignOperatorCode: input.foreignOperatorCode ?? null,
    ncm: input.ncm ?? null,
    payload: structuredClone(input.payload),
    payloadHash,
    fetchedAt: input.fetchedAt ?? timestamp,
    validFrom: input.validFrom ?? null,
    validTo: input.validTo ?? null,
    status: input.status ?? "FRESH",
    createdAt: timestamp,
  }
}

export function snapshotFreshness(snapshot, ttlSeconds, now = Date.now()) {
  if (!snapshot) return "UNAVAILABLE"
  const fetchedAt = Date.parse(snapshot.cacheCheckedAt ?? snapshot.fetchedAt)
  if (!Number.isFinite(fetchedAt)) return "STALE"
  return now - fetchedAt <= ttlSeconds * 1000 ? "FRESH" : "STALE"
}
