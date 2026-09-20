import { auth } from "@/lib/auth";
import { ImporterError } from "./importer.service";

export async function authenticatedImporterUserId(request: Request) {
  const sessionId = (await auth())?.user?.id;
  if (sessionId) return sessionId;
  return undefined;
}

export function importerJsonError(error: unknown) {
  if (error instanceof ImporterError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
  console.error("importer_error", error instanceof Error ? error.message : "unknown");
  return Response.json({ code: "INTERNAL_ERROR", message: "Não foi possível carregar os dados do portal." }, { status: 500 });
}
