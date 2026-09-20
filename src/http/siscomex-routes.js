import { ValidationError } from "../domain/shared/errors.js"
import { readJson, sendJson } from "./json.js"

function expectedVersion(request) {
  const raw = request.headers["if-match"]
  if (raw === undefined) return undefined
  const normalized = String(raw).replace(/^W\//, "").replaceAll('"', "")
  const version = Number(normalized)
  if (!Number.isInteger(version) || version < 1) {
    throw new ValidationError("If-Match must contain a positive case version")
  }
  return version
}

export async function handleSiscomexRoute({ request, response, segments, service }) {
  const integrationRoute =
    segments[0] === "api" &&
    segments[1] === "prisma" &&
    segments[2] === "integrations" &&
    segments[3] === "siscomex"

  if (
    integrationRoute &&
    request.method === "GET" &&
    segments[4] === "status" &&
    segments.length === 5
  ) {
    sendJson(response, 200, service.getSiscomexStatus())
    return true
  }

  if (
    integrationRoute &&
    request.method === "POST" &&
    segments[4] === "test" &&
    segments.length === 5
  ) {
    sendJson(response, 200, await service.testSiscomexConnection())
    return true
  }

  const caseRoute =
    segments[0] === "api" &&
    segments[1] === "prisma" &&
    segments[2] === "cases" &&
    segments[4] === "siscomex"
  if (caseRoute && request.method === "POST" && segments[5] === "sync") {
    const body = await readJson(request)
    sendJson(response, 200, await service.syncSiscomex(
      decodeURIComponent(segments[3]),
      {
        ...body,
        expectedVersion: expectedVersion(request) ?? body.expectedVersion,
      },
    ))
    return true
  }
  if (caseRoute && request.method === "GET" && segments[5] === "catalog") {
    sendJson(
      response,
      200,
      service.getSiscomexCatalog(decodeURIComponent(segments[3])),
    )
    return true
  }
  if (caseRoute && request.method === "GET" && segments[5] === "diff") {
    sendJson(
      response,
      200,
      service.getSiscomexDiff(decodeURIComponent(segments[3])),
    )
    return true
  }

  const lookupRoute =
    segments[0] === "api" &&
    segments[1] === "prisma" &&
    segments[2] === "siscomex" &&
    segments.length === 5
  if (lookupRoute && request.method === "GET" && segments[3] === "attributes") {
    sendJson(
      response,
      200,
      await service.getSiscomexAttributes(decodeURIComponent(segments[4])),
    )
    return true
  }
  if (lookupRoute && request.method === "GET" && segments[3] === "ncm") {
    sendJson(
      response,
      200,
      await service.getSiscomexNcm(decodeURIComponent(segments[4])),
    )
    return true
  }
  return false
}
