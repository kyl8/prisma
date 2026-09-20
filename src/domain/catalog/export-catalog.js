import * as XLSX from "xlsx"

import { ValidationError } from "../shared/errors.js"

function value(record, field) {
  return record.fields[field]?.value ?? ""
}

function attributeValues(record) {
  return Object.fromEntries(
    Object.entries(record.attributes).map(([field, item]) => [
      field,
      item.value ?? item.values ?? null,
    ]),
  )
}

function exportRow(record) {
  return {
    product_id: record.productId,
    catalog_record_id: record.catalogRecordId,
    description: value(record, "description"),
    manufacturer: value(record, "manufacturer"),
    model: value(record, "model"),
    part_number: value(record, "partNumber"),
    sku: value(record, "sku"),
    gtin: value(record, "gtin"),
    supplier_code: value(record, "supplierCode"),
    product_code: value(record, "productCode"),
    external_key: value(record, "externalKey"),
    reported_ncm: value(record, "reportedNcm"),
    ncm_status: record.fields.reportedNcm?.status ?? "MISSING",
    origin_country: value(record, "originCountry"),
    material: value(record, "material"),
    application: value(record, "application"),
    quantity_unit: value(record, "quantityUnit"),
    attributes: JSON.stringify(attributeValues(record)),
    quality_status: record.qualityStatus,
    missing_fields: record.missingFields.join(";"),
    conflicting_fields: record.conflictingFields.join(";"),
    recommendations: record.recommendations.map((item) => item.type).join(";"),
  }
}

function csvCell(value) {
  const text = String(value ?? "")
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] ?? exportRow({
    productId: "",
    catalogRecordId: "",
    fields: {},
    attributes: {},
    qualityStatus: "",
    missingFields: [],
    conflictingFields: [],
    recommendations: [],
  }))
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\r\n")
}

function evidenceRows(records) {
  return records.flatMap((record) =>
    Object.values({ ...record.fields, ...record.attributes }).flatMap((field) =>
      field.sources.map((source) => ({
        product_id: record.productId,
        field: field.field,
        value: field.value ?? (field.values ?? []).join(" | "),
        status: field.status,
        evidence_ids: field.evidenceIds.join(";"),
        source_type: source.type ?? "",
        document_id: source.documentId ?? "",
        document_type: source.documentType ?? "",
        document_item_id: source.documentItemId ?? "",
        page: source.page ?? "",
        sheet: source.sheet ?? "",
        cell: source.cell ?? "",
      })),
    ),
  )
}

function findingRows(records) {
  return records.flatMap((record) =>
    record.findings.map((finding) => ({
      product_id: record.productId,
      finding_id: finding.id,
      type: finding.type,
      field: finding.field ?? "",
      reason: finding.reason,
      severity: finding.severity,
      blocking: finding.blocking,
      evidence_ids: finding.evidenceIds.join(";"),
    })),
  )
}

function publicRecord(record) {
  const { originalRecords, ...output } = record
  return output
}

function safeFileBase(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120) || "prisma"
}

export function exportCatalog(catalog, format) {
  const normalizedFormat = String(format ?? "json").toLocaleLowerCase("en-US")
  const fileBase = safeFileBase(catalog.caseId)
  const rows = catalog.records.map(exportRow)
  if (normalizedFormat === "json") {
    return {
      contentType: "application/json; charset=utf-8",
      fileName: `${fileBase}-catalog.json`,
      body: Buffer.from(JSON.stringify({
        caseId: catalog.caseId,
        generatedAt: catalog.generatedAt,
        summary: catalog.summary,
        records: catalog.records.map(publicRecord),
      }, null, 2)),
    }
  }
  if (normalizedFormat === "csv") {
    return {
      contentType: "text/csv; charset=utf-8",
      fileName: `${fileBase}-catalog.csv`,
      body: Buffer.from(`\uFEFF${toCsv(rows)}`, "utf8"),
    }
  }
  if (normalizedFormat === "xlsx") {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      "Catalog",
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(evidenceRows(catalog.records)),
      "Evidence",
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(findingRows(catalog.records)),
      "Findings",
    )
    return {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: `${fileBase}-catalog.xlsx`,
      body: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    }
  }
  throw new ValidationError("Catalog export format must be json, csv or xlsx")
}
