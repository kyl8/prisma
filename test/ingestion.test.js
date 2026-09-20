import assert from "node:assert/strict"
import test from "node:test"
import * as XLSX from "xlsx"

import { generateDocumentEvidences } from "../src/domain/evidence/generate-document-evidence.js"
import { CsvIngestionAdapter, parseCsv } from "../src/ingestion/adapters/csv-ingestion-adapter.js"
import { OcrIngestionAdapter } from "../src/ingestion/adapters/ocr-ingestion-adapter.js"
import { SpreadsheetIngestionAdapter } from "../src/ingestion/adapters/spreadsheet-ingestion-adapter.js"
import { StructuredInputAdapter } from "../src/ingestion/adapters/structured-input-adapter.js"
import { normalizeFieldValue, parseLocalizedNumber } from "../src/ingestion/normalization/normalize-field.js"

const idFactory = () => "generated-document"

function workbookBuffer(bookType = "xlsx", rows = null) {
  const worksheet = XLSX.utils.aoa_to_sheet(
    rows ?? [
      ["Produto", "Quantidade", "Unidade", "Peso", "Fornecedor Ref"],
      ["Pump XP400", "10", "PCS", "680 KG", "SUP-1"],
    ],
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products")
  return XLSX.write(workbook, { type: "buffer", bookType })
}

test("creates a canonical UNKNOWN document and preserves raw values", () => {
  const adapter = new StructuredInputAdapter({ idFactory })
  const document = adapter.ingest({
    kind: "structured",
    document: {
      id: "doc-1",
      type: "unexpected-document",
      name: "source.json",
      fields: { "Peso Bruto": "680 KG" },
    },
  })

  assert.equal(document.type, "UNKNOWN")
  assert.equal(document.fields[0].rawValue, "680 KG")
  assert.equal(document.fields[0].normalizedValue, 680)
  assert.equal(document.fields[0].source.documentId, "doc-1")
})

test("structured adapter converts the legacy document contract", () => {
  const adapter = new StructuredInputAdapter({ idFactory })
  const document = adapter.ingest({
    kind: "structured",
    document: {
      id: "invoice-1",
      type: "invoice",
      fields: { quantity: 10, manufacturer: " ABC Ltd. " },
    },
  })

  assert.equal(document.type, "COMMERCIAL_INVOICE")
  assert.equal(document.fields.find((field) => field.field === "quantity").value, 10)
  assert.equal(
    document.fields.find((field) => field.field === "manufacturer").value,
    "ABC Ltd.",
  )
})

test("CSV parser handles headers, quoted values and provenance", () => {
  const adapter = new CsvIngestionAdapter({ idFactory })
  const content =
    'Produto,NCM,Peso,Fabricante,Fornecedor Ref\r\n"Pump, XP400",8413.x,680 KG,ABC Ltd,SUP-1'
  const document = adapter.ingest({ kind: "csv", content, fileName: "items.csv" })

  assert.equal(parseCsv(content).length, 2)
  assert.equal(document.metadata.headers[0], "Produto")
  assert.equal(document.items.length, 1)
  const weight = document.fields.find((field) => field.field === "grossWeight")
  assert.equal(weight.normalizedValue, 680)
  assert.equal(weight.rawValue, "680 KG")
  assert.equal(weight.source.row, 2)
  assert.equal(weight.source.column, "Peso")
  assert.equal(document.unknownFields[0].originalField, "Fornecedor Ref")
})

test("spreadsheet adapter reads XLSX cells with sheet provenance", () => {
  const adapter = new SpreadsheetIngestionAdapter({ idFactory })
  const document = adapter.ingest({
    kind: "spreadsheet",
    fileName: "packing.xlsx",
    buffer: workbookBuffer("xlsx"),
    documentType: "PACKING_LIST",
  })

  const weight = document.fields.find((field) => field.field === "grossWeight")
  assert.equal(document.source.format, "XLSX")
  assert.equal(weight.source.sheet, "Products")
  assert.equal(weight.source.cell, "D2")
  assert.equal(weight.rawValue, "680 KG")
  assert.equal(weight.normalizedValue, 680)
})

test("spreadsheet adapter reads XLS and ignores XLSM macros", () => {
  const adapter = new SpreadsheetIngestionAdapter({ idFactory })
  const legacy = adapter.ingest({
    kind: "spreadsheet",
    fileName: "packing.xls",
    buffer: workbookBuffer("xls"),
  })
  const macroEnabled = adapter.ingest({
    kind: "spreadsheet",
    fileName: "packing.xlsm",
    buffer: workbookBuffer("xlsm"),
  })

  assert.equal(legacy.source.format, "XLS")
  assert.equal(macroEnabled.source.format, "XLSM")
  assert.equal(macroEnabled.metadata.macrosIgnored, true)
  assert.equal(macroEnabled.metadata.formulasTreatedAsText, true)
})

test("spreadsheet formulas are preserved as unverified text", () => {
  const adapter = new SpreadsheetIngestionAdapter({ idFactory })
  const document = adapter.ingest({
    kind: "spreadsheet",
    fileName: "formula.xlsx",
    buffer: workbookBuffer("xlsx", [
      ["Quantidade"],
      [{ f: "1+1", v: 2 }],
    ]),
  })

  assert.equal(document.fields[0].rawValue, "=1+1")
  assert.equal(document.fields[0].normalizedValue, "=1+1")
  assert.equal(document.fields[0].status, "unverified")
})

test("OCR adapter preserves page, bounding reference and extraction confidence", () => {
  const adapter = new OcrIngestionAdapter({ idFactory })
  const document = adapter.ingest({
    kind: "ocr",
    provider: "external-ocr",
    payload: {
      id: "ocr-1",
      type: "PACKING_LIST",
      fileName: "packing.pdf",
      fields: [
        {
          field: "gross_weight",
          value: "720 KG",
          page: 2,
          boundingBox: "box-17",
          confidence: 0.97,
        },
      ],
    },
  })

  assert.equal(document.fields[0].source.page, 2)
  assert.equal(document.fields[0].source.boundingReference, "box-17")
  assert.equal(document.fields[0].extraction.confidence, 0.97)
})

test("normalization handles weight, quantity, decimal and date safely", () => {
  assert.deepEqual(normalizeFieldValue("grossWeight", "680 KG"), {
    value: 680,
    normalizedValue: 680,
    normalizedUnit: "kg",
    currency: null,
  })
  assert.equal(normalizeFieldValue("quantity", "10 PCS").normalizedValue, 10)
  assert.equal(parseLocalizedNumber("1.250,50"), 1250.5)
  assert.equal(normalizeFieldValue("issueDate", "20/09/2026").normalizedValue, "2026-09-20")
})

test("canonical documents generate evidence with cell provenance", () => {
  const adapter = new SpreadsheetIngestionAdapter({ idFactory })
  const document = adapter.ingest({
    kind: "spreadsheet",
    fileName: "packing.xlsx",
    buffer: workbookBuffer("xlsx"),
  })
  let sequence = 0
  const evidences = generateDocumentEvidences([document], {
    idFactory: () => `evidence-${++sequence}`,
    timestamp: "2026-09-20T12:00:00.000Z",
  })
  const weight = evidences.find((evidence) => evidence.field === "grossWeight")

  assert.equal(weight.source.documentId, "generated-document")
  assert.equal(weight.source.sheet, "Products")
  assert.equal(weight.source.cell, "D2")
  assert.equal(weight.rawValue, "680 KG")
  assert.equal(weight.extraction.confidence, "deterministic")
  assert.equal(weight.confidence, "medium")
})
