function sanitizedMessage(message) {
  return String(message ?? "Siscomex request failed").replace(
    /(authorization|set-token|x-csrf-token|client-id|client-secret|access-key|passphrase|secret)\s*[:=]\s*[^\s,;]+/gi,
    "$1=[REDACTED]",
  )
}

export class SiscomexError extends Error {
  constructor(message, {
    httpStatus = null,
    code = "SISCOMEX_ERROR",
    tag = null,
    subsystem = null,
    retryable = false,
    rateLimited = false,
    operation = null,
  } = {}) {
    super(sanitizedMessage(message))
    this.name = "SiscomexError"
    this.httpStatus = httpStatus
    this.code = code
    this.tag = tag
    this.subsystem = subsystem
    this.retryable = retryable
    this.rateLimited = rateLimited
    this.operation = operation
  }

  static fromResponse(response, payload, context = {}) {
    const status = response.status
    const code = payload?.code ?? `SISCOMEX_HTTP_${status}`
    return new SiscomexError(
      payload?.message ?? `Siscomex returned HTTP ${status}`,
      {
        httpStatus: status,
        code,
        tag: payload?.tag ?? null,
        subsystem: context.subsystem ?? null,
        operation: context.operation ?? null,
        retryable: [500, 503].includes(status),
        rateLimited: status === 429 || code === "PUCX-ER1001",
      },
    )
  }

  toPublic() {
    return {
      error: "siscomex_error",
      code: this.code,
      message: this.message,
      tag: this.tag,
      subsystem: this.subsystem,
      retryable: this.retryable,
      rateLimited: this.rateLimited,
    }
  }
}

export class SiscomexConfigurationError extends SiscomexError {
  constructor(message) {
    super(message, {
      code: "SISCOMEX_NOT_CONFIGURED",
      subsystem: "AUTH",
      retryable: false,
    })
    this.name = "SiscomexConfigurationError"
  }
}
