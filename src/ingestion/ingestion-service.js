import { ValidationError } from "../domain/shared/errors.js"
import { CsvIngestionAdapter } from "./adapters/csv-ingestion-adapter.js"
import { OcrIngestionAdapter } from "./adapters/ocr-ingestion-adapter.js"
import { SpreadsheetIngestionAdapter } from "./adapters/spreadsheet-ingestion-adapter.js"
import { StructuredInputAdapter } from "./adapters/structured-input-adapter.js"

export class IngestionService {
  constructor({ adapters }) {
    this.adapters = [...adapters]
  }

  ingest(input) {
    const adapter = this.adapters.find((candidate) => candidate.supports(input))
    if (!adapter) throw new ValidationError("No ingestion adapter supports this input")
    return adapter.ingest(input)
  }
}

export function createDefaultIngestionService({ idFactory }) {
  return new IngestionService({
    adapters: [
      new CsvIngestionAdapter({ idFactory }),
      new SpreadsheetIngestionAdapter({ idFactory }),
      new OcrIngestionAdapter({ idFactory }),
      new StructuredInputAdapter({ idFactory }),
    ],
  })
}
