import { ValidationError } from "../domain/shared/errors.js"

const MAX_BODY_BYTES = 1_000_000

export function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  })
  response.end(JSON.stringify(body))
}

export function sendContent(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "content-length": Buffer.byteLength(body),
    ...headers,
  })
  response.end(body)
}

export async function readJson(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      throw new ValidationError("Request body exceeds 1 MB")
    }
    chunks.push(chunk)
  }

  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw new ValidationError("Request body must be valid JSON")
  }
}
