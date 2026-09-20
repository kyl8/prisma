import {
  SiscomexConfigurationError,
  SiscomexError,
} from "./errors.js"
import { readSiscomexResponse } from "./response.js"

function expirationFrom(response, clock) {
  const raw = response.headers.get("x-csrf-expiration")
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed > clock()) return parsed
  return clock() + 55 * 60 * 1000
}

export class SiscomexAuthProvider {
  authenticate() {
    throw new Error("SiscomexAuthProvider.authenticate must be implemented")
  }
}

export class AccessKeyAuthProvider extends SiscomexAuthProvider {
  constructor({ config, transport = fetch, clock = Date.now }) {
    super()
    this.config = config
    this.transport = transport
    this.clock = clock
  }

  async authenticate({ signal } = {}) {
    if (!this.config.enabled) {
      throw new SiscomexConfigurationError("Siscomex integration is disabled")
    }
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new SiscomexConfigurationError(
        "Siscomex access keys are not configured",
      )
    }
    const response = await this.transport(
      `${this.config.baseUrl}/portal/api/autenticar/chave-acesso`,
      {
        method: "POST",
        headers: {
          "Client-Id": this.config.clientId,
          "Client-Secret": this.config.clientSecret,
          "Role-Type": this.config.roleType,
          Accept: "application/json",
        },
        signal,
      },
    )
    const payload = await readSiscomexResponse(response)
    if (!response.ok) {
      throw SiscomexError.fromResponse(response, payload, {
        subsystem: "AUTH",
        operation: "AUTHENTICATE_ACCESS_KEY",
      })
    }
    const authorization = response.headers.get("set-token")
    const csrfToken = response.headers.get("x-csrf-token")
    if (!authorization || !csrfToken) {
      throw new SiscomexError(
        "Siscomex authentication did not return required session headers",
        { code: "SISCOMEX_INVALID_AUTH_RESPONSE", subsystem: "AUTH" },
      )
    }
    return {
      authorization,
      csrfToken,
      expiresAt: expirationFrom(response, this.clock),
    }
  }
}
