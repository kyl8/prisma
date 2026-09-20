import assert from "node:assert/strict"
import test from "node:test"

import { PRISMA_ANALYSIS_POLICY } from "../src/policy.js"

test("uses adaptive responses and reserves full decisions for complete analyses", () => {
  assert.equal(PRISMA_ANALYSIS_POLICY.default, true)
  assert.equal(PRISMA_ANALYSIS_POLICY.version, "1.1.0")
  assert.equal(PRISMA_ANALYSIS_POLICY.interaction.responseMode, "adaptive")
  assert.equal(PRISMA_ANALYSIS_POLICY.interaction.directAnswerFirst, true)
  assert.equal(PRISMA_ANALYSIS_POLICY.decision.required, false)
  assert.ok(
    PRISMA_ANALYSIS_POLICY.decision.requiredFor.includes(
      "full_document_analysis",
    ),
  )
  assert.ok(
    PRISMA_ANALYSIS_POLICY.outputSections.includes("Decisão recomendada"),
  )
  assert.match(
    PRISMA_ANALYSIS_POLICY.systemPrompt,
    /Dados ausentes limitam somente as conclusões/,
  )
  assert.match(
    PRISMA_ANALYSIS_POLICY.systemPrompt,
    /Perguntas simples merecem respostas\s+diretas/,
  )
})
test("blocks unsupported quantitative predictions", () => {
  assert.equal(
    PRISMA_ANALYSIS_POLICY.prediction.insufficientDataMessage,
    "previsão quantitativa indisponível",
  )
  assert.match(PRISMA_ANALYSIS_POLICY.systemPrompt, /Nunca invente\s+probabilidade/)
})

test("allows useful NCM research without automatic classification", () => {
  assert.match(PRISMA_ANALYSIS_POLICY.systemPrompt, /comparar NCMs candidatas/)
  assert.match(PRISMA_ANALYSIS_POLICY.systemPrompt, /revisão humana/)
  assert.match(PRISMA_ANALYSIS_POLICY.systemPrompt, /nunca as apresente como classificação definitiva/)
})
