import assert from "node:assert/strict"
import test from "node:test"

import { loadSiscomexConfig } from "../src/integrations/siscomex/config.js"
import { AccessKeyAuthProvider } from "../src/integrations/siscomex/auth-provider.js"
import { SiscomexClient } from "../src/integrations/siscomex/client.js"
import { SiscomexError } from "../src/integrations/siscomex/errors.js"
import { redactSiscomex } from "../src/integrations/siscomex/redaction.js"
import { SiscomexSessionManager } from "../src/integrations/siscomex/session-manager.js"

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

const enabledConfig = () => loadSiscomexConfig({
  SISCOMEX_ENABLED: "true",
  SISCOMEX_ENV: "validation",
  SISCOMEX_CLIENT_ID: "client-id",
  SISCOMEX_CLIENT_SECRET: "client-secret",
  SISCOMEX_MAX_SERVER_RETRIES: "1",
})

test("Siscomex config defaults to disabled validation and gates production", () => {
  const config = loadSiscomexConfig({})
  assert.equal(config.enabled, false)
  assert.equal(config.environment, "validation")
  assert.equal(config.baseUrl, "https://val.portalunico.siscomex.gov.br")
  assert.throws(() => loadSiscomexConfig({
    SISCOMEX_ENABLED: "true",
    SISCOMEX_ENV: "production",
  }), /ALLOW_PRODUCTION/)
  assert.equal(loadSiscomexConfig({
    SISCOMEX_ENABLED: "true",
    SISCOMEX_ENV: "production",
    SISCOMEX_ALLOW_PRODUCTION: "true",
  }).baseUrl, "https://portalunico.siscomex.gov.br")
})

test("disabled integration blocks public Classif requests before transport", async () => {
  let calls = 0
  const client = new SiscomexClient({
    config: loadSiscomexConfig({}),
    sessionManager: null,
    transport: async () => {
      calls += 1
      return jsonResponse({ Nomenclaturas: [] })
    },
  })

  await assert.rejects(
    client.request({
      path: "/classif/api/publico/nomenclatura/download/json",
      subsystem: "CLASSIF",
      operation: "DOWNLOAD_NOMENCLATURE",
      authenticated: false,
    }),
    (error) => error.code === "SISCOMEX_NOT_CONFIGURED",
  )
  assert.equal(calls, 0)
})

test("access-key auth uses only the official headers and captures JWT and CSRF", async () => {
  let observed
  const provider = new AccessKeyAuthProvider({
    config: enabledConfig(),
    clock: () => 1_000,
    transport: async (url, options) => {
      observed = { url, options }
      return jsonResponse({}, 200, {
        "set-token": "jwt",
        "x-csrf-token": "csrf",
        "x-csrf-expiration": "100000",
      })
    },
  })
  const session = await provider.authenticate()
  assert.equal(observed.url, "https://val.portalunico.siscomex.gov.br/portal/api/autenticar/chave-acesso")
  assert.deepEqual(observed.options.headers, {
    "Client-Id": "client-id",
    "Client-Secret": "client-secret",
    "Role-Type": "IMPEXP",
    Accept: "application/json",
  })
  assert.deepEqual(session, {
    authorization: "jwt",
    csrfToken: "csrf",
    expiresAt: 100000,
  })
})

test("session manager shares authentication and serializes rotating CSRF usage", async () => {
  let authentications = 0
  const manager = new SiscomexSessionManager({
    clock: () => 0,
    authProvider: {
      async authenticate() {
        authentications += 1
        return { authorization: "jwt", csrfToken: "csrf", expiresAt: 100000 }
      },
    },
  })
  const [left, right] = await Promise.all([manager.getSession(), manager.getSession()])
  assert.equal(authentications, 1)
  assert.deepEqual(left, right)
  manager.updateFromResponse(jsonResponse({}, 200, {
    "set-token": "jwt-2",
    "x-csrf-token": "csrf-2",
  }))
  assert.equal((await manager.getSession()).csrfToken, "csrf-2")
})

test("client reauthenticates once after 401 and updates the returned session", async () => {
  let authentications = 0
  let requests = 0
  const manager = new SiscomexSessionManager({
    clock: () => 0,
    authProvider: {
      async authenticate() {
        authentications += 1
        return {
          authorization: `jwt-${authentications}`,
          csrfToken: `csrf-${authentications}`,
          expiresAt: 100000,
        }
      },
    },
  })
  const client = new SiscomexClient({
    config: enabledConfig(),
    sessionManager: manager,
    sleep: async () => {},
    transport: async (_url, options) => {
      requests += 1
      if (requests === 1) return jsonResponse({ code: "AUTH" }, 401)
      assert.equal(options.headers.Authorization, "jwt-2")
      return jsonResponse({ ok: true }, 200, {
        "set-token": "jwt-3",
        "x-csrf-token": "csrf-3",
      })
    },
  })
  assert.deepEqual((await client.request({
    path: "/catp/api/ext/produto",
    subsystem: "CATP",
    operation: "LIST_PRODUCTS",
  })).data, { ok: true })
  assert.equal(authentications, 2)
  assert.equal(requests, 2)
  assert.equal((await manager.getSession()).csrfToken, "csrf-3")
})

test("client retries 503 once, handles 204 and never retries a rate limit", async () => {
  const manager = new SiscomexSessionManager({
    clock: () => 0,
    authProvider: {
      async authenticate() {
        return { authorization: "jwt", csrfToken: "csrf", expiresAt: 100000 }
      },
    },
  })
  const responses = [
    jsonResponse({ code: "TEMP" }, 503),
    new Response(null, { status: 204 }),
  ]
  const client = new SiscomexClient({
    config: enabledConfig(),
    sessionManager: manager,
    sleep: async () => {},
    transport: async () => responses.shift(),
  })
  assert.equal((await client.request({
    path: "/cadatributos/api/ext/atributo-ncm/22042100",
    subsystem: "CADA",
    operation: "GET_ATTRIBUTES_BY_NCM",
  })).data, null)

  let rateCalls = 0
  const limited = new SiscomexClient({
    config: enabledConfig(),
    sessionManager: manager,
    sleep: async () => {},
    transport: async () => {
      rateCalls += 1
      return jsonResponse({ code: "PUCX-ER1001", message: "limit" }, 422)
    },
  })
  await assert.rejects(
    limited.request({ path: "/catp/api/ext/produto", subsystem: "CATP" }),
    (error) => error instanceof SiscomexError && error.rateLimited,
  )
  assert.equal(rateCalls, 1)
})

test("redaction recursively removes authentication material", () => {
  assert.deepEqual(redactSiscomex({
    Authorization: "jwt",
    nested: { "Client-Secret": "secret", safe: "value" },
  }), {
    Authorization: "[REDACTED]",
    nested: { "Client-Secret": "[REDACTED]", safe: "value" },
  })
})

test("client aborts requests at the configured timeout", async () => {
  const config = loadSiscomexConfig({
    SISCOMEX_ENABLED: "true",
    SISCOMEX_CLIENT_ID: "client-id",
    SISCOMEX_CLIENT_SECRET: "client-secret",
    SISCOMEX_TIMEOUT_MS: "5",
  })
  const manager = new SiscomexSessionManager({
    clock: () => 0,
    authProvider: {
      async authenticate() {
        return { authorization: "jwt", csrfToken: "csrf", expiresAt: 100000 }
      },
    },
  })
  const client = new SiscomexClient({
    config,
    sessionManager: manager,
    transport: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError"))
      )
    }),
  })
  await assert.rejects(
    client.request({ path: "/catp/api/ext/produto", subsystem: "CATP" }),
    (error) => error.code === "SISCOMEX_TIMEOUT" && error.retryable,
  )
})
