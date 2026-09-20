const SENSITIVE_KEYS = new Set([
  "authorization",
  "set-token",
  "x-csrf-token",
  "client-id",
  "client-secret",
  "access-key",
  "certificate",
  "passphrase",
  "secret",
  "jwt",
])

export function redactSiscomex(value) {
  if (Array.isArray(value)) return value.map(redactSiscomex)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase())
        ? "[REDACTED]"
        : redactSiscomex(item),
    ]),
  )
}
