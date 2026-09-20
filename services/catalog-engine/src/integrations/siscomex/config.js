export const SISCOMEX_ENVIRONMENTS = Object.freeze({
  validation: "https://val.portalunico.siscomex.gov.br",
  production: "https://portalunico.siscomex.gov.br",
})

function booleanValue(value, fallback = false) {
  if (value === undefined || value === "") return fallback
  if (["true", "1", "yes"].includes(String(value).toLowerCase())) return true
  if (["false", "0", "no"].includes(String(value).toLowerCase())) return false
  throw new RangeError(`Invalid boolean configuration value: ${value}`)
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === "") return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return parsed
}

export function loadSiscomexConfig(environment = process.env) {
  const selectedEnvironment = environment.SISCOMEX_ENV ?? "validation"
  if (!SISCOMEX_ENVIRONMENTS[selectedEnvironment]) {
    throw new RangeError("SISCOMEX_ENV must be validation or production")
  }
  const enabled = booleanValue(environment.SISCOMEX_ENABLED, false)
  const allowProduction = booleanValue(
    environment.SISCOMEX_ALLOW_PRODUCTION,
    false,
  )
  if (enabled && selectedEnvironment === "production" && !allowProduction) {
    throw new RangeError(
      "Production Siscomex requires SISCOMEX_ALLOW_PRODUCTION=true",
    )
  }

  const clientId = environment.SISCOMEX_CLIENT_ID ?? null
  const clientSecret = environment.SISCOMEX_CLIENT_SECRET ?? null
  return {
    enabled,
    environment: selectedEnvironment,
    baseUrl: SISCOMEX_ENVIRONMENTS[selectedEnvironment],
    roleType: environment.SISCOMEX_ROLE_TYPE ?? "IMPEXP",
    authMode: "access_key",
    clientId,
    clientSecret,
    responsibleRootId: environment.SISCOMEX_RESPONSIBLE_ROOT_ID ?? null,
    cacheTtlSeconds: positiveInteger(
      environment.SISCOMEX_CACHE_TTL_SECONDS,
      3600,
      "SISCOMEX_CACHE_TTL_SECONDS",
    ),
    timeoutMs: positiveInteger(
      environment.SISCOMEX_TIMEOUT_MS,
      15_000,
      "SISCOMEX_TIMEOUT_MS",
    ),
    maxServerRetries: positiveInteger(
      environment.SISCOMEX_MAX_SERVER_RETRIES,
      1,
      "SISCOMEX_MAX_SERVER_RETRIES",
    ),
    configured: Boolean(clientId && clientSecret),
    allowProduction,
  }
}
