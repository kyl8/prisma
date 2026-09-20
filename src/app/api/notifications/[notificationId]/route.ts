import { auth } from "@/lib/auth";
import { authenticatedUserId } from "@/modules/catalogRequest/catalogRequest.http";
import { markNotificationRead } from "@/modules/notification/notification.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const userId = await authenticatedUserId(request, await auth());
  if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
  const item = await markNotificationRead(userId, (await params).notificationId);
  if (!item) return Response.json({ code: "NOT_FOUND", message: "Notificação não encontrada." }, { status: 404 });
  return Response.json(item);
}
