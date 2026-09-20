import { ValidationError } from "../domain/shared/errors.js"
import { readJson, sendContent, sendJson } from "./json.js"
import { readMultipartUpload } from "./multipart.js"

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

function caseResource(operationalCase, resource) {
  const resources = {
    evidence: operationalCase.evidences,
    divergences: operationalCase.divergences,
    actions: operationalCase.actions,
    findings: operationalCase.findings,
    readiness: operationalCase.readiness,
    decision: operationalCase.decision,
  }
  return resources[resource]
}

export async function handleCaseRoute({
  request,
  response,
  segments,
  service,
  maxUploadSize,
}) {
  const isCaseRoute =
    segments[0] === "api" &&
    segments[1] === "prisma" &&
    segments[2] === "cases"
  if (!isCaseRoute) return false

  if (request.method === "POST" && segments.length === 3) {
    sendJson(response, 201, service.createCase(await readJson(request)))
    return true
  }

  if (request.method === "GET" && segments.length === 3) {
    sendJson(response, 200, service.listCases())
    return true
  }

  const caseId = decodeURIComponent(segments[3] ?? "")
  if (!caseId) {
    throw new ValidationError("Case id is required")
  }

  if (request.method === "GET" && segments.length === 4) {
    sendJson(response, 200, service.getCase(caseId))
    return true
  }

  if (
    request.method === "GET" &&
    segments.length === 5 &&
    segments[4] === "catalog"
  ) {
    sendJson(response, 200, service.getCatalog(caseId))
    return true
  }

  if (
    request.method === "GET" &&
    segments.length === 6 &&
    segments[4] === "catalog" &&
    segments[5] === "diff"
  ) {
    sendJson(response, 200, service.getCatalogDiff(caseId))
    return true
  }

  if (
    request.method === "GET" &&
    segments.length === 6 &&
    segments[4] === "catalog" &&
    segments[5] === "export"
  ) {
    const url = new URL(request.url ?? "/", "http://localhost")
    const exported = service.exportCatalog(
      caseId,
      url.searchParams.get("format") ?? "json",
    )
    sendContent(response, 200, exported.body, {
      "content-type": exported.contentType,
      "content-disposition": `attachment; filename="${exported.fileName}"`,
    })
    return true
  }

  if (
    request.method === "GET" &&
    segments.length === 6 &&
    segments[4] === "catalog"
  ) {
    sendJson(
      response,
      200,
      service.getCatalogRecord(caseId, decodeURIComponent(segments[5])),
    )
    return true
  }

  if (
    request.method === "POST" &&
    segments.length === 5 &&
    segments[4] === "documents"
  ) {
    sendJson(
      response,
      201,
      service.addDocument(caseId, await readJson(request), {
        expectedVersion: expectedVersion(request),
      }),
    )
    return true
  }

  if (
    request.method === "POST" &&
    segments.length === 5 &&
    segments[4] === "ingest"
  ) {
    const body = await readJson(request)
    sendJson(response, 201, service.ingest(caseId, body, {
      expectedVersion: expectedVersion(request),
      actor: body.actor,
      idempotencyKey: request.headers["idempotency-key"] ?? body.idempotencyKey,
    }))
    return true
  }

  if (
    request.method === "POST" &&
    segments.length === 6 &&
    segments[4] === "documents" &&
    segments[5] === "upload"
  ) {
    const upload = await readMultipartUpload(request, { maxUploadSize })
    sendJson(response, 201, service.uploadDocument(caseId, {
      ...upload,
      documentType: upload.fields.documentType,
      documentId: upload.fields.documentId,
      externalId: upload.fields.externalId,
      supersedesDocumentId: upload.fields.supersedesDocumentId,
      idempotencyKey: upload.fields.idempotencyKey,
    }, {
      expectedVersion: expectedVersion(request),
      idempotencyKey:
        request.headers["idempotency-key"] ?? upload.fields.idempotencyKey,
    }))
    return true
  }

  if (
    request.method === "POST" &&
    segments.length === 5 &&
    segments[4] === "analyze"
  ) {
    sendJson(response, 200, service.analyze(caseId, {
      expectedVersion: expectedVersion(request),
    }))
    return true
  }

  if (
    request.method === "GET" &&
    segments.length === 5 &&
    [
      "evidence",
      "divergences",
      "findings",
      "actions",
      "readiness",
      "decision",
    ].includes(segments[4])
  ) {
    sendJson(response, 200, caseResource(service.getCase(caseId), segments[4]))
    return true
  }

  if (
    request.method === "POST" &&
    segments.length === 7 &&
    segments[4] === "actions" &&
    segments[6] === "resolve"
  ) {
    const body = await readJson(request)
    sendJson(
      response,
      200,
      service.resolveAction(
        caseId,
        decodeURIComponent(segments[5]),
        { ...body, expectedVersion: expectedVersion(request) ?? body.expectedVersion },
      ),
    )
    return true
  }


  if (
    request.method === "POST" &&
    segments.length === 7 &&
    segments[4] === "actions" &&
    ["start", "cancel", "reopen"].includes(segments[6])
  ) {
    const body = await readJson(request)
    const input = {
      ...body,
      expectedVersion: expectedVersion(request) ?? body.expectedVersion,
    }
    const method = {
      start: "startAction",
      cancel: "cancelAction",
      reopen: "reopenAction",
    }[segments[6]]
    sendJson(response, 200, service[method](caseId, decodeURIComponent(segments[5]), input))
    return true
  }

  if (
    request.method === "POST" &&
    segments.length === 7 &&
    segments[4] === "findings" &&
    segments[6] === "dismiss"
  ) {
    const body = await readJson(request)
    sendJson(response, 200, service.dismissFinding(
      caseId,
      decodeURIComponent(segments[5]),
      { ...body, expectedVersion: expectedVersion(request) ?? body.expectedVersion },
    ))
    return true
  }

  return false
}
