import {
  createCanonicalDocument,
  normalizeDocumentType,
} from "../canonical/canonical-document.js"
import { canonicalizeExternalField, createDocumentItem } from "./adapter-utils.js"

function descriptorsFrom(inputFields) {
  if (Array.isArray(inputFields)) return inputFields
  return Object.entries(inputFields ?? {}).map(([field, value]) => ({ field, value }))
}

export class OcrIngestionAdapter {
  constructor({ idFactory }) {
    this.idFactory = idFactory
  }

  supports(input) {
    return input?.kind === "ocr"
  }

  ingest(input) {
    const payload = input.payload ?? input.document ?? input
    const id = payload.id ?? input.id ?? this.idFactory()
    const type = normalizeDocumentType(
      payload.documentType ?? payload.type ?? input.documentType,
    )
    const fileName = payload.fileName ?? input.fileName ?? null

    const convert = (descriptor) =>
      canonicalizeExternalField({
        originalField: descriptor.field ?? descriptor.name,
        rawValue: descriptor.rawValue ?? descriptor.value,
        documentId: id,
        documentType: type,
        fileName,
        source: {
          page: descriptor.page ?? null,
          section: descriptor.section ?? null,
          boundingReference:
            descriptor.boundingReference ?? descriptor.boundingBox ?? null,
          provider: input.provider ?? payload.provider ?? null,
          externalId: input.externalId ?? payload.externalId ?? null,
        },
        extraction: {
          method: "OCR",
          confidence: descriptor.confidence ?? null,
        },
        status: descriptor.status ?? "reported",
        aliases: input.aliases ?? {},
      })

    const convertedFields = descriptorsFrom(payload.fields).map(convert)
    const fields = convertedFields.flatMap((item) => item.canonicalField ?? [])
    const unknownFields = convertedFields.flatMap((item) => item.unknownField ?? [])
    const items = (payload.items ?? []).map((item, index) => {
      const converted = descriptorsFrom(item.fields ?? item).map(convert)
      return createDocumentItem({
        id: item.documentItemId ?? item.id ?? `${id}:item:${index + 1}`,
        index: index + 1,
        fields: converted.flatMap((entry) => entry.canonicalField ?? []),
        unknownFields: converted.flatMap((entry) => entry.unknownField ?? []),
        source: { documentId: id, page: item.page ?? null },
      })
    })

    return createCanonicalDocument({
      id,
      type,
      source: {
        format: payload.format ?? "PDF",
        method: "OCR",
        fileName,
        provider: input.provider ?? payload.provider ?? null,
        externalId: input.externalId ?? payload.externalId ?? null,
        timestamp: input.timestamp ?? payload.timestamp ?? null,
      },
      metadata: payload.metadata,
      parties: payload.parties,
      shipment: payload.shipment,
      items,
      fields: fields.length > 0 ? fields : items.length === 1 ? items[0].fields : [],
      unknownFields,
      rawExtraction: payload,
    })
  }
}
