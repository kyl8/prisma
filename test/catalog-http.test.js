import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { after, before, test } from "node:test"
import * as XLSX from "xlsx"

import { InMemoryOperationalCaseRepository } from "../src/repositories/in-memory-operational-case-repository.js"
import { createPrismaServer } from "../src/server.js"
import { OperationalCaseService } from "../src/services/operational-case-service.js"

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "fixtures", "catalog-demo.json"), "utf8"),
)
let sequence = 0
const service = new OperationalCaseService({
  repository: new InMemoryOperationalCaseRepository(),
  idFactory: () => `catalog-http-${++sequence}`,
  clock: () => "2026-09-20T15:00:00.000Z",
})
service.createCase(fixture.case)
service.analyze(fixture.case.id)

const server = createPrismaServer({ service })
let baseUrl

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})

test("catalog, product and diff endpoints expose the consolidated view", async () => {
  const catalogResponse = await fetch(
    `${baseUrl}/api/prisma/cases/${fixture.case.id}/catalog`,
  )
  const catalog = await catalogResponse.json()
  assert.equal(catalogResponse.status, 200)
  assert.equal(catalog.summary.products, 2)
  assert.equal(catalog.records.length, 2)

  const productResponse = await fetch(
    `${baseUrl}/api/prisma/cases/${fixture.case.id}/catalog/catalog-xp400`,
  )
  const product = await productResponse.json()
  assert.equal(productResponse.status, 200)
  assert.equal(product.productId, "catalog-xp400")
  assert.equal(product.fields.manufacturer.value, "ABC Machinery Ltd.")
  assert.ok(product.recommendations.length > 0)

  const diffResponse = await fetch(
    `${baseUrl}/api/prisma/cases/${fixture.case.id}/catalog/diff`,
  )
  const diff = await diffResponse.json()
  assert.equal(diffResponse.status, 200)
  assert.equal(diff.diffs.length, 2)
  assert.ok(diff.diffs.some((item) => item.counts.enriched > 0))

  const missing = await fetch(
    `${baseUrl}/api/prisma/cases/${fixture.case.id}/catalog/does-not-exist`,
  )
  assert.equal(missing.status, 404)
})

test("catalog export endpoints return JSON, CSV and XLSX consumption views", async () => {
  const jsonResponse = await fetch(
    `${baseUrl}/api/prisma/cases/${fixture.case.id}/catalog/export?format=json`,
  )
  assert.match(jsonResponse.headers.get("content-disposition"), /catalog\.json/)
  const json = await jsonResponse.json()
  assert.equal(json.records.length, 2)
  assert.ok(!JSON.stringify(json).includes("storageKey"))

  const csvResponse = await fetch(
    `${baseUrl}/api/prisma/cases/${fixture.case.id}/catalog/export?format=csv`,
  )
  const csv = await csvResponse.text()
  assert.match(csvResponse.headers.get("content-type"), /^text\/csv/)
  assert.ok(csv.includes("quality_status"))
  assert.ok(csv.includes("XP400-SKU"))

  const xlsxResponse = await fetch(
    `${baseUrl}/api/prisma/cases/${fixture.case.id}/catalog/export?format=xlsx`,
  )
  const workbook = XLSX.read(Buffer.from(await xlsxResponse.arrayBuffer()), {
    type: "buffer",
  })
  assert.equal(xlsxResponse.status, 200)
  assert.deepEqual(workbook.SheetNames, ["Catalog", "Evidence", "Findings"])

  const invalid = await fetch(
    `${baseUrl}/api/prisma/cases/${fixture.case.id}/catalog/export?format=xml`,
  )
  assert.equal(invalid.status, 400)
})
