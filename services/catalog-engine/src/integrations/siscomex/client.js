import { randomUUID } from "node:crypto"

import {
  SiscomexConfigurationError,
  SiscomexError,
} from "./errors.js"
import { readSiscomexResponse } from "./response.js"

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

function safePath(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError("Siscomex request path must be relative to the configured host")
  }
  return path
}

function queryString(query = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else {
      params.set(key, String(value))
    }
  }
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ""
}

export class SiscomexClient {
  constructor({
    config,
    sessionManager,
    transport = fetch,
    sleep = wait,
    idFactory = randomUUID,
  }) {
    this.config = config
    this.sessionManager = sessionManager
    this.transport = transport
    this.sleep = sleep
    this.idFactory = idFactory
  }

  async request(options) {
    if (!this.config.enabled) {
      throw new SiscomexConfigurationError("Siscomex integration is disabled")
    }
    if (options.authenticated === false) return this.#execute(options)
    return this.sessionManager.runExclusive(() => this.#execute(options))
  }

  async #execute({
    method = "GET",
    path,
    query,
    body,
    subsystem,
    operation,
    authenticated = true,
  }) {
    const requestId = this.idFactory()
    let serverRetries = 0
    let authenticationRetries = 0
    while (true) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
      try {
        const session = authenticated
          ? await this.sessionManager.getSession({ signal: controller.signal })
          : null
        const headers = { Accept: "application/json" }
        if (session) {
          headers.Authorization = session.authorization
          headers["X-CSRF-Token"] = session.csrfToken
        }
        if (body !== undefined) headers["Content-Type"] = "application/json"
        const response = await this.transport(
          `${this.config.baseUrl}${safePath(path)}${queryString(query)}`,
          {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
          },
        )
        if (authenticated) this.sessionManager.updateFromResponse(response)
        const payload = await readSiscomexResponse(response)
        if (response.ok) {
          return {
            data: payload,
            status: response.status,
            correlation: {
              requestId,
              externalTag: response.headers.get("x-correlation-id") ?? null,
              subsystem,
              operation,
            },
          }
        }
        const error = SiscomexError.fromResponse(response, payload, {
          subsystem,
          operation,
        })
        if (response.status === 401 && authenticated && authenticationRetries === 0) {
          authenticationRetries += 1
          this.sessionManager.invalidate()
          continue
        }
        if (
          error.retryable &&
          !error.rateLimited &&
          serverRetries < this.config.maxServerRetries
        ) {
          serverRetries += 1
          await this.sleep(100 * 2 ** (serverRetries - 1))
          continue
        }
        throw error
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new SiscomexError("Siscomex request timed out", {
            code: "SISCOMEX_TIMEOUT",
            subsystem,
            operation,
            retryable: true,
          })
        }
        throw error
      } finally {
        clearTimeout(timeout)
      }
    }
  }
}
