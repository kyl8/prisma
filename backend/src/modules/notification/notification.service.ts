import type { PrismaClient } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

export type NotificationClient = Pick<PrismaClient, "notification">;
export type CreateNotificationInput = { userId: string; action: string; description: string; entityType?: string; entityId?: string };

/** Persists in-app notifications; callers should pass their active transaction when applicable. */
export async function createNotification(client: NotificationClient, input: CreateNotificationInput) {
  return client.notification.create({ data: input });
}

export async function listNotifications(userId: string, limit = 30) {
  const items = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 100) });
  return items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), readAt: item.readAt?.toISOString() ?? null }));
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const item = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!item) return null;
  const updated = await prisma.notification.update({ where: { id: notificationId }, data: { readAt: item.readAt ?? new Date() } });
  return { ...updated, createdAt: updated.createdAt.toISOString(), readAt: updated.readAt?.toISOString() ?? null };
}
