import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  mapOfficialAttributeRequirements,
  mapOfficialCatalogProduct,
  mapOfficialForeignOperator,
  mapOfficialNcm,
} from "../src/integrations/siscomex/mappers.js"
import { compareCatalogWithSiscomex } from "../src/integrations/siscomex/compare-catalog.js"

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/siscomex-wine.json", import.meta.url), "utf8"),
)
const context = { fetchedAt: "2026-01-02T00:00:00Z", payloadHash: "hash" }

test("CATP and foreign operator mappers keep version strings and raw provenance", () => {
  const product = mapOfficialCatalogProduct(fixture.product, context)
  const operator = mapOfficialForeignOperator(fixture.foreignOperator, context)
  assert.equal(product.productCode, "0000000001")
  assert.equal(product.version, "1")
  assert.equal(product.ncm, "22042100")
  assert.equal(product.attributes.find((item) => item.code === "ATT_GTIN").value, "3578760500025")
  assert.deepEqual(product.rawPayload, fixture.product)
  assert.equal(operator.operatorCode, "OPE_2")
  assert.equal(operator.version, "1")
  assert.equal(operator.country, "FR")
  assert.equal(operator.name, "SAS MOREAU NAUDET")
})

test("CADA mapper preserves mandatory, conditional, domain and validity data", () => {
  const requirements = mapOfficialAttributeRequirements(fixture.cada, "22042100")
  const category = requirements.find((item) => item.code === "ATT_CATEGORY")
  const vintage = requirements.find((item) => item.code === "ATT_VINTAGE")
  assert.equal(category.required, true)
  assert.equal(category.multivalued, false)
  assert.equal(category.validFrom, "2024-01-01")
  assert.equal(category.domain[0].codigo, "VINHO FINO")
  assert.equal(vintage.conditional, true)
  assert.equal(vintage.conditions.conditioningAttribute, "ATT_COLOR")
})

test("Classif mapper reads the current public nomenclature payload", () => {
  const ncm = mapOfficialNcm({
    Data_Ultima_Atualizacao_NCM: "Vigente em 20/09/2026",
    Nomenclaturas: [{
      Codigo: "2204.21.00",
      Descricao: "Em recipientes de capacidade não superior a 2 l",
      Data_Inicio: "01/04/2022",
      Data_Fim: "31/12/9999",
    }],
  }, "22042100", context)
  assert.equal(ncm.ncm, "22042100")
  assert.equal(ncm.description, "Em recipientes de capacidade não superior a 2 l")
  assert.equal(ncm.validFrom, "01/04/2022")
  assert.equal(ncm.validTo, "31/12/9999")
})

test("official comparison reports conflicts and missing required attributes without choosing values", () => {
  const product = mapOfficialCatalogProduct(fixture.product, context)
  const operator = mapOfficialForeignOperator(fixture.foreignOperator, context)
  const requirements = mapOfficialAttributeRequirements(fixture.cada, "22042100")
  const record = {
    productId: "wine",
    fields: {
      description: { value: "Wine", status: "REPORTED", evidenceIds: ["local-description"] },
      manufacturer: { value: "XYZ WINES", status: "REPORTED", evidenceIds: ["local-manufacturer"] },
      reportedNcm: { value: "22042100", status: "UNVERIFIED", evidenceIds: [] },
    },
    attributes: {},
  }
  const diff = compareCatalogWithSiscomex({
    record,
    product,
    operator,
    requirements,
    evidences: [],
    localProduct: {},
    idFactory: (() => { let value = 0; return () => `finding-${++value}` })(),
    timestamp: "2026-01-02T00:00:00Z",
  })
  assert.equal(diff.conflictingFields.find((item) => item.field === "manufacturer").officialValue, "SAS MOREAU NAUDET")
  assert.equal(diff.matchingFields.find((item) => item.field === "reportedNcm").localValue, "22042100")
  assert.ok(diff.missingRequiredAttributes.some((item) => item.code === "ATT_CATEGORY"))
  assert.ok(diff.findings.some((item) => item.reason === "official_manufacturer_conflict"))
  assert.ok(diff.recommendations.some((item) => item.reason.includes("Categoria da bebida")))
})
