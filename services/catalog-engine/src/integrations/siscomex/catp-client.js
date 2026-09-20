import {
  boundedText,
  digits,
  productVersion,
} from "./validation.js"

export class SiscomexCatpClient {
  constructor({ client }) {
    this.client = client
  }

  listProducts({ responsibleRootId, ...filters }) {
    return this.client.request({
      path: "/catp/api/ext/produto",
      query: {
        cpfCnpjRaiz: digits(responsibleRootId, "responsibleRootId", [8, 11]),
        codigo: filters.productCode,
        codigoInterno: filters.internalProductCode,
        ncm: filters.ncm,
        situacao: filters.status,
        modalidade: filters.operationMode,
        dataReferencia: filters.referenceDate,
        ultimaAlteracaoInicio: filters.changedFrom,
        ultimaAlteracaoFim: filters.changedTo,
        operadorEstrangeiroCodigo: filters.foreignOperatorCode,
      },
      subsystem: "CATP",
      operation: "LIST_PRODUCTS",
    })
  }

  getProduct({ responsibleRootId, productCode, version }) {
    const root = digits(responsibleRootId, "responsibleRootId", [8, 11])
    const code = digits(productCode, "productCode", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const selectedVersion = productVersion(version)
    return this.client.request({
      path: `/catp/api/ext/produto/${root}/${code}/${encodeURIComponent(selectedVersion)}`,
      subsystem: "CATP",
      operation: "GET_PRODUCT_VERSION",
    })
  }

  exportProducts({ responsibleRootId, includeInactive = false }) {
    const root = digits(responsibleRootId, "responsibleRootId", [8, 11])
    return this.client.request({
      path: `/catp/api/ext/produto/exportar/${root}/${Boolean(includeInactive)}`,
      subsystem: "CATP",
      operation: "EXPORT_PRODUCTS",
    })
  }

  listForeignOperators({ responsibleRootId, ...filters }) {
    return this.client.request({
      path: "/catp/api/ext/operador-estrangeiro",
      query: {
        cpfCnpjRaiz: digits(responsibleRootId, "responsibleRootId", [8, 11]),
        tin: filters.tin,
        codigo: filters.operatorCode,
        codigoInterno: filters.internalCode,
        nome: filters.name,
        paisOrigem: filters.country,
        exibirDesativados: filters.includeInactive,
      },
      subsystem: "CATP",
      operation: "LIST_FOREIGN_OPERATORS",
    })
  }

  getForeignOperator({ responsibleRootId, country, operatorCode, version }) {
    const root = digits(responsibleRootId, "responsibleRootId", [8, 11])
    const countryCode = boundedText(country, "country", 2, /^[A-Za-z]{2}$/).toUpperCase()
    const code = boundedText(operatorCode, "operatorCode", 35, /^[A-Za-z0-9._-]+$/)
    const selectedVersion = productVersion(version)
    return this.client.request({
      path: `/catp/api/ext/operador-estrangeiro/${root}/${countryCode}/${encodeURIComponent(code)}/${encodeURIComponent(selectedVersion)}`,
      subsystem: "CATP",
      operation: "GET_FOREIGN_OPERATOR_VERSION",
    })
  }
}
