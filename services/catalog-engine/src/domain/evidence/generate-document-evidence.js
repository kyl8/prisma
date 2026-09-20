import { createEvidence } from "./evidence.js"

function businessConfidenceFor(status) {
  if (status === "confirmed") return "high"
  if (["inferred", "unverified", "conflicting"].includes(status)) return "low"
  return "medium"
}

function fieldsToGenerate(document) {
  if (Array.isArray(document.fields) && document.fields.length > 0) {
    return document.fields.map((field) => ({ field, entityType: "case", entityId: null }))
  }
  if (document.fields && !Array.isArray(document.fields)) {
    return Object.entries(document.fields)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([field, value]) => ({
        field: {
          field,
          value,
          normalizedValue: value,
          rawValue: value,
          status: "reported",
          source: {
            page: document.page ?? null,
            section: document.section ?? null,
          },
          extraction: { method: "STRUCTURED", confidence: null },
        },
        entityType: "case",
        entityId: null,
      }))
  }
  return (document.items ?? []).flatMap((item) =>
    (item.fields ?? []).map((field) => ({
      field,
      entityType: "documentItem",
      entityId: item.documentItemId,
    })),
  )
}

export function generateDocumentEvidences(
  documents,
  { idFactory, timestamp },
) {
  return documents.flatMap((document) =>
    fieldsToGenerate(document).map(({ field, entityType, entityId }) =>
      createEvidence(
        {
          field: field.field,
          value: field.normalizedValue,
          normalizedValue: field.normalizedValue,
          rawValue: field.rawValue,
          entityType,
          entityId,
          status: field.status ?? "reported",
          source: {
            type: "document",
            documentId: document.id,
            documentType: document.type,
            documentName: document.source?.fileName ?? null,
            format: document.source?.format ?? null,
            page: field.source?.page ?? null,
            section: field.source?.section ?? null,
            boundingReference: field.source?.boundingReference ?? null,
            sheet: field.source?.sheet ?? null,
            row: field.source?.row ?? null,
            column: field.source?.column ?? null,
            cell: field.source?.cell ?? null,
            provider: field.source?.provider ?? document.source?.provider ?? null,
            resource: field.source?.resource ?? document.source?.resource ?? null,
            externalId:
              field.source?.externalId ?? document.source?.externalId ?? null,
            timestamp:
              field.source?.timestamp ?? document.source?.timestamp ?? null,
            actor: field.source?.actor ?? document.source?.actor ?? null,
            role: field.source?.role ?? document.source?.role ?? null,
          },
          confidence: businessConfidenceFor(field.status ?? "reported"),
          extraction: {
            method: field.extraction?.method ?? document.source?.method ?? null,
            confidence: field.extraction?.confidence ?? null,
          },
          identifierType: field.identifierType ?? null,
        },
        { id: idFactory(), timestamp },
      ),
    ),
  )
}
