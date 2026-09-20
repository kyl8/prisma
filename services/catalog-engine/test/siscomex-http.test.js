import assert from "node:assert/strict"
import { after, before, test } from "node:test"

import { SiscomexError } from "../src/integrations/siscomex/errors.js"
import { createPrismaServer } from "../src/server.js"

const service = {
  getSiscomexStatus() {
    return {
      enabled: true,
      configured: true,
      environment: "validation",
      status: "CONFIGURED",
      readOnly: true,
    }
  },
  async testSiscomexConnection() {
    return { status: "CONNECTED", environment: "validation", readOnly: true }
  },
  async syncSiscomex(caseId, body) {
    return {
      caseId,
      productId: body.productId,
      environment: "validation",
      cacheStatus: "FRESH",
    }
  },
  getSiscomexCatalog(caseId) {
    return { caseId, snapshots: [] }
  },
  getSiscomexDiff(caseId) {
    return { caseId, diffs: [] }
  },
  async getSiscomexAttributes(ncm) {
    return { ncm, requirements: [] }
  },
  async getSiscomexNcm(ncm) {
    if (ncm === "00000000") {
      throw new SiscomexError("temporarily unavailable", {
        httpStatus: 503,
        code: "PUCX-ER1001",
        tag: "[SAFE-TAG]",
        subsystem: "CLASSIF",
        rateLimited: true,
      })
    }
    return { ncm, exists: true, classificationAssigned: false }
  },
}

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

test("Siscomex HTTP endpoints expose status, sync, catalog, diff and lookups", async () => {
  const statusResponse = await fetch(`${baseUrl}/api/prisma/integrations/siscomex/status`)
  const status = await statusResponse.json()
  assert.equal(statusResponse.status, 200)
  assert.equal(status.environment, "validation")
  assert.equal(status.readOnly, true)

  const testResponse = await fetch(`${baseUrl}/api/prisma/integrations/siscomex/test`, {
    method: "POST",
  })
  assert.equal((await testResponse.json()).status, "CONNECTED")

  const syncResponse = await fetch(`${baseUrl}/api/prisma/cases/case-1/siscomex/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId: "product-1" }),
  })
  const sync = await syncResponse.json()
  assert.equal(syncResponse.status, 200)
  assert.equal(sync.productId, "product-1")

  assert.equal((await fetch(`${baseUrl}/api/prisma/cases/case-1/siscomex/catalog`)).status, 200)
  assert.equal((await fetch(`${baseUrl}/api/prisma/cases/case-1/siscomex/diff`)).status, 200)
  assert.equal((await fetch(`${baseUrl}/api/prisma/siscomex/attributes/22042100`)).status, 200)
  const ncm = await (await fetch(`${baseUrl}/api/prisma/siscomex/ncm/22042100`)).json()
  assert.equal(ncm.exists, true)
  assert.equal(ncm.classificationAssigned, false)
})

test("Siscomex HTTP errors are sanitized and rate limits are not hidden", async () => {
  const response = await fetch(`${baseUrl}/api/prisma/siscomex/ncm/00000000`)
  const body = await response.json()
  assert.equal(response.status, 429)
  assert.deepEqual(body, {
    error: "siscomex_error",
    code: "PUCX-ER1001",
    message: "temporarily unavailable",
    tag: "[SAFE-TAG]",
    subsystem: "CLASSIF",
    retryable: false,
    rateLimited: true,
  })
})
