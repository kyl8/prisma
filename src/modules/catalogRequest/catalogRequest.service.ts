import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import type { CreateCatalogRequestInput, SaveProductInput } from "./catalogRequest.schemas";

export const REQUEST_STATUSES = ["waiting", "in_progress", "submitted", "completed", "expired"] as const;
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
        value,
        required: !value.trim(),
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
    return created;
  });
  return { id: request.id, status: request.status, token, url: publicUrl(token), company: { id: company.id, name: company.user.enterprise, cnpj: company.user.cnpj }, recipientName: request.recipientName, recipientEmail: request.recipientEmail, expiresAt: request.expiresAt.toISOString(), productCount: uniqueProductIds.length, createdAt: request.createdAt.toISOString() };
}

export async function listCatalogRequests(companyId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { custbrok: true } });
  if (!user?.custbrok) throw new CatalogRequestError("FORBIDDEN", "Apenas despachantes podem consultar solicitações.", 403);
  const company = await prisma.importer.findUnique({ where: { id: companyId } });
  if (!company) throw new CatalogRequestError("COMPANY_NOT_FOUND", "Empresa não encontrada.", 404);
  const requests = await prisma.catalogRequest.findMany({ where: { companyId }, include: { _count: { select: { products: true } } }, orderBy: { createdAt: "desc" } });
  return requests.map((request) => ({ id: request.id, status: request.status, kind: request.kind, recipientName: request.recipientName, recipientEmail: request.recipientEmail, expiresAt: request.expiresAt.toISOString(), createdAt: request.createdAt.toISOString(), productCount: request._count.products }));
}

export async function listCompanies(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { custbrok: true } });
  if (!user?.custbrok) throw new CatalogRequestError("FORBIDDEN", "Apenas despachantes podem consultar empresas.", 403);
  const companies = await prisma.importer.findMany({ include: { user: true, products: { include: { fields: true, records: { orderBy: { createdAt: "desc" }, include: { fieldResp: true } } } } }, orderBy: { user: { enterprise: "asc" } } });
  return companies.map((company) => ({
    id: company.id,
    name: company.user.enterprise,
    cnpj: company.user.cnpj,
    contactName: company.user.name,
    contactEmail: company.user.email,
    products: company.products.map((product) => mapProduct(product)),
  }));
}

export async function reissueCatalogRequest(requestId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { custbrok: true } });
  if (!user?.custbrok) throw new CatalogRequestError("FORBIDDEN", "Apenas despachantes podem gerar links.", 403);
  const request = await prisma.catalogRequest.findUnique({ where: { id: requestId }, include: { company: { include: { user: true } }, _count: { select: { products: true } } } });
  if (!request) throw new CatalogRequestError("REQUEST_NOT_FOUND", "Solicitação não encontrada.", 404);
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.catalogRequest.update({ where: { id: request.id }, data: { tokenHash: hashToken(token) } });
  return { id: request.id, status: request.status, token, url: publicUrl(token), recipientName: request.recipientName, recipientEmail: request.recipientEmail, expiresAt: request.expiresAt.toISOString(), productCount: request._count.products, createdAt: request.createdAt.toISOString() };
}

export async function getPublicCatalogRequest(token: string) {
  return dto(await findByToken(token));
}

export async function startCatalogRequest(token: string) {
  const request = await findByToken(token);
  if (request.status === "submitted" || request.status === "completed") throw new CatalogRequestError("REQUEST_READ_ONLY", "Esta solicitação já foi enviada para revisão.", 409);
  if (request.status === "waiting") await prisma.catalogRequest.updateMany({ where: { id: request.id, status: "waiting" }, data: { status: "in_progress", startedAt: new Date() } });
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
    if (request.status === "waiting") await tx.catalogRequest.updateMany({ where: { id: request.id, status: "waiting" }, data: { status: "in_progress", startedAt: new Date() } });
  });
  return getPublicCatalogRequest(token);
}

export async function submitCatalogRequest(token: string) {
  const request = await findByToken(token);
  if (request.status === "submitted" || request.status === "completed") return dto(request);
  if (request.status === "waiting") throw new CatalogRequestError("NOT_STARTED", "Comece o preenchimento antes de enviar.");
  const current = await findByToken(token);
  const missing: unknown[] = [];
  for (const entry of current.products) {
    const mapped = mapProduct(entry.product, current.responses);
    for (const attribute of mapped.attributes) if (attribute.required && !attribute.value.trim()) missing.push({ productId: entry.product.id, fieldKey: attribute.key });
  }
  if (missing.length) throw new CatalogRequestError("VALIDATION_ERROR", "Existem campos obrigatórios pendentes.", 422, missing);
  const updated = await prisma.catalogRequest.updateMany({ where: { id: current.id, status: { in: ["in_progress", "waiting"] } }, data: { status: "submitted", submittedAt: new Date() } });
  if (!updated.count) return dto(await findByToken(token));
  return dto(await findByToken(token));
}
