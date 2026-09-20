import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ActivityError } from "./activity.service";

export async function authenticatedActivityUserId(request: Request) {
  const session = await auth();
  const sessionId = (session?.user as { id?: string } | undefined)?.id;
  if (sessionId) return sessionId;
  if (process.env.NODE_ENV !== "production") {
    const email = request.headers.get("x-prisma-demo-email");
    if (email) return (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id;
  }
  return undefined;
}

export function activityJsonError(error: unknown) {
  if (error instanceof ActivityError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
  console.error("activity_error", error instanceof Error ? error.message : "unknown");
  return Response.json({ code: "INTERNAL_ERROR", message: "Não foi possível consultar as atividades." }, { status: 500 });
}
