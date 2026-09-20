import { auth } from "@/lib/auth";
import { ActivityError } from "./activity.service";

export async function authenticatedActivityUserId(_request: Request) {
  const session = await auth();
  const sessionId = (session?.user as { id?: string } | undefined)?.id;
  if (sessionId) return sessionId;
  return undefined;
}

export function activityJsonError(error: unknown) {
  if (error instanceof ActivityError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
  console.error("activity_error", error instanceof Error ? error.message : "unknown");
  return Response.json({ code: "INTERNAL_ERROR", message: "Não foi possível consultar as atividades." }, { status: 500 });
}
