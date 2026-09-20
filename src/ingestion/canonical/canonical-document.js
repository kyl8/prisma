import { ValidationError } from "../../domain/shared/errors.js"

export const CANONICAL_DOCUMENT_TYPES = Object.freeze([
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "BILL_OF_LADING",
  "AIR_WAYBILL",
  "LPCO",
  "DUIMP",
  "TECHNICAL_DATASHEET",
  "SPREADSHEET",
  "UNKNOWN",
])

const TYPE_ALIASES = Object.freeze({
  INVOICE: "COMMERCIAL_INVOICE",
  COMMERCIALINVOICE: "COMMERCIAL_INVOICE",
  PACKINGLIST: "PACKING_LIST",
  BL: "BILL_OF_LADING",
  BILL_OF_LADING: "BILL_OF_LADING",
  AWB: "AIR_WAYBILL",
  AIRWAYBILL: "AIR_WAYBILL",
  TECHNICALSHEET: "TECHNICAL_DATASHEET",
  DATASHEET: "TECHNICAL_DATASHEET",
})

export function normalizeDocumentType(value) {
  if (!value) return "UNKNOWN"
  const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, "_")
  if (CANONICAL_DOCUMENT_TYPES.includes(normalized)) return normalized
  return TYPE_ALIASES[normalized.replaceAll("_", "")] ?? TYPE_ALIASES[normalized] ?? "UNKNOWN"
}

export function createCanonicalField(input) {
  if (!input?.field) throw new ValidationError("CanonicalField requires field")
  if (!input.source?.documentId) {
    throw new ValidationError("CanonicalField requires source.documentId")
  }

  return {
    field: input.field,
    value: input.value ?? null,
    normalizedValue:
      input.normalizedValue === undefined ? input.value ?? null : input.normalizedValue,
    rawValue: input.rawValue === undefined ? null : input.rawValue,
    status: input.status ?? "reported",
    source: {
      documentId: input.source.documentId,
      documentType: normalizeDocumentType(input.source.documentType),
      fileName: input.source.fileName ?? null,
      page: input.source.page ?? null,
      section: input.source.section ?? null,
      boundingReference: input.source.boundingReference ?? null,
      sheet: input.source.sheet ?? null,
      row: input.source.row ?? null,
      column: input.source.column ?? null,
      cell: input.source.cell ?? null,
      provider: input.source.provider ?? null,
      resource: input.source.resource ?? null,
      externalId: input.source.externalId ?? null,
      actor: input.source.actor ?? null,
      role: input.source.role ?? null,
      timestamp: input.source.timestamp ?? null,
    },
    extraction: {
      method: input.extraction?.method ?? "STRUCTURED",
      confidence: input.extraction?.confidence ?? null,
    },
    normalizedUnit: input.normalizedUnit ?? null,
    currency: input.currency ?? null,
    identifierType: input.identifierType ?? null,
  }
}

export function createCanonicalDocument(input) {
  if (!input?.id) throw new ValidationError("CanonicalDocument requires id")
  if (!input.source?.format || !input.source?.method) {
    throw new ValidationError("CanonicalDocument requires source.format and source.method")
  }

  const type = normalizeDocumentType(input.type)
  return {
    id: input.id,
    type,
    source: {
      format: String(input.source.format).toUpperCase(),
      method: String(input.source.method).toUpperCase(),
      fileName: input.source.fileName ?? null,
      provider: input.source.provider ?? null,
      resource: input.source.resource ?? null,
      externalId: input.source.externalId ?? null,
      timestamp: input.source.timestamp ?? null,
      actor: input.source.actor ?? null,
      role: input.source.role ?? null,
    },
    metadata: { ...(input.metadata ?? {}) },
    parties: { ...(input.parties ?? {}) },
    shipment: { ...(input.shipment ?? {}) },
    items: [...(input.items ?? [])],
    fields: [...(input.fields ?? [])],
    unknownFields: [...(input.unknownFields ?? [])],
    rawExtraction: input.rawExtraction ?? null,
  }
}
