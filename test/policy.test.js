import assert from "node:assert/strict"
import test from "node:test"

import { PRISMA_ANALYSIS_POLICY } from "../src/policy.js"

test("requires decision support by default", () => {
  assert.equal(PRISMA_ANALYSIS_POLICY.default, true)
  assert.equal(PRISMA_ANALYSIS_POLICY.decision.required, true)
  assert.ok(
    PRISMA_ANALYSIS_POLICY.outputSections.includes("Decisão recomendada"),
  )
})
test("blocks unsupported quantitative predictions", () => {
  assert.equal(
    PRISMA_ANALYSIS_POLICY.prediction.insufficientDataMessage,
    "previsão quantitativa indisponível",
  )
  assert.match(PRISMA_ANALYSIS_POLICY.systemPrompt, /Nunca invente probabilidade/)
})
