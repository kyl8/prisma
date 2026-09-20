const FIELD_ALIASES = Object.freeze({
  description: ["description", "descricao", "produto", "product", "item"],
  quantity: ["quantity", "quantidade", "qty", "qtd"],
  netWeight: ["netweight", "net_weight", "peso liquido", "peso_liquido"],
  grossWeight: [
    "grossweight",
    "gross_weight",
    "peso bruto",
    "peso_bruto",
    "peso total",
    "peso",
  ],
  value: ["value", "valor", "total value", "valor total"],
  manufacturer: ["manufacturer", "fabricante", "maker"],
  model: ["model", "modelo"],
  countryOfOrigin: [
    "countryoforigin",
    "country_of_origin",
    "pais de origem",
    "origem",
  ],
  ncm: ["ncm", "ncm informada", "ncm_reported", "ncmreported"],
  unit: ["unit", "unidade", "uom"],
  productIdentification: [
    "productidentification",
    "product_identification",
    "codigo",
    "codigo produto",
    "codigo do produto",
    "product code",
    "product_code",
    "sku",
    "part number",
    "part_number",
    "partnumber",
    "gtin",
    "ean",
    "supplier item code",
    "supplier_item_code",
    "supplier code",
  ],
  issueDate: ["issuedate", "issue_date", "data", "data emissao"],
  currency: ["currency", "moeda"],
})

function normalizeAlias(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/[-.]/g, " ")
    .replace(/\s+/g, " ")
}

const FIELD_BY_ALIAS = new Map()
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  FIELD_BY_ALIAS.set(normalizeAlias(field), field)
  for (const alias of aliases) FIELD_BY_ALIAS.set(normalizeAlias(alias), field)
}

export function mapFieldName(originalField, aliases = {}) {
  const configuredAliases = new Map(FIELD_BY_ALIAS)
  for (const [alias, field] of Object.entries(aliases)) {
    configuredAliases.set(normalizeAlias(alias), field)
  }

  const field = configuredAliases.get(normalizeAlias(originalField)) ?? null
  return {
    field,
    originalField: String(originalField),
    known: field !== null,
  }
}

export function identifierTypeFor(originalField) {
  const alias = normalizeAlias(originalField)
  if (alias === "sku") return "SKU"
  if (["part number", "partnumber"].includes(alias)) return "PART_NUMBER"
  if (["gtin", "ean"].includes(alias)) return "GTIN"
  if (["supplier item code", "supplier code"].includes(alias)) {
    return "SUPPLIER_CODE"
  }
  return "PRODUCT_CODE"
}

export { FIELD_ALIASES }
