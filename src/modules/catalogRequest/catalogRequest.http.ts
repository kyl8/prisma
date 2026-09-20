import { CatalogRequestError } from "./catalogRequest.service";
import prisma from "@/lib/prisma";

export function jsonError(error: unknown) {
  if (error instanceof CatalogRequestError) return Response.json({ code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) }, { status: error.status });
  console.error("catalog_request_error", error instanceof Error ? error.message : "unknown");
  return Response.json({ code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação." }, { status: 500 });
}

export function sessionUserId(session: any) {
  return session?.user?.id as string | undefined;
}

/** Development-only bridge for the standalone Vite prototype. Production uses Auth.js cookies. */
export async function authenticatedUserId(request: Request, session: any) {
  const sessionId = sessionUserId(session);
  if (sessionId) return sessionId;
  if (process.env.NODE_ENV !== "production") {
    const email = request.headers.get("x-prisma-demo-email");
    if (email) return (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id;
  }
  return undefined;
}
