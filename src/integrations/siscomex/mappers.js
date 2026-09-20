function present(value) {
  return value !== undefined && value !== null && value !== ""
}

function payloadArray(payload, keys = []) {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return payload ? [payload] : []
}

function simpleAttribute(item) {
  return {
    code: String(item.atributo),
    value: item.valor,
    multivalued: false,
    compound: false,
    rawPayload: structuredClone(item),
  }
}

function productAttributes(raw) {
  return [
    ...(raw.atributos ?? []).map(simpleAttribute),
    ...(raw.atributosMultivalorados ?? []).map((item) => ({
      code: String(item.atributo),
      value: structuredClone(item.valores ?? []),
      multivalued: true,
      compound: false,
      rawPayload: structuredClone(item),
    })),
    ...(raw.atributosCompostos ?? []).map((item) => ({
      code: String(item.atributo),
      value: structuredClone(item.valores ?? []),
      multivalued: false,
      compound: true,
      rawPayload: structuredClone(item),
    })),
    ...(raw.atributosCompostosMultivalorados ?? []).map((item) => ({
      code: String(item.atributo),
      value: structuredClone(item.valores ?? []),
      multivalued: true,
      compound: true,
      rawPayload: structuredClone(item),
    })),
  ].filter((item) => item.code !== "undefined")
}

export function mapOfficialCatalogProduct(raw, { fetchedAt, payloadHash }) {
  return {
    source: "SISCOMEX_CATP",
    responsibleRootId: present(raw.cpfCnpjRaiz) ? String(raw.cpfCnpjRaiz) : null,
    productCode: present(raw.codigo) ? String(raw.codigo).padStart(10, "0") : null,
    version: present(raw.versao) ? String(raw.versao) : null,
    status: raw.situacao ?? null,
    operationMode: raw.modalidade ?? null,
    ncm: raw.ncm ?? null,
    denomination: raw.denominacao ?? null,
    complementaryDescription: raw.descricao ?? null,
    internalProductCodes: structuredClone(raw.codigosInterno ?? []),
    referenceDate: raw.dataReferencia ?? null,
    attributes: productAttributes(raw),
    fetchedAt,
    payloadHash,
    rawPayload: structuredClone(raw),
  }
}

export function mapOfficialForeignOperator(raw, { fetchedAt, payloadHash }) {
  return {
    source: "SISCOMEX_CATP",
    responsibleRootId: present(raw.cpfCnpjRaiz) ? String(raw.cpfCnpjRaiz) : null,
    operatorCode: present(raw.codigo) ? String(raw.codigo) : null,
    version: present(raw.versao) ? String(raw.versao) : null,
    status: raw.situacao ?? null,
    country: raw.codigoPais ?? null,
    tin: raw.tin ?? null,
    name: raw.nome ?? null,
    email: raw.email ?? null,
    postalCode: raw.cep ?? null,
    street: raw.logradouro ?? null,
    city: raw.nomeCidade ?? null,
    subdivision: raw.codigoSubdivisaoPais ?? null,
    internalCode: raw.codigoInterno ?? null,
    additionalIdentifiers: structuredClone(raw.identificacoesAdicionais ?? []),
    referenceDate: raw.dataReferencia ?? null,
    fetchedAt,
    payloadHash,
    rawPayload: structuredClone(raw),
  }
}

function mapRequirement(raw, ncm, conditional = false, conditions = null) {
  return {
    ncm,
    code: String(raw.codigo),
    name: raw.nome ?? raw.nomeApresentacao ?? null,
    description: raw.definicao ?? null,
    required: Boolean(raw.obrigatorio),
    conditional,
    multivalued: Boolean(raw.multivalorado),
    compound:
      raw.formaPreenchimento === "COMPOSTO" ||
      (raw.listaSubatributos?.length ?? 0) > 0,
    domain: structuredClone(raw.dominio ?? []),
    conditions: conditions ? structuredClone(conditions) : null,
    validFrom: raw.dataInicioVigencia ?? null,
    validTo: raw.dataFimVigencia ?? null,
    rawPayload: structuredClone(raw),
  }
}

export function mapOfficialAttributeRequirements(payload, ncm) {
  const requirements = []
  for (const raw of payloadArray(payload, ["atributos", "listaAtributos"])) {
    if (!present(raw.codigo)) continue
    requirements.push(mapRequirement(raw, ncm))
    for (const conditioned of raw.condicionados ?? []) {
      if (!present(conditioned.atributo?.codigo)) continue
      requirements.push(mapRequirement(
        {
          ...conditioned.atributo,
          obrigatorio: conditioned.obrigatorio,
          multivalorado: conditioned.multivalorado,
          dataInicioVigencia: conditioned.dataInicioVigencia,
          dataFimVigencia: conditioned.dataFimVigencia,
        },
        ncm,
        true,
        {
          description: conditioned.descricaoCondicao ?? null,
          expression: conditioned.condicao ?? null,
          conditioningAttribute: String(raw.codigo),
        },
      ))
    }
  }
  return [
    ...new Map(requirements.map((item) => [
      `${item.code}:${item.conditional}:${JSON.stringify(item.conditions)}`,
      item,
    ])).values(),
  ]
}

function nomenclatureItems(payload) {
  return payloadArray(payload, [
    "Nomenclaturas",
    "nomenclaturas",
    "itens",
    "listaNcm",
    "ncms",
  ])
}

export function mapOfficialNcm(payload, requestedNcm, { fetchedAt, payloadHash }) {
  const normalized = String(requestedNcm).replace(/\D/g, "")
  const raw = nomenclatureItems(payload).find((item) =>
    String(item.Codigo ?? item.codigo ?? item.ncm ?? item.code ?? "").replace(/\D/g, "") === normalized
  )
  if (!raw) return null
  return {
    source: "SISCOMEX_CLASSIF",
    ncm: normalized,
    description: raw.Descricao ?? raw.descricao ?? raw.description ?? null,
    validFrom:
      raw.Data_Inicio ?? raw.dataInicioVigencia ?? raw.inicioVigencia ?? null,
    validTo: raw.Data_Fim ?? raw.dataFimVigencia ?? raw.fimVigencia ?? null,
    statisticalUnit: raw.unidadeEstatistica ?? null,
    fetchedAt,
    payloadHash,
    rawPayload: structuredClone(raw),
  }
}
