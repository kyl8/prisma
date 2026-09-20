import { CatalogRequestError } from "./catalogRequest.service";
import { IntegrationError } from "@/modules/integration/integration.errors";

export function jsonError(error: unknown) {
  if (error instanceof CatalogRequestError) return Response.json({ code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) }, { status: error.status });
  if (error instanceof IntegrationError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
  console.error("catalog_request_error", error instanceof Error ? error.message : "unknown");
  return Response.json({ code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação." }, { status: 500 });
}

export function sessionUserId(session: any) {
  return session?.user?.id as string | undefined;
}

export async function authenticatedUserId(_request: Request, session: any) {
  const sessionId = sessionUserId(session);
  if (sessionId) return sessionId;
  return undefined;
}
