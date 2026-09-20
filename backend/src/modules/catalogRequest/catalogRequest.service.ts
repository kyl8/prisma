import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import type { CreateCatalogRequestInput, SaveProductInput, UpdateCatalogRequestInput } from "./catalogRequest.schemas";
import { recordActivity } from "@/modules/activity/activity.service";
import { createNotification } from "@/modules/notification/notification.service";

export const REQUEST_STATUSES = ["waiting", "in_progress", "submitted", "completed", "expired", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export class CatalogRequestError extends Error {
  constructor(public code: string, message: string, public status = 400, public fields?: unknown[]) {
    super(message);
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/r/${token}/catalogo`;
}

function latestValues(product: any) {
  const values = new Map<string, string>();
  for (const record of [...product.records].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    for (const response of record.fieldResp) {
      if (!values.has(response.fieldId)) values.set(response.fieldId, response.response);
    }
  }
  return values;
}

function mapProduct(product: any, responses: any[] = []) {
  const values = latestValues(product);
  const responseByField = new Map(responses.filter((r) => r.productId === product.id).map((r) => [r.fieldKey, r]));
  return {
    id: product.id,
    name: product.name,
    sku: product.code,
    ncm: product.ncm,
    completeness: product.completeness,
    status: product.status,
    attributes: product.fields.map((field: any) => {
      const response = responseByField.get(field.id);
      const value = response?.value ?? values.get(field.id) ?? "";
      return {
        key: field.id,
        title: field.title,
        label: field.label,
        type: field.type,
        required: Boolean(field.required),
        value,
        pending: response?.status === "pending",
        correctionNote: response?.note ?? undefined,
      };
    }),
  };
}

function assertNotExpired(request: any) {
  if (request.expiresAt <= new Date()) {
    if (request.status !== "expired") {
      void prisma.catalogRequest.update({ where: { id: request.id }, data: { status: "expired" } });
    }
    throw new CatalogRequestError("REQUEST_EXPIRED", "Este link expirou.", 410);
  }
}

async function findByToken(token: string) {
  if (!token || token.length < 32) throw new CatalogRequestError("INVALID_TOKEN", "Link indisponível.", 404);
  const request = await prisma.catalogRequest.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      company: { include: { user: true } },
      createdBy: { include: { custbrok: true } },
      products: {
        include: {
          product: {
            include: {
              fields: true,
              records: { orderBy: { createdAt: "desc" }, include: { fieldResp: true } },
            },
          },
        },
      },
      responses: true,
    },
  });
  if (!request) throw new CatalogRequestError("INVALID_TOKEN", "Link indisponível.", 404);
  if (request.status === "cancelled") throw new CatalogRequestError("REQUEST_CANCELLED", "Esta solicitação foi cancelada.", 410);
  assertNotExpired(request);
  return request;
}

function dto(request: any, token?: string) {
  return {
    id: request.id,
    status: request.status,
    kind: request.kind,
    message: request.message,
    expiresAt: request.expiresAt.toISOString(),
    createdAt: request.createdAt.toISOString(),
    company: { id: request.company.id, name: request.company.user.enterprise, cnpj: request.company.user.cnpj },
    requestedBy: { name: request.createdBy.name, title: request.createdBy.custbrok ? "Despachante aduaneiro" : "" },
    recipient: { name: request.recipientName, email: request.recipientEmail },
    products: request.products.map((entry: any) => mapProduct(entry.product, request.responses)),
    ...(token ? { token, url: publicUrl(token) } : {}),
  };
}

export async function createCatalogRequest(input: CreateCatalogRequestInput, userId: string) {
  if (input.expiresAt <= new Date()) throw new CatalogRequestError("INVALID_EXPIRY", "O prazo precisa estar no futuro.");
  const creator = await prisma.user.findUnique({ where: { id: userId }, include: { custbrok: true } });
  if (!creator?.custbrok) throw new CatalogRequestError("FORBIDDEN", "Apenas despachantes podem criar solicitações.", 403);
  const broker = creator.custbrok;
  const company = await prisma.importer.findUnique({ where: { id: input.companyId }, include: { user: true } });
  if (!company) throw new CatalogRequestError("COMPANY_NOT_FOUND", "Empresa não encontrada.", 404);
  const uniqueProductIds = [...new Set(input.productIds)];
  const products = await prisma.product.findMany({ where: { id: { in: uniqueProductIds }, importerId: company.id }, include: { fields: true } });
  if (products.length !== uniqueProductIds.length) throw new CatalogRequestError("PRODUCT_SCOPE_ERROR", "Um ou mais produtos não pertencem à empresa.", 403);
  if (input.kind === "correction") {
    if (!input.correctionProductId || !input.correctionFieldKey || !input.correctionNote) {
      throw new CatalogRequestError("INVALID_CORRECTION", "Correção precisa de produto, campo e observação.");
    }
    const product = products.find((p) => p.id === input.correctionProductId);
    if (!product || !product.fields.some((f) => f.id === input.correctionFieldKey || f.title === input.correctionFieldKey)) {
      throw new CatalogRequestError("INVALID_CORRECTION", "Campo de correção inválido.");
    }
  }
  const token = crypto.randomBytes(32).toString("hex");
  const request = await prisma.$transaction(async (tx) => {
    await tx.customsBrokerCompanyAccess.upsert({
      where: { customsBrokerId_companyId: { customsBrokerId: broker.id, companyId: company.id } },
      update: {},
      create: { customsBrokerId: broker.id, companyId: company.id },
    });
    const created = await tx.catalogRequest.create({
      data: {
        tokenHash: hashToken(token), companyId: company.id, createdById: userId,
        recipientName: input.recipientName, recipientEmail: input.recipientEmail,
        expiresAt: input.expiresAt, message: input.message, kind: input.kind,
        products: { create: uniqueProductIds.map((productId) => ({ productId })) },
      },
    });
    if (input.kind === "correction" && input.correctionProductId && input.correctionFieldKey) {
      const correctionProduct = products.find((product) => product.id === input.correctionProductId);
      const correctionField = correctionProduct?.fields.find((field) => field.id === input.correctionFieldKey || field.title === input.correctionFieldKey);
      if (correctionField) await tx.catalogRequestResponse.create({ data: { requestId: created.id, productId: input.correctionProductId, fieldKey: correctionField.id, value: "", note: input.correctionNote } });
    }
    await recordActivity(tx, {
      companyId: company.id, actorUserId: userId, type: "REQUEST_CREATED", visibility: "SHARED",
      entityType: "catalog_request", entityId: created.id, requestId: created.id,
      metadata: { kind: input.kind, productCount: uniqueProductIds.length },
    });
    if (input.kind === "correction" && input.correctionProductId) {
      await recordActivity(tx, {
        companyId: company.id, actorUserId: userId, type: "CORRECTION_REQUESTED", visibility: "SHARED",
        entityType: "catalog_request", entityId: created.id, requestId: created.id, productId: input.correctionProductId,
        metadata: { fieldKey: input.correctionFieldKey ?? null },
      });
    }
    await createNotification(tx, {
      userId: company.userId, action: "Nova solicitação de preenchimento",
      description: `Você tem ${uniqueProductIds.length} produto(s) para preencher.`, entityType: "catalog_request", entityId: created.id,
    });
    return created;
  });
  return { id: request.id, status: request.status, token, url: publicUrl(token), company: { id: company.id, name: company.user.enterprise, cnpj: company.user.cnpj }, recipientName: request.recipientName, recipientEmail: request.recipientEmail, expiresAt: request.expiresAt.toISOString(), productCount: uniqueProductIds.length, createdAt: request.createdAt.toISOString() };
}

export async function listCatalogRequests(companyId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { custbrok: { include: { companyAccesses: { select: { companyId: true } } } } } });
  if (!user?.custbrok) throw new CatalogRequestError("FORBIDDEN", "Apenas despachantes podem consultar solicitações.", 403);
  if (!user.custbrok.companyAccesses.some((access) => access.companyId === companyId)) throw new CatalogRequestError("FORBIDDEN", "Sem acesso a esta empresa.", 403);
  const company = await prisma.importer.findUnique({ where: { id: companyId } });
  if (!company) throw new CatalogRequestError("COMPANY_NOT_FOUND", "Empresa não encontrada.", 404);
  const requests = await prisma.catalogRequest.findMany({ where: { companyId }, include: { products: { select: { productId: true } }, _count: { select: { products: true } } }, orderBy: { createdAt: "desc" } });
  return requests.map((request) => ({ id: request.id, status: request.status, kind: request.kind, recipientName: request.recipientName, recipientEmail: request.recipientEmail, message: request.message, expiresAt: request.expiresAt.toISOString(), createdAt: request.createdAt.toISOString(), productCount: request._count.products, productIds: request.products.map((product) => product.productId) }));
}

export async function listCompanies(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { custbrok: { include: { companyAccesses: { select: { companyId: true } } } } } });
  if (!user?.custbrok) throw new CatalogRequestError("FORBIDDEN", "Apenas despachantes podem consultar empresas.", 403);
  const companyIds = user.custbrok.companyAccesses.map((access) => access.companyId);
  const legacyCompanyIds = await prisma.catalogRequest.findMany({ where: { createdById: userId }, distinct: ["companyId"], select: { companyId: true } });
  const missingAccess = legacyCompanyIds.map((request) => request.companyId).filter((companyId) => !companyIds.includes(companyId));
  if (missingAccess.length) {
    await prisma.customsBrokerCompanyAccess.createMany({ data: missingAccess.map((companyId) => ({ customsBrokerId: user.custbrok!.id, companyId })), skipDuplicates: true });
    companyIds.push(...missingAccess);
  }
  const companies = await prisma.importer.findMany({ where: { id: { in: companyIds } }, include: { user: true, products: { include: { fields: true, records: { orderBy: { createdAt: "desc" }, include: { fieldResp: true } } } } }, orderBy: { user: { enterprise: "asc" } } });
  return companies.map((company) => ({
    id: company.id,
    name: company.user.enterprise,
    cnpj: company.user.cnpj,
    contactName: company.user.name,
    contactEmail: company.user.email,
    products: company.products.map((product) => mapProduct(product)),
  }));
}

export async function listWorkspaceCompanies(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { custbrok: true } });
  if (!user?.custbrok) throw new CatalogRequestError("FORBIDDEN", "Apenas despachantes podem consultar clientes.", 403);
  const requestCompanies = await prisma.catalogRequest.findMany({ where: { createdById: userId }, distinct: ["companyId"], select: { companyId: true } });
  if (requestCompanies.length) await prisma.customsBrokerCompanyAccess.createMany({ data: requestCompanies.map(({ companyId }) => ({ customsBrokerId: user.custbrok!.id, companyId })), skipDuplicates: true });
  const companies = await prisma.importer.findMany({
    where: { brokerAccesses: { some: { customsBrokerId: user.custbrok.id } } },
    include: {
      user: { select: { enterprise: true, cnpj: true, name: true, email: true } },
      products: { include: { fields: true, records: { orderBy: { createdAt: "desc" }, include: { fieldResp: true } }, catalogRequestResponses: true } },
      catalogRequests: { include: { _count: { select: { products: true } } }, orderBy: { createdAt: "desc" } },
      activityEvents: { where: { visibility: { in: ["SHARED", "DISPATCHER_ONLY", "IMPORTER_ONLY"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5, include: { actor: { select: { name: true } }, product: { select: { name: true } } } },
    },
    orderBy: { user: { enterprise: "asc" } },
  });
  return companies.map((company) => {
    const products = company.products.map((product) => mapProduct(product));
    const totalProducts = products.length;
    const complete = products.filter((product) => product.attributes.every((attribute: { value: string }) => attribute.value.trim())).length;
    const pendingRequests = company.catalogRequests.filter((request) => ["waiting", "in_progress"].includes(request.status));
    const submittedRequests = company.catalogRequests.filter((request) => request.status === "submitted");
    const pendingResponses = company.products.reduce((count, product) => count + product.catalogRequestResponses.filter((response) => response.status === "pending" && response.value.trim()).length, 0);
    return {
      id: company.id, name: company.user.enterprise, cnpj: company.user.cnpj, contactName: company.user.name, contactEmail: company.user.email,
      products, totalProducts, completeProducts: complete, completeness: totalProducts ? Math.round(complete / totalProducts * 100) : 0,
      pendingCount: pendingRequests.reduce((count, request) => count + request._count.products, 0), awaitingImporter: pendingRequests.length,
      inReview: submittedRequests.length, pendingResponses,
      requests: company.catalogRequests.map((request) => ({ id: request.id, status: request.status, kind: request.kind, recipientName: request.recipientName, recipientEmail: request.recipientEmail, createdAt: request.createdAt.toISOString(), productCount: request._count.products })),
      activity: company.activityEvents.map((event) => ({ id: event.id, type: event.type, createdAt: event.createdAt.toISOString(), actorName: event.actor?.name ?? "Importador", productName: event.product?.name ?? null, requestId: event.requestId })),
    };
  });
}

export async function createWorkspaceCompany(input: { enterprise: string; cnpj: string; name: string; email: string }, userId: string) {
  const broker = await prisma.customsbroker.findUnique({ where: { userId } });
  if (!broker) throw new CatalogRequestError("FORBIDDEN", "Apenas despachantes podem adicionar clientes.", 403);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new CatalogRequestError("EMAIL_IN_USE", "Este e-mail já pertence a uma conta.", 409);
  const digits = input.cnpj.replace(/\D/g, "");
  if (digits.length !== 14) throw new CatalogRequestError("INVALID_CNPJ", "Informe um CNPJ com 14 dígitos.", 422);
  const existingCnpj = await prisma.user.findFirst({ where: { cnpj: input.cnpj } });
  if (existingCnpj) throw new CatalogRequestError("CNPJ_IN_USE", "Já existe uma empresa cadastrada com este CNPJ.", 409);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: input.email, name: input.name, enterprise: input.enterprise, cnpj: input.cnpj } });
    const company = await tx.importer.create({ data: { userId: user.id } });
    await tx.customsBrokerCompanyAccess.create({ data: { customsBrokerId: broker.id, companyId: company.id } });
    return { id: company.id, name: user.enterprise, cnpj: user.cnpj, contactName: user.name, contactEmail: user.email, products: [], totalProducts: 0, completeProducts: 0, completeness: 0, pendingCount: 0, awaitingImporter: 0, inReview: 0, pendingResponses: 0, requests: [], activity: [] };
  });
}

export async function reissueCatalogRequest(requestId: string, userId: string) {
  await ownedRequest(requestId, userId);
  const request = await prisma.catalogRequest.findUnique({ where: { id: requestId }, include: { company: { include: { user: true } }, _count: { select: { products: true } } } });
  if (!request) throw new CatalogRequestError("REQUEST_NOT_FOUND", "Solicitação não encontrada.", 404);
  if (request.status === "cancelled") throw new CatalogRequestError("REQUEST_CANCELLED", "Não é possível gerar link para uma solicitação cancelada.", 409);
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.catalogRequest.update({ where: { id: request.id }, data: { tokenHash: hashToken(token) } });
  return { id: request.id, status: request.status, token, url: publicUrl(token), recipientName: request.recipientName, recipientEmail: request.recipientEmail, expiresAt: request.expiresAt.toISOString(), productCount: request._count.products, createdAt: request.createdAt.toISOString() };
}

export async function getPublicCatalogRequest(token: string) {
  return dto(await findByToken(token));
}

async function ownedRequest(requestId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { custbrok: { include: { companyAccesses: { select: { companyId: true } } } } } });
  if (!user?.custbrok) throw new CatalogRequestError("FORBIDDEN", "Apenas despachantes podem alterar solicitações.", 403);
  const request = await prisma.catalogRequest.findUnique({ where: { id: requestId }, include: { products: true } });
  if (!request) throw new CatalogRequestError("REQUEST_NOT_FOUND", "Solicitação não encontrada.", 404);
  if (!user.custbrok.companyAccesses.some((access) => access.companyId === request.companyId)) throw new CatalogRequestError("FORBIDDEN", "Sem acesso a esta solicitação.", 403);
  return request;
}

export async function updateCatalogRequest(requestId: string, input: UpdateCatalogRequestInput, userId: string) {
  const request = await ownedRequest(requestId, userId);
  if (["submitted", "completed", "expired", "cancelled"].includes(request.status)) {
    throw new CatalogRequestError("REQUEST_READ_ONLY", "Esta solicitação não pode mais ser editada.", 409);
  }
  if (input.expiresAt && input.expiresAt <= new Date()) throw new CatalogRequestError("INVALID_EXPIRY", "O prazo precisa estar no futuro.");
  const changes: Record<string, unknown> = {
    ...(input.recipientName !== undefined ? { recipientName: input.recipientName } : {}),
    ...(input.recipientEmail !== undefined ? { recipientEmail: input.recipientEmail } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    ...(input.message !== undefined ? { message: input.message || null } : {}),
  };
  if (input.productIds) {
    if (request.status !== "waiting") throw new CatalogRequestError("REQUEST_IN_PROGRESS", "Produtos só podem ser alterados antes do início do preenchimento.", 409);
    const productIds = [...new Set(input.productIds)];
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, importerId: request.companyId }, select: { id: true } });
    if (products.length !== productIds.length) throw new CatalogRequestError("PRODUCT_SCOPE_ERROR", "Um ou mais produtos não pertencem à empresa.", 403);
    await prisma.$transaction([
      prisma.catalogRequestProduct.deleteMany({ where: { requestId } }),
      prisma.catalogRequestProduct.createMany({ data: productIds.map((productId) => ({ requestId, productId })) }),
      prisma.catalogRequest.update({ where: { id: requestId }, data: changes }),
    ]);
  } else {
    await prisma.catalogRequest.update({ where: { id: requestId }, data: changes });
  }
  const updated = await prisma.catalogRequest.findUniqueOrThrow({ where: { id: requestId }, include: { _count: { select: { products: true } } } });
  return { id: updated.id, status: updated.status, kind: updated.kind, recipientName: updated.recipientName, recipientEmail: updated.recipientEmail, message: updated.message, expiresAt: updated.expiresAt.toISOString(), createdAt: updated.createdAt.toISOString(), productCount: updated._count.products };
}

export async function cancelCatalogRequest(requestId: string, userId: string) {
  const request = await ownedRequest(requestId, userId);
  if (["submitted", "completed", "expired", "cancelled"].includes(request.status)) {
    throw new CatalogRequestError("REQUEST_READ_ONLY", "Esta solicitação não pode ser cancelada.", 409);
  }
  const updated = await prisma.catalogRequest.update({ where: { id: request.id }, data: { status: "cancelled", completedAt: new Date() } });
  return { id: updated.id, status: updated.status };
}

export async function approveCatalogRequest(requestId: string, userId: string) {
  const owned = await ownedRequest(requestId, userId);
  if (owned.status !== "submitted") throw new CatalogRequestError("REQUEST_NOT_READY", "A solicitação ainda não foi enviada para revisão.", 409);
  const current = await prisma.catalogRequest.findUniqueOrThrow({ where: { id: requestId }, include: { responses: true, products: { include: { product: { include: { fields: true } } } } } });
  await prisma.$transaction(async (tx) => {
    const grouped = new Map<string, typeof current.responses>();
    for (const response of current.responses) {
      const list = grouped.get(response.productId) ?? [];
      list.push(response);
      grouped.set(response.productId, list);
    }
    for (const [productId, responses] of grouped) {
      const record = await tx.record.create({ data: { productId, userId, fieldResp: { create: responses.map((response) => ({ fieldId: response.fieldKey, response: response.value })) } } });
      await tx.catalogRequestResponse.updateMany({ where: { id: { in: responses.map((response) => response.id) } }, data: { status: "approved", resolvedAt: new Date() } });
      void record;
    }
    await tx.catalogRequest.update({ where: { id: requestId }, data: { status: "completed", completedAt: new Date() } });
    await recordActivity(tx, { companyId: owned.companyId, actorUserId: userId, type: "PRODUCT_APPROVED", visibility: "SHARED", entityType: "catalog_request", entityId: requestId, requestId });
    await createNotification(tx, { userId: owned.createdById, action: "Solicitação aprovada", description: "As informações foram aprovadas e aplicadas ao catálogo.", entityType: "catalog_request", entityId: requestId });
  });
  return { id: requestId, status: "completed" };
}

export async function getCatalogRequestReview(requestId: string, userId: string) {
  await ownedRequest(requestId, userId);
  const request = await prisma.catalogRequest.findUniqueOrThrow({ where: { id: requestId }, include: { responses: true, products: { include: { product: { include: { fields: true } } } } } });
  return { id: request.id, status: request.status, products: request.products.map(({ product }) => ({ id: product.id, name: product.name, sku: product.code, attributes: product.fields.map((field) => ({ key: field.id, label: field.label, value: request.responses.find((response) => response.productId === product.id && response.fieldKey === field.id)?.value ?? "", status: request.responses.find((response) => response.productId === product.id && response.fieldKey === field.id)?.status ?? "pending" })) })) };
}

export async function rejectCatalogRequest(requestId: string, note: string, userId: string) {
  const owned = await ownedRequest(requestId, userId);
  if (owned.status !== "submitted") throw new CatalogRequestError("REQUEST_NOT_READY", "A solicitação ainda não está aguardando revisão.", 409);
  const reason = note.trim();
  if (reason.length < 5) throw new CatalogRequestError("INVALID_NOTE", "Informe o motivo da recusa.", 422);
  await prisma.$transaction(async (tx) => {
    await tx.catalogRequestResponse.updateMany({ where: { requestId }, data: { status: "needs_correction", note: reason, resolvedAt: null } });
    await tx.catalogRequest.update({ where: { id: requestId }, data: { status: "in_progress", submittedAt: null } });
    await recordActivity(tx, { companyId: owned.companyId, actorUserId: userId, type: "CORRECTION_REQUESTED", visibility: "SHARED", entityType: "catalog_request", entityId: requestId, requestId, metadata: { note: reason } });
    await createNotification(tx, { userId: owned.createdById, action: "Correção solicitada", description: reason, entityType: "catalog_request", entityId: requestId });
  });
  return { id: requestId, status: "in_progress", note: reason };
}

/** Removes the request, its responses and product links, and invalidates its bearer link. */
export async function deleteCatalogRequest(requestId: string, userId: string) {
  const request = await ownedRequest(requestId, userId);
  await prisma.catalogRequest.delete({ where: { id: request.id } });
  return { id: request.id };
}

export async function startCatalogRequest(token: string) {
  const request = await findByToken(token);
  if (["submitted", "completed", "cancelled"].includes(request.status)) throw new CatalogRequestError("REQUEST_READ_ONLY", "Esta solicitação já foi encerrada.", 409);
  if (request.status === "waiting") await prisma.$transaction(async (tx) => {
    const updated = await tx.catalogRequest.updateMany({ where: { id: request.id, status: "waiting" }, data: { status: "in_progress", startedAt: new Date() } });
    if (!updated.count) return;
    await recordActivity(tx, {
      companyId: request.companyId, type: "REQUEST_STARTED", visibility: "SHARED", entityType: "catalog_request", entityId: request.id, requestId: request.id,
      metadata: { externalActorType: "IMPORTER_RECIPIENT" },
    });
    await createNotification(tx, {
      userId: request.createdById, action: "Solicitação iniciada", description: `${request.recipientName} começou o preenchimento.`, entityType: "catalog_request", entityId: request.id,
    });
  });
  return getPublicCatalogRequest(token);
}

export async function saveCatalogProduct(token: string, productId: string, input: SaveProductInput) {
  const request = await findByToken(token);
  if (!["waiting", "in_progress"].includes(request.status)) throw new CatalogRequestError("REQUEST_READ_ONLY", "Esta solicitação não aceita mais alterações.", 409);
  const entry = request.products.find((item: any) => item.product.id === productId);
  if (!entry) throw new CatalogRequestError("PRODUCT_SCOPE_ERROR", "Produto fora do escopo da solicitação.", 403);
  const fields = new Map(entry.product.fields.map((field: any) => [field.id, field]));
  const normalized: { productId: string; fieldKey: string; value: string; note?: string }[] = [];
  for (const [fieldKey, value] of Object.entries(input.attributes)) {
    const field = fields.get(fieldKey) ?? entry.product.fields.find((item: any) => item.title === fieldKey);
    if (!field) throw new CatalogRequestError("INVALID_FIELD", "Campo não permitido para este produto.");
    normalized.push({ productId, fieldKey: field.id, value: value.trim() });
  }
  await prisma.$transaction(async (tx) => {
    for (const item of normalized) {
      await tx.catalogRequestResponse.upsert({ where: { requestId_productId_fieldKey: { requestId: request.id, productId, fieldKey: item.fieldKey } }, create: { requestId: request.id, productId, fieldKey: item.fieldKey, value: item.value, status: "pending" }, update: { value: item.value, status: "pending", resolvedAt: null } });
    }
    if (request.status === "waiting") {
      const started = await tx.catalogRequest.updateMany({ where: { id: request.id, status: "waiting" }, data: { status: "in_progress", startedAt: new Date() } });
      if (started.count) {
        await recordActivity(tx, {
          companyId: request.companyId, type: "REQUEST_STARTED", visibility: "SHARED", entityType: "catalog_request", entityId: request.id, requestId: request.id,
          metadata: { externalActorType: "IMPORTER_RECIPIENT" },
        });
        await createNotification(tx, {
          userId: request.createdById, action: "Solicitação iniciada", description: `${request.recipientName} começou o preenchimento.`, entityType: "catalog_request", entityId: request.id,
        });
      }
    }
  });
  return getPublicCatalogRequest(token);
}

export async function submitCatalogRequest(token: string) {
  const request = await findByToken(token);
  if (["submitted", "completed"].includes(request.status)) return dto(request);
  if (request.status === "cancelled") throw new CatalogRequestError("REQUEST_READ_ONLY", "Esta solicitação foi cancelada.", 409);
  if (request.status === "waiting") throw new CatalogRequestError("NOT_STARTED", "Comece o preenchimento antes de enviar.");
  const current = await findByToken(token);
  const missing: unknown[] = [];
  for (const entry of current.products) {
    const mapped = mapProduct(entry.product, current.responses);
    for (const attribute of mapped.attributes) if (attribute.required && !attribute.value.trim()) missing.push({ productId: entry.product.id, fieldKey: attribute.key });
  }
  if (missing.length) throw new CatalogRequestError("VALIDATION_ERROR", "Existem campos obrigatórios pendentes.", 422, missing);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.catalogRequest.updateMany({ where: { id: current.id, status: { in: ["in_progress", "waiting"] } }, data: { status: "submitted", submittedAt: new Date() } });
    if (!result.count) return result;
    await recordActivity(tx, {
      companyId: current.companyId, type: "REQUEST_SUBMITTED", visibility: "SHARED", entityType: "catalog_request", entityId: current.id, requestId: current.id,
      metadata: { externalActorType: "IMPORTER_RECIPIENT", kind: current.kind },
    });
    if (current.kind === "correction") {
      await recordActivity(tx, {
        companyId: current.companyId, type: "CORRECTION_RESOLVED", visibility: "SHARED", entityType: "catalog_request", entityId: current.id, requestId: current.id,
      });
    }
    await createNotification(tx, {
      userId: current.createdById, action: current.kind === "correction" ? "Correção respondida" : "Solicitação enviada para revisão",
      description: `${current.recipientName} enviou informações para sua revisão.`, entityType: "catalog_request", entityId: current.id,
    });
    return result;
  });
  if (!updated.count) return dto(await findByToken(token));
  return dto(await findByToken(token));
}
