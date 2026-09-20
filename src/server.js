import { createServer } from "node:http"
import { pathToFileURL } from "node:url"

import { PRISMA_ANALYSIS_POLICY } from "./policy.js"

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
  const port = Number(process.env.PORT ?? 3001)
  createPrismaServer().listen(port, () => {
    console.log(`PRISMA backend listening on http://localhost:${port}`)
  })
}
