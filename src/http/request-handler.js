import { PRISMA_ANALYSIS_POLICY } from "../policy.js"
import {
  CaseVersionConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/shared/errors.js"
import { handleCaseRoute } from "./case-routes.js"
import { readJson, sendJson } from "./json.js"
import { handleSiscomexRoute } from "./siscomex-routes.js"
import { SiscomexError } from "../integrations/siscomex/errors.js"

export function createRequestHandler({ service, maxUploadSize = 5_000_000 }) {
  return async function requestHandler(request, response) {
    try {
      const url = new URL(request.url ?? "/", "http://localhost")
      const segments = url.pathname.split("/").filter(Boolean)

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { status: "ok" })
        return
      }

      if (request.method === "GET" && url.pathname === "/api/prisma/policy") {
        sendJson(response, 200, PRISMA_ANALYSIS_POLICY)
        return
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/prisma/catalog/validate"
      ) {
        sendJson(response, 200, service.validateCatalog(await readJson(request)))
        return
      }

      const siscomexHandled = await handleSiscomexRoute({
        request,
        response,
        segments,
        service,
      })
      if (siscomexHandled) return

      const handled = await handleCaseRoute({
        request,
        response,
        segments,
        service,
        maxUploadSize,
      })
      if (!handled) sendJson(response, 404, { error: "not_found" })
    } catch (error) {
      if (error instanceof NotFoundError) {
        sendJson(response, 404, { error: "not_found", message: error.message })
        return
      }
      if (error instanceof ValidationError) {
        sendJson(response, 400, {
          error: "validation_error",
          message: error.message,
          details: error.details ?? null,
        })
        return
      }
      if (error instanceof CaseVersionConflictError) {
        sendJson(response, 409, {
          error: error.code,
          caseId: error.caseId,
          expectedVersion: error.expectedVersion,
          currentVersion: error.currentVersion,
        })
        return
      }
      if (error instanceof SiscomexError) {
        const status = error.rateLimited
          ? 429
          : error.code === "SISCOMEX_NOT_CONFIGURED"
            ? 503
            : error.httpStatus === 404
              ? 404
              : error.retryable
                ? 503
                : 502
        sendJson(response, status, error.toPublic())
        return
      }

      sendJson(response, 500, { error: "internal_error" })
    }
  }
}
