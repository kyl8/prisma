import { ncmCode } from "./validation.js"

export class SiscomexCadaClient {
  constructor({ client }) {
    this.client = client
  }

  getAttributesForNcm(ncm, { date, operationMode, objectives, agencies } = {}) {
    const code = ncmCode(ncm)
    return this.client.request({
      path: `/cadatributos/api/ext/atributo-ncm/${code}`,
      query: {
        data: date,
        modalidade: operationMode,
        objetivos: objectives,
        orgaosDemandantes: agencies,
      },
      subsystem: "CADA",
      operation: "GET_ATTRIBUTES_BY_NCM",
    })
  }
}
