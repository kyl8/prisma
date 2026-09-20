import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import * as XLSX from "xlsx"

import { createPrismaServer } from "../src/server.js"

async function withServer(work, { maxUploadSize = 5_000_000 } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "prisma-upload-"))
  const config = {
    databasePath: ":memory:",
    uploadDirectory: join(directory, "uploads"),
    maxUploadSize,
  }
  const server = createPrismaServer({ config })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  try {
    await work({ baseUrl, config })
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    rmSync(directory, { recursive: true, force: true })
  }
}

async function createCase(baseUrl, id) {
  const response = await fetch(`${baseUrl}/api/prisma/cases`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  })
  assert.equal(response.status, 201)
  return response.json()
}

function uploadForm(content, fileName, mimeType, documentType = "PACKING_LIST") {
  const form = new FormData()
  form.append("documentType", documentType)
  form.append("file", new Blob([content], { type: mimeType }), fileName)
  return form
}

test("HTTP returns 409 and preserves the newer case version", async () => {
  await withServer(async ({ baseUrl }) => {
    await createCase(baseUrl, "case-http-version")
    const first = await fetch(`${baseUrl}/api/prisma/cases/case-http-version/documents`, {
      method: "POST",
      headers: { "content-type": "application/json", "if-match": '"1"' },
      body: JSON.stringify({ id: "document-a", type: "invoice", fields: {} }),
    })
    assert.equal(first.status, 201)
    const stale = await fetch(`${baseUrl}/api/prisma/cases/case-http-version/documents`, {
      method: "POST",
      headers: { "content-type": "application/json", "if-match": '"1"' },
      body: JSON.stringify({ id: "document-b", type: "invoice", fields: {} }),
    })
    assert.equal(stale.status, 409)
    assert.deepEqual(await stale.json(), {
      error: "CASE_VERSION_CONFLICT",
      caseId: "case-http-version",
      expectedVersion: 1,
      currentVersion: 2,
    })
    const stored = await (await fetch(
      `${baseUrl}/api/prisma/cases/case-http-version`,
    )).json()
    assert.equal(stored.version, 2)
    assert.deepEqual(stored.documents.map((item) => item.id), ["document-a"])
  })
})

test("multipart CSV upload sanitizes filename, hashes content and deduplicates", async () => {
  await withServer(async ({ baseUrl, config }) => {
    await createCase(baseUrl, "case-upload-csv")
    const content = "SKU,Quantidade\nXP400-A,10\n"
    const first = await fetch(
      `${baseUrl}/api/prisma/cases/case-upload-csv/documents/upload`,
      {
        method: "POST",
        body: uploadForm(content, "../../packing.csv", "text/csv"),
      },
    )
    const document = await first.json()
    assert.equal(first.status, 201)
    assert.equal(document.source.fileName, "packing.csv")
    assert.match(document.metadata.contentHash, /^[a-f0-9]{64}$/)
    assert.ok(!document.metadata.storageKey.includes(".."))
    assert.equal(readdirSync(config.uploadDirectory).length, 1)

    const repeated = await fetch(
      `${baseUrl}/api/prisma/cases/case-upload-csv/documents/upload`,
      {
        method: "POST",
        body: uploadForm(content, "copy.csv", "text/csv"),
      },
    )
    assert.equal(repeated.status, 201)
    assert.equal((await repeated.json()).id, document.id)
    assert.equal(readdirSync(config.uploadDirectory).length, 1)
    const stored = await (await fetch(
      `${baseUrl}/api/prisma/cases/case-upload-csv`,
    )).json()
    assert.equal(stored.documents.length, 1)
  })
})

test("multipart XLSX upload is parsed without executing formulas or macros", async () => {
  await withServer(async ({ baseUrl }) => {
    await createCase(baseUrl, "case-upload-xlsx")
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["SKU", "Quantidade"],
      ["XP400-A", 10],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products")
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
    const response = await fetch(
      `${baseUrl}/api/prisma/cases/case-upload-xlsx/documents/upload`,
      {
        method: "POST",
        body: uploadForm(
          bytes,
          "products.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      },
    )
    const document = await response.json()
    assert.equal(response.status, 201)
    assert.equal(document.source.format, "XLSX")
    assert.equal(document.items[0].identifiers[0].value, "XP400-A")
    assert.equal(document.metadata.formulasTreatedAsText, true)
  })
})

test("multipart rejects unsupported types and oversized files", async () => {
  await withServer(async ({ baseUrl }) => {
    await createCase(baseUrl, "case-upload-invalid")
    const invalid = await fetch(
      `${baseUrl}/api/prisma/cases/case-upload-invalid/documents/upload`,
      {
        method: "POST",
        body: uploadForm("payload", "payload.exe", "application/octet-stream"),
      },
    )
    assert.equal(invalid.status, 400)
  })
  await withServer(async ({ baseUrl }) => {
    await createCase(baseUrl, "case-upload-large")
    const oversized = await fetch(
      `${baseUrl}/api/prisma/cases/case-upload-large/documents/upload`,
      {
        method: "POST",
        body: uploadForm("a".repeat(128), "large.csv", "text/csv"),
      },
    )
    assert.equal(oversized.status, 400)
  }, { maxUploadSize: 32 })
})
