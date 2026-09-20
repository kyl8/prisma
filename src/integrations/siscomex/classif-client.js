export class SiscomexClassifClient {
  constructor({ client }) {
    this.client = client
  }

  downloadNomenclature() {
    return this.client.request({
      path: "/classif/api/publico/nomenclatura/download/json",
      subsystem: "CLASSIF",
      operation: "DOWNLOAD_NOMENCLATURE",
      authenticated: false,
    })
  }
}
