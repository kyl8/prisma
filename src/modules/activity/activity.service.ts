import type { ActivityType, Prisma, PrismaClient } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { canAccessActivityCompany, dispatcherVisible, importerVisible } from "./activity.policy";
import type { ActivityDTO, RecordActivityInput } from "./activity.types";

export type ActivityClient = Pick<PrismaClient, "product" | "catalogRequest" | "activityEvent">;

export class ActivityError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

const activityInclude = {
  actor: { include: { custbrok: true, importer: true } }, company: { include: { user: { select: { enterprise: true } } } },
  product: { select: { id: true, name: true } }, request: { select: { id: true } },
} satisfies Prisma.ActivityEventInclude;
type IncludedActivity = Prisma.ActivityEventGetPayload<{ include: typeof activityInclude }>;

export function activityDto(activity: IncludedActivity): ActivityDTO {
  const role = !activity.actor ? "SYSTEM" : activity.actor.custbrok ? "DISPATCHER" : activity.actor.importer ? "IMPORTER" : "SYSTEM";
  return {
    id: activity.id, type: activity.type, visibility: activity.visibility, entityType: activity.entityType, entityId: activity.entityId,
    createdAt: activity.createdAt.toISOString(), metadata: activity.metadata,
    actor: activity.actor ? { id: activity.actor.id, name: activity.actor.name, role } : null,
    company: { id: activity.companyId, name: activity.company.user.enterprise }, product: activity.product, request: activity.request,
  };
}

/** Records a durable business event. Pass an open Prisma transaction to keep it atomic with its business change. */
export async function recordActivity(client: ActivityClient, input: RecordActivityInput) {
  if (input.productId) {
    const product = await client.product.findUnique({ where: { id: input.productId }, select: { importerId: true } });
    if (!product || product.importerId !== input.companyId) throw new ActivityError("PRODUCT_SCOPE_ERROR", "Produto fora da empresa da atividade.", 403);
  }
  if (input.requestId) {
    const request = await client.catalogRequest.findUnique({ where: { id: input.requestId }, select: { companyId: true } });
    if (!request || request.companyId !== input.companyId) throw new ActivityError("REQUEST_SCOPE_ERROR", "Solicitação fora da empresa da atividade.", 403);
  }
  return client.activityEvent.create({ data: input });
}

export type ActivityQuery = { companyId?: string; actorId?: string; types?: ActivityType[]; from?: Date; to?: Date; order?: "asc" | "desc"; cursor?: string; limit?: number; };

async function viewer(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { importer: true, custbrok: { include: { companyAccesses: { select: { companyId: true } } } } } });
  if (!user) throw new ActivityError("UNAUTHORIZED", "Usuário não encontrado.", 401);
  if (user.importer) return { kind: "IMPORTER" as const, companyIds: [user.importer.id] };
  if (user.custbrok) return { kind: "DISPATCHER" as const, companyIds: user.custbrok.companyAccesses.map((access) => access.companyId) };
  throw new ActivityError("FORBIDDEN", "Este perfil não possui acesso a atividades.", 403);
}

export async function listActivities(userId: string, query: ActivityQuery) {
  const currentViewer = await viewer(userId);
  const requestedCompanyId = currentViewer.kind === "IMPORTER" ? currentViewer.companyIds[0] : query.companyId;
  if (requestedCompanyId && !canAccessActivityCompany(currentViewer.companyIds, requestedCompanyId)) throw new ActivityError("FORBIDDEN", "Sem acesso a esta empresa.", 403);
  const order = query.order ?? "desc";
  const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
  const cursor = query.cursor ? await prisma.activityEvent.findUnique({ where: { id: query.cursor }, select: { id: true, createdAt: true } }) : null;
  if (query.cursor && !cursor) throw new ActivityError("INVALID_CURSOR", "Cursor inválido.", 422);
  const direction = order === "desc" ? "lt" : "gt";
  const cursorWhere = cursor ? { OR: [{ createdAt: { [direction]: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { [direction]: cursor.id } }] } : {};
  const events = await prisma.activityEvent.findMany({
    where: { companyId: requestedCompanyId ?? { in: currentViewer.companyIds }, visibility: { in: currentViewer.kind === "IMPORTER" ? importerVisible : dispatcherVisible },
      ...(query.actorId ? { actorUserId: query.actorId } : {}), ...(query.types?.length ? { type: { in: query.types } } : {}),
      ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}), ...cursorWhere },
    include: activityInclude, orderBy: [{ createdAt: order }, { id: order }], take: limit + 1,
  });
  const hasMore = events.length > limit;
  const page = events.slice(0, limit);
  return { items: page.map(activityDto), nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
}

export async function activityFilterOptions(userId: string, companyId?: string) {
  const currentViewer = await viewer(userId);
  const targetCompanyId = currentViewer.kind === "IMPORTER" ? currentViewer.companyIds[0] : companyId;
  if (targetCompanyId && !canAccessActivityCompany(currentViewer.companyIds, targetCompanyId)) throw new ActivityError("FORBIDDEN", "Sem acesso a esta empresa.", 403);
  const companyIds = targetCompanyId ? [targetCompanyId] : currentViewer.companyIds;
  const visibility = currentViewer.kind === "IMPORTER" ? importerVisible : dispatcherVisible;
  const [companies, actors] = await Promise.all([
    currentViewer.kind === "IMPORTER" ? Promise.resolve([]) : prisma.importer.findMany({ where: { id: { in: companyIds } }, include: { user: { select: { enterprise: true } } }, orderBy: { user: { enterprise: "asc" } } }),
    prisma.activityEvent.findMany({ where: { companyId: { in: companyIds }, visibility: { in: visibility }, actorUserId: { not: null } }, distinct: ["actorUserId"], select: { actor: { select: { id: true, name: true } } } }),
  ]);
  return { companies: companies.map((company) => ({ id: company.id, name: company.user.enterprise })), actors: actors.flatMap((item) => item.actor ? [{ id: item.actor.id, name: item.actor.name ?? "Usuário" }] : []) };
}
