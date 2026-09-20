import { createServer } from "node:http"
import { pathToFileURL } from "node:url"

import { loadConfig } from "./config.js"
import { BinaryDocumentStorage } from "./documents/binary-document-storage.js"
import { createRequestHandler } from "./http/request-handler.js"
import { InMemoryOperationalCaseRepository } from "./repositories/in-memory-operational-case-repository.js"
import { SqliteOperationalCaseRepository } from "./repositories/sqlite-operational-case-repository.js"
import { OperationalCaseService } from "./services/operational-case-service.js"
import { createSiscomexIntegration } from "./integrations/siscomex/index.js"
import { loadSiscomexConfig } from "./integrations/siscomex/config.js"

export const DEFAULT_PORT = 3000

export function resolvePort(value = process.env.PORT) {
  if (value === undefined || value === "") {
    return DEFAULT_PORT
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError("PORT must be an integer between 1 and 65535")
  }

  return port
}

export function createPrismaServer({ service, repository, config } = {}) {
  const runtimeConfig = config ?? loadConfig()
  const runtimeRepository = repository ?? new InMemoryOperationalCaseRepository()
  const operationalCaseService =
    service ??
    new OperationalCaseService({
      repository: runtimeRepository,
      documentStorage: new BinaryDocumentStorage({
        directory: runtimeConfig.uploadDirectory,
        maxUploadSize: runtimeConfig.maxUploadSize,
      }),
      siscomexIntegration: createSiscomexIntegration({
        config: runtimeConfig.siscomex ?? loadSiscomexConfig({}),
        repository: runtimeRepository,
      }),
    })

  return createServer(createRequestHandler({
    service: operationalCaseService,
    maxUploadSize: runtimeConfig.maxUploadSize,
  }))
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntryPoint) {
  const config = loadConfig()
  const port = resolvePort()
  const repository = new SqliteOperationalCaseRepository({
    databasePath: config.databasePath,
  })
  const server = createPrismaServer({ repository, config })
  server.on("close", () => repository.close())
  server.listen(port, () => {
    console.log(`PRISMA backend listening on http://localhost:${port}`)
  })
}
