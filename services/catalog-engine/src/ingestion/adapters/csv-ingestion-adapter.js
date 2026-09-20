import { ValidationError } from "../../domain/shared/errors.js"
import {
  createCanonicalDocument,
  normalizeDocumentType,
} from "../canonical/canonical-document.js"
import {
  canonicalizeRecord,
  createDocumentItem,
} from "./adapter-utils.js"

const MAX_ROWS = 10_000
const MAX_COLUMNS = 200

function detectDelimiter(content) {
  const header = content.split(/\r?\n/, 1)[0] ?? ""
  const commas = (header.match(/,/g) ?? []).length
  const semicolons = (header.match(/;/g) ?? []).length
  return semicolons > commas ? ";" : ","
}

export function parseCsv(content, delimiter = detectDelimiter(content)) {
  if (typeof content !== "string") {
    throw new ValidationError("CSV content must be a string")
  }

  const rows = []
  let row = []
  let value = ""
  let quoted = false

  for (let index = 0; index <= content.length; index += 1) {
    const character = content[index] ?? "\n"
    const next = content[index + 1]
    if (character === '"') {
      if (quoted && next === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && character === delimiter) {
      row.push(value)
      value = ""
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") index += 1
      row.push(value)
      value = ""
      if (row.some((cell) => cell !== "")) rows.push(row)
      row = []
      if (rows.length > MAX_ROWS + 1) {
        throw new ValidationError(`CSV exceeds ${MAX_ROWS} data rows`)
      }
    } else {
      value += character
    }
  }

  if (quoted) throw new ValidationError("CSV contains an unclosed quoted field")
  return rows
}

export class CsvIngestionAdapter {
  constructor({ idFactory }) {
    this.idFactory = idFactory
  }

  supports(input) {
    return input?.kind === "csv"
  }

  ingest(input) {
    const rows = parseCsv(input.content, input.delimiter)
    if (rows.length === 0) throw new ValidationError("CSV is empty")
    const headers = rows[0].map((header) => header.trim())
    if (headers.length > MAX_COLUMNS) {
      throw new ValidationError(`CSV exceeds ${MAX_COLUMNS} columns`)
    }
    if (headers.some((header) => !header)) {
      throw new ValidationError("CSV headers cannot be empty")
    }

    const id = input.id ?? this.idFactory()
    const type = normalizeDocumentType(input.documentType ?? "SPREADSHEET")
    const fileName = input.fileName ?? null
    const items = rows.slice(1).map((values, index) => {
      const record = Object.fromEntries(
        headers.map((header, columnIndex) => [header, values[columnIndex] ?? ""]),
      )
      const converted = canonicalizeRecord(
        record,
        {
          documentId: id,
          documentType: type,
          fileName,
          extraction: { method: "CSV", confidence: "deterministic" },
          aliases: input.aliases ?? {},
        },
        (column) => ({ row: index + 2, column, sheet: null, cell: null }),
      )
      return createDocumentItem({
        id: `${id}:row:${index + 2}`,
        index: index + 1,
        ...converted,
        source: { documentId: id, sheet: null, row: index + 2 },
      })
    })

    return createCanonicalDocument({
      id,
      type,
      source: { format: "CSV", method: "CSV", fileName },
      metadata: { headers, rowCount: items.length },
      items,
      fields: items.length === 1 ? items[0].fields : [],
      unknownFields:
        items.length === 1 ? items[0].unknownFields : items.flatMap((item) => item.unknownFields),
      rawExtraction: { delimiter: input.delimiter ?? detectDelimiter(input.content) },
    })
  }
}
