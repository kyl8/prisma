import assert from "node:assert/strict"
import { after, before, test } from "node:test"

import {
  createPrismaServer,
  DEFAULT_PORT,
  resolvePort,
} from "../src/server.js"

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
  assert.equal(body.version, "1.1.0")
  assert.equal(body.interaction.responseMode, "adaptive")
  assert.equal(body.decision.required, false)
})

test("returns health status", async () => {
  const response = await fetch(`${baseUrl}/health`)
  assert.deepEqual(await response.json(), { status: "ok" })
})

test("creates and analyzes an operational case through the API", async () => {
  const createResponse = await fetch(`${baseUrl}/api/prisma/cases`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: "case-http",
      documents: [
        {
          id: "invoice-http",
          type: "invoice",
          fields: {
            description: "Industrial Pump XP400",
            quantity: 10,
            grossWeight: 720,
            manufacturer: "ABC Machinery",
            model: "XP400",
            ncm: "8413.x",
          },
        },
        {
          id: "packing-http",
          type: "packing_list",
          fields: {
            description: "Industrial Pump XP400",
            quantity: 10,
            grossWeight: 680,
            manufacturer: "ABC Industrial",
            model: "XP400",
            ncm: "8413.x",
          },
        },
      ],
      products: [
        {
          id: "product-http",
          description: "Pump",
          ncm: "8413.x",
          manufacturer: "",
          model: "",
        },
      ],
    }),
  })
  assert.equal(createResponse.status, 201)

  const analysisResponse = await fetch(
    `${baseUrl}/api/prisma/cases/case-http/analyze`,
    { method: "POST" },
  )
  const analysis = await analysisResponse.json()
  assert.equal(analysisResponse.status, 200)
  assert.equal(analysis.readiness.status, "BLOCKED")
  assert.equal(analysis.decision.type, "HOLD_FOR_VALIDATION")
  assert.equal(analysis.quantitativePrediction.status, "UNAVAILABLE")

  const readinessResponse = await fetch(
    `${baseUrl}/api/prisma/cases/case-http/readiness`,
  )
  assert.equal((await readinessResponse.json()).status, "BLOCKED")

  const evidenceResponse = await fetch(
    `${baseUrl}/api/prisma/cases/case-http/evidence`,
  )
  assert.ok((await evidenceResponse.json()).length > 0)

  const actionsResponse = await fetch(
    `${baseUrl}/api/prisma/cases/case-http/actions`,
  )
  const actions = await actionsResponse.json()
  assert.ok(actions.length > 0)

  const resolveResponse = await fetch(
    `${baseUrl}/api/prisma/cases/case-http/actions/${actions[0].id}/resolve`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        value: "confirmed",
        source: { type: "resolution", reference: "manual-review" },
      }),
    },
  )
  assert.equal(resolveResponse.status, 200)
})

test("validates catalogs and rejects malformed JSON", async () => {
  const catalogResponse = await fetch(`${baseUrl}/api/prisma/catalog/validate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      products: [{ id: "product-1", description: "parts", ncm: "1234" }],
    }),
  })
  assert.equal((await catalogResponse.json()).status, "requires_review")

  const malformedResponse = await fetch(`${baseUrl}/api/prisma/cases`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  })
  assert.equal(malformedResponse.status, 400)
})

test("ingests CSV into a case through the canonical contract", async () => {
  await fetch(`${baseUrl}/api/prisma/cases`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: "case-ingestion-http",
      products: [
        {
          id: "product-ingestion-http",
          description: "Industrial Pump XP400",
          manufacturer: "ABC Machinery",
          model: "XP400",
          ncm: "8413.x",
          classificationEvidence: { type: "technical_sheet" },
        },
      ],
    }),
  })

  const ingestResponse = await fetch(
    `${baseUrl}/api/prisma/cases/case-ingestion-http/ingest`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "csv",
        fileName: "packing.csv",
        documentType: "PACKING_LIST",
        content:
          "Produto,Quantidade,Peso,Fabricante,Modelo,NCM\nIndustrial Pump XP400,10,680 KG,ABC Machinery,XP400,8413.x",
      }),
    },
  )
  const document = await ingestResponse.json()
  assert.equal(ingestResponse.status, 201)
  assert.equal(document.source.format, "CSV")
  assert.equal(
    document.fields.find((field) => field.field === "grossWeight").rawValue,
    "680 KG",
  )

  const analysisResponse = await fetch(
    `${baseUrl}/api/prisma/cases/case-ingestion-http/analyze`,
    { method: "POST" },
  )
  assert.equal((await analysisResponse.json()).readiness.status, "READY")

  const findingsResponse = await fetch(
    `${baseUrl}/api/prisma/cases/case-ingestion-http/findings`,
  )
  assert.deepEqual(await findingsResponse.json(), [])
})

test("uses port 3000 by default and accepts a configured port", () => {
  assert.equal(DEFAULT_PORT, 3000)
  assert.equal(resolvePort(undefined), 3000)
  assert.equal(resolvePort("8080"), 8080)
})

test("rejects invalid ports", () => {
  assert.throws(() => resolvePort("0"), RangeError)
  assert.throws(() => resolvePort("invalid"), RangeError)
  assert.throws(() => resolvePort("65536"), RangeError)
})
