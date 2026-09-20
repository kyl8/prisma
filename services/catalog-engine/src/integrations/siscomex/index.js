import { AccessKeyAuthProvider } from "./auth-provider.js"
import { SiscomexCadaClient } from "./cada-client.js"
import { SiscomexCatalogSyncService } from "./catalog-sync-service.js"
import { SiscomexCatpClient } from "./catp-client.js"
import { SiscomexClassifClient } from "./classif-client.js"
import { SiscomexClient } from "./client.js"
import { SiscomexSessionManager } from "./session-manager.js"

export function createSiscomexIntegration({
  config,
  repository,
  transport = fetch,
  idFactory,
  clock,
  now,
  sleep,
} = {}) {
  const authProvider = new AccessKeyAuthProvider({ config, transport, clock: now })
  const sessionManager = new SiscomexSessionManager({ authProvider, clock: now })
  const client = new SiscomexClient({
    config,
    sessionManager,
    transport,
    idFactory,
    sleep,
  })
  return new SiscomexCatalogSyncService({
    config,
    repository,
    sessionManager,
    catpClient: new SiscomexCatpClient({ client }),
    cadaClient: new SiscomexCadaClient({ client }),
    classifClient: new SiscomexClassifClient({ client }),
    idFactory,
    clock,
    now,
  })
}
