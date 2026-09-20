import {
  createCanonicalDocument,
  createCanonicalField,
  normalizeDocumentType,
} from "../canonical/canonical-document.js"
import {
  canonicalizeRecord,
  createDocumentItem,
} from "./adapter-utils.js"

export class StructuredInputAdapter {
  constructor({ idFactory }) {
    this.idFactory = idFactory
  }

  supports(input) {
    return input?.kind === "structured" || Boolean(input?.document)
  }

  ingest(input) {
    const document = input.document ?? input
    const id = document.id ?? this.idFactory()
    const type = normalizeDocumentType(document.type)
    const source = {
      format: document.source?.format ?? "JSON",
      method: document.source?.method ?? "STRUCTURED",
      fileName: document.source?.fileName ?? document.name ?? null,
      provider: document.source?.provider ?? null,
      resource: document.source?.resource ?? null,
      externalId: document.source?.externalId ?? null,
      timestamp: document.source?.timestamp ?? null,
      actor: document.source?.actor ?? null,
      role: document.source?.role ?? null,
    }

    let fields = []
    let unknownFields = []
    if (Array.isArray(document.fields)) {
      fields = document.fields.map((field) =>
        createCanonicalField({
          ...field,
          source: {
            documentId: id,
            documentType: type,
            fileName: source.fileName,
            ...(field.source ?? {}),
          },
          extraction: {
            method: field.extraction?.method ?? source.method,
            confidence: field.extraction?.confidence ?? null,
          },
        }),
      )
      unknownFields = [...(document.unknownFields ?? [])]
    } else {
      const converted = canonicalizeRecord(document.fields ?? {}, {
        documentId: id,
        documentType: type,
        fileName: source.fileName,
        extraction: { method: source.method },
        aliases: input.aliases ?? {},
      })
      fields = converted.fields
      unknownFields = converted.unknownFields
    }

    const items = (document.items ?? []).map((item, index) => {
      const converted = canonicalizeRecord(item.fields ?? item, {
        documentId: id,
        documentType: type,
        fileName: source.fileName,
        extraction: { method: source.method },
        aliases: input.aliases ?? {},
      })
      return createDocumentItem({
        id: item.documentItemId ?? item.id ?? `${id}:item:${index + 1}`,
        index: index + 1,
        ...converted,
        source: { documentId: id, row: item.row ?? null },
      })
    })

    return createCanonicalDocument({
      id,
      type,
      source,
      metadata: document.metadata,
      parties: document.parties,
      shipment: document.shipment,
      items,
      fields,
      unknownFields,
      rawExtraction: document.rawExtraction ?? document,
    })
  }
}
