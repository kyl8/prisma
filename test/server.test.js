import assert from "node:assert/strict"
import { after, before, test } from "node:test"

import { createPrismaServer } from "../src/server.js"

const server = createPrismaServer()
let baseUrl

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})
after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

test("serves the default PRISMA policy", async () => {
  const response = await fetch(`${baseUrl}/api/prisma/policy`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.default, true)
  assert.equal(body.decision.required, true)
})

test("returns health status", async () => {
  const response = await fetch(`${baseUrl}/health`)
  assert.deepEqual(await response.json(), { status: "ok" })
})
