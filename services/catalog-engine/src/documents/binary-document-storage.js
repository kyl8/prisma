import { createHash, randomUUID } from "node:crypto"
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs"
import { basename, extname, join } from "node:path"

import { ValidationError } from "../domain/shared/errors.js"

const ALLOWED = Object.freeze({
  ".csv": new Set(["text/csv", "application/csv", "text/plain"]),
  ".xls": new Set(["application/vnd.ms-excel", "application/octet-stream"]),
  ".xlsx": new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/octet-stream",
  ]),
  ".xlsm": new Set([
    "application/vnd.ms-excel.sheet.macroenabled.12",
    "application/zip",
    "application/octet-stream",
  ]),
  ".pdf": new Set(["application/pdf", "application/octet-stream"]),
})

export function sanitizeFileName(input) {
  const original = String(input ?? "").replaceAll("\\", "/")
  const leaf = basename(original)
  const cleaned = leaf
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 180)
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new ValidationError("Upload filename is invalid")
  }
  return cleaned
}

function validateSignature(extension, buffer) {
  if (extension === ".pdf" && buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw new ValidationError("Uploaded PDF signature is invalid")
  }
  if ([".xlsx", ".xlsm"].includes(extension)) {
    const zip = buffer[0] === 0x50 && buffer[1] === 0x4b
    if (!zip) throw new ValidationError("Uploaded spreadsheet signature is invalid")
  }
  if (extension === ".xls") {
    const ole = buffer.subarray(0, 8).equals(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    )
    if (!ole) throw new ValidationError("Uploaded XLS signature is invalid")
  }
  if (extension === ".csv" && buffer.includes(0)) {
    throw new ValidationError("Uploaded CSV is not text")
  }
}

export class BinaryDocumentStorage {
  constructor({ directory, maxUploadSize, keyFactory = randomUUID }) {
    this.directory = directory
    this.maxUploadSize = maxUploadSize
    this.keyFactory = keyFactory
    mkdirSync(directory, { recursive: true })
  }

  store({ buffer, fileName, mimeType }) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new ValidationError("Upload must contain a file")
    }
    if (buffer.length > this.maxUploadSize) {
      throw new ValidationError(
        `Upload exceeds configured limit of ${this.maxUploadSize} bytes`,
      )
    }
    const safeFileName = sanitizeFileName(fileName)
    const extension = extname(safeFileName).toLocaleLowerCase("en-US")
    const allowedTypes = ALLOWED[extension]
    if (!allowedTypes) throw new ValidationError("Unsupported upload extension")
    const normalizedMime = String(mimeType ?? "application/octet-stream")
      .split(";", 1)[0]
      .toLocaleLowerCase("en-US")
    if (!allowedTypes.has(normalizedMime)) {
      throw new ValidationError("Upload MIME type does not match its extension")
    }
    validateSignature(extension, buffer)
    const hash = createHash("sha256").update(buffer).digest("hex")
    const storageKey = `${this.keyFactory()}${extension}`
    writeFileSync(join(this.directory, storageKey), buffer, { flag: "wx" })
    return {
      safeFileName,
      extension,
      mimeType: normalizedMime,
      size: buffer.length,
      hash,
      storageKey,
    }
  }

  remove(storageKey) {
    if (!storageKey || basename(storageKey) !== storageKey) return
    try {
      unlinkSync(join(this.directory, storageKey))
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
}
