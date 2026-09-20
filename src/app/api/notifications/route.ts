import { auth } from "@/lib/auth";
import { authenticatedUserId } from "@/modules/catalogRequest/catalogRequest.http";
import { listNotifications } from "@/modules/notification/notification.service";

export async function GET(request: Request) {
  const userId = await authenticatedUserId(request, await auth());
  if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 30);
  return Response.json({ items: await listNotifications(userId, Number.isFinite(limit) ? limit : 30) });
}
