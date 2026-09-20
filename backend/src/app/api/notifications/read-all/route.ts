import { auth } from "@/lib/auth";
import { authenticatedUserId } from "@/modules/catalogRequest/catalogRequest.http";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  const userId = await authenticatedUserId(request, await auth());
  if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return Response.json({ ok: true });
}
