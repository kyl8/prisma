import * as XLSX from "xlsx"

import { ValidationError } from "../../domain/shared/errors.js"
import {
  createCanonicalDocument,
  normalizeDocumentType,
} from "../canonical/canonical-document.js"
import {
  canonicalizeRecord,
  createDocumentItem,
} from "./adapter-utils.js"

const SUPPORTED_FORMATS = new Set(["XLS", "XLSX", "XLSM"])
const MAX_FILE_BYTES = 5_000_000
const MAX_SHEETS = 20
const MAX_ROWS = 10_000
const MAX_COLUMNS = 200

function extensionOf(fileName = "") {
  return fileName.split(".").pop()?.toUpperCase() ?? ""
}

function inputBuffer(input) {
  if (Buffer.isBuffer(input.buffer)) return input.buffer
  if (typeof input.contentBase64 === "string") {
    return Buffer.from(input.contentBase64, "base64")
  }
  throw new ValidationError("Spreadsheet requires buffer or contentBase64")
}

function rawCellValue(cell) {
  if (!cell) return ""
  if (cell.f) return `=${cell.f}`
  return cell.w ?? cell.v ?? ""
}

function interpretedCellValue(cell) {
  if (!cell) return ""
  return cell.f ? `=${cell.f}` : cell.v ?? cell.w ?? ""
}

function sheetRows(sheet, sheetName, context) {
  if (!sheet?.["!ref"]) return []
  const range = XLSX.utils.decode_range(sheet["!ref"])
  const rowCount = range.e.r - range.s.r
  const columnCount = range.e.c - range.s.c + 1
  if (rowCount > MAX_ROWS) {
    throw new ValidationError(`Sheet ${sheetName} exceeds ${MAX_ROWS} data rows`)
  }
  if (columnCount > MAX_COLUMNS) {
    throw new ValidationError(`Sheet ${sheetName} exceeds ${MAX_COLUMNS} columns`)
  }

  const headers = []
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const address = XLSX.utils.encode_cell({ r: range.s.r, c: column })
    headers.push(String(rawCellValue(sheet[address])).trim())
  }
  if (headers.some((header) => !header)) {
    throw new ValidationError(`Sheet ${sheetName} contains an empty header`)
  }

  const items = []
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    const record = {}
    const descriptors = {}
    let hasData = false
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column })
      const cell = sheet[address]
      const header = headers[column - range.s.c]
      const value = interpretedCellValue(cell)
      if (value !== "") hasData = true
      record[header] = {
        value,
        rawValue: rawCellValue(cell),
        status: cell?.f ? "unverified" : "reported",
      }
      descriptors[header] = {
        sheet: sheetName,
        row: row + 1,
        column: XLSX.utils.encode_col(column),
        cell: address,
      }
    }
    if (!hasData) continue

    const converted = canonicalizeRecord(
      record,
      context,
      (column) => descriptors[column],
    )
    items.push(
      createDocumentItem({
        id: `${context.documentId}:${sheetName}:${row + 1}`,
        index: items.length + 1,
        ...converted,
        source: {
          documentId: context.documentId,
          sheet: sheetName,
          row: row + 1,
        },
      }),
    )
  }

  return items
}

export class SpreadsheetIngestionAdapter {
  constructor({ idFactory }) {
    this.idFactory = idFactory
  }

  supports(input) {
    return input?.kind === "spreadsheet"
  }

  ingest(input) {
    const format = String(input.format ?? extensionOf(input.fileName)).toUpperCase()
    if (!SUPPORTED_FORMATS.has(format)) {
      throw new ValidationError("Spreadsheet format must be XLS, XLSX or XLSM")
    }

    const buffer = inputBuffer(input)
    if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) {
      throw new ValidationError(
        `Spreadsheet must contain between 1 and ${MAX_FILE_BYTES} bytes`,
      )
    }

    let workbook
    try {
      workbook = XLSX.read(buffer, {
        type: "buffer",
        bookVBA: false,
        cellFormula: true,
        cellHTML: false,
        cellStyles: false,
        sheetRows: MAX_ROWS + 1,
      })
    } catch {
      throw new ValidationError("Spreadsheet could not be parsed safely")
    }

    if (workbook.SheetNames.length > MAX_SHEETS) {
      throw new ValidationError(`Spreadsheet exceeds ${MAX_SHEETS} sheets`)
    }

    const id = input.id ?? this.idFactory()
    const type = normalizeDocumentType(input.documentType ?? "SPREADSHEET")
    const context = {
      documentId: id,
      documentType: type,
      fileName: input.fileName ?? null,
      extraction: { method: "SPREADSHEET", confidence: "deterministic" },
      aliases: input.aliases ?? {},
    }
    const items = workbook.SheetNames.flatMap((sheetName) =>
      sheetRows(workbook.Sheets[sheetName], sheetName, context),
    )

    return createCanonicalDocument({
      id,
      type,
      source: {
        format,
        method: "SPREADSHEET",
        fileName: input.fileName ?? null,
      },
      metadata: {
        sheetNames: [...workbook.SheetNames],
        macrosIgnored: format === "XLSM",
        formulasTreatedAsText: true,
        rowCount: items.length,
      },
      items,
      fields: items.length === 1 ? items[0].fields : [],
      unknownFields:
        items.length === 1 ? items[0].unknownFields : items.flatMap((item) => item.unknownFields),
      rawExtraction: {
        format,
        sheets: workbook.SheetNames.map((name) => ({ name })),
      },
    })
  }
}
