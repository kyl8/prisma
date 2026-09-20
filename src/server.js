import { createServer } from "node:http"
import { pathToFileURL } from "node:url"

import { PRISMA_ANALYSIS_POLICY } from "./policy.js"

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

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  })
  response.end(JSON.stringify(body))
}
export function createPrismaServer() {
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" })
      return
    }

    if (request.method === "GET" && url.pathname === "/api/prisma/policy") {
      sendJson(response, 200, PRISMA_ANALYSIS_POLICY)
      return
    }

    sendJson(response, 404, { error: "not_found" })
  })
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntryPoint) {
  const port = resolvePort()
  createPrismaServer().listen(port, () => {
    console.log(`PRISMA backend listening on http://localhost:${port}`)
  })
}
