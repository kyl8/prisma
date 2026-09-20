import { createCanonicalField } from "../canonical/canonical-document.js"
import {
  identifierTypeFor,
  mapFieldName,
} from "../mapping/field-mapper.js"
import { normalizeFieldValue } from "../normalization/normalize-field.js"

export function canonicalizeExternalField({
  originalField,
  rawValue,
  documentId,
  documentType,
  fileName = null,
  source = {},
  extraction = {},
  status = "reported",
  aliases = {},
}) {
  const mapping = mapFieldName(originalField, aliases)
  const provenance = {
    documentId,
    documentType,
    fileName,
    ...source,
  }
  const normalization = mapping.known
    ? normalizeFieldValue(mapping.field, rawValue)
    : { value: rawValue, normalizedValue: rawValue }

  if (!mapping.known) {
    return {
      canonicalField: null,
      unknownField: {
        originalField: mapping.originalField,
        value: normalization.value,
        normalizedValue: normalization.normalizedValue,
        rawValue,
        status,
        source: provenance,
        extraction: {
          method: extraction.method ?? "STRUCTURED",
          confidence: extraction.confidence ?? null,
        },
      },
    }
  }

  return {
    canonicalField: createCanonicalField({
      field: mapping.field,
      ...normalization,
      rawValue,
      status,
      source: provenance,
      extraction,
      identifierType:
        mapping.field === "productIdentification"
          ? identifierTypeFor(originalField)
          : null,
    }),
    unknownField: null,
  }
}

export function canonicalizeRecord(
  record,
  context,
  descriptorFor = () => ({}),
) {
  const fields = []
  const unknownFields = []

  for (const [originalField, input] of Object.entries(record ?? {})) {
    const descriptor =
      input &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      Object.hasOwn(input, "value")
        ? input
        : { value: input }
    const result = canonicalizeExternalField({
      ...context,
      originalField,
      rawValue: descriptor.rawValue ?? descriptor.value,
      source: {
        ...descriptorFor(originalField),
        ...(descriptor.source ?? {}),
      },
      extraction: {
        method:
          descriptor.extraction?.method ??
          context.extraction?.method ??
          "STRUCTURED",
        confidence:
          descriptor.extraction?.confidence ??
          descriptor.confidence ??
          context.extraction?.confidence ??
          null,
      },
      status: descriptor.status ?? "reported",
    })
    if (result.canonicalField) fields.push(result.canonicalField)
    if (result.unknownField) unknownFields.push(result.unknownField)
  }

  return { fields, unknownFields }
}

export function createDocumentItem({ id, index, fields, unknownFields, source }) {
  const values = Object.fromEntries(
    fields.map((field) => [field.field, field.normalizedValue]),
  )
  return {
    documentItemId: id,
    line: index,
    description: values.description ?? null,
    model: values.model ?? null,
    manufacturer: values.manufacturer ?? null,
    quantity: values.quantity ?? null,
    unit: values.unit ?? null,
    ncmReported: values.ncm ?? null,
    identifiers: fields
      .filter((field) => field.field === "productIdentification")
      .map((field) => ({
        type: field.identifierType ?? "PRODUCT_CODE",
        value: field.normalizedValue,
      }))
      .concat(
        values.model
          ? [{ type: "MODEL", value: values.model }]
          : [],
      ),
    attributes: Object.fromEntries(
      unknownFields.map((field) => [field.originalField, field.normalizedValue]),
    ),
    fields,
    unknownFields,
    source,
  }
}
