import prisma from "@/lib/prisma";
import { recordActivity } from "@/modules/activity/activity.service";
import { createNotification } from "@/modules/notification/notification.service";

export class ImporterError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

async function importerUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { importer: true } });
  if (!user) throw new ImporterError("UNAUTHORIZED", "Usuário não encontrado.", 401);
  if (!user.importer) throw new ImporterError("FORBIDDEN", "Apenas importadores podem acessar este portal.", 403);
  return user;
}

function latestValues(product: any) {
  const values = new Map<string, string>();
  for (const record of [...product.records].sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())) {
    for (const response of record.fieldResp) if (!values.has(response.fieldId)) values.set(response.fieldId, response.response);
  }
  return values;
}

function mapProduct(product: any) {
  const values = latestValues(product);
  const corrections = product.catalogRequestResponses
    .filter((response: any) => response.status === "needs_correction")
    .map((response: any) => ({
      id: response.id,
      productId: product.id,
      fieldKey: response.fieldKey,
      currentValue: values.get(response.fieldKey) ?? "",
      note: response.note ?? "",
      requestedBy: response.request?.createdBy?.name ?? "Despachante",
      requestedByTitle: "Despachante aduaneiro",
      createdAt: response.createdAt.toISOString(),
      status: "open",
    }));
  const backendStatus = String(product.status ?? "").toLowerCase();
  const status = corrections.length ? "correction_requested" : backendStatus.includes("approved") || backendStatus.includes("aprov") ? "approved" : backendStatus.includes("review") || backendStatus.includes("análise") || backendStatus.includes("analise") || backendStatus.includes("sent") ? "sent_for_review" : "needs_you";
  return {
    id: product.id, companyId: product.importerId, name: product.name, sku: product.code, ncm: product.ncm,
    completeness: product.completeness, ncmDescription: "", status, updatedAt: product.updatedAt.toISOString(), corrections,
    attributes: product.fields.map((field: any) => ({ key: field.id, label: field.label, value: values.get(field.id) ?? "", required: Boolean(field.required), group: "personalizados", note: corrections.find((item: any) => item.fieldKey === field.id)?.note })),
  };
}

const productInclude: any = {
  fields: true,
  records: { orderBy: { createdAt: "desc" }, include: { fieldResp: true } },
  catalogRequestResponses: { include: { request: { include: { createdBy: { select: { name: true } } } } } },
};

export async function getImporterProfile(userId: string) {
  const user = await importerUser(userId);
  const access = await prisma.customsBrokerCompanyAccess.findFirst({
    where: { companyId: user.importer!.id },
    orderBy: { createdAt: "desc" },
    include: { customsBroker: { include: { user: { select: { id: true, name: true, email: true, enterprise: true } } } } },
  });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "importer",
    company: { id: user.importer!.id, name: user.enterprise, cnpj: user.cnpj },
    dispatcher: access ? { id: access.customsBroker.user.id, name: access.customsBroker.user.name, email: access.customsBroker.user.email, company: access.customsBroker.user.enterprise } : null,
  };
}

export async function listImporterProducts(userId: string) {
  const user = await importerUser(userId);
  const products = await prisma.product.findMany({ where: { importerId: user.importer!.id }, include: productInclude, orderBy: { updatedAt: "desc" } });
  return products.map(mapProduct);
}

export async function getImporterProduct(userId: string, productId: string) {
  const user = await importerUser(userId);
  const product: any = await prisma.product.findFirst({ where: { id: productId, importerId: user.importer!.id }, include: productInclude });
  if (!product) throw new ImporterError("PRODUCT_NOT_FOUND", "Produto não encontrado.", 404);
  return mapProduct(product);
}

export async function updateImporterProduct(userId: string, productId: string, attributes: Record<string, string>, submitForReview = false) {
  const user = await importerUser(userId);
  const product: any = await prisma.product.findFirst({ where: { id: productId, importerId: user.importer!.id }, include: productInclude });
  if (!product) throw new ImporterError("PRODUCT_NOT_FOUND", "Produto não encontrado.", 404);
  const fields = new Map(product.fields.map((field: any) => [field.id, field]));
  const values = Object.entries(attributes).map(([fieldId, value]) => ({ fieldId, value: String(value ?? "").trim() })).filter(({ fieldId }) => fields.has(fieldId));
  const completeness = product.fields.length ? Math.round(values.filter(({ value }) => value).length / product.fields.length * 100) : 0;
  const status = submitForReview ? "sent_for_review" : "Ativo";
  await prisma.$transaction(async (tx) => {
    if (values.length) await tx.record.create({ data: { productId, userId, fieldResp: { create: values.map(({ fieldId, value }) => ({ fieldId, response: value })) } } });
    await tx.product.update({ where: { id: productId }, data: { completeness: `${completeness}%`, status, updatedAt: new Date() } });
    if (submitForReview) {
      await tx.catalogRequestResponse.updateMany({ where: { productId, status: "needs_correction" }, data: { status: "pending", resolvedAt: null } });
      await recordActivity(tx as any, { companyId: user.importer!.id, actorUserId: userId, type: "PRODUCT_SUBMITTED", visibility: "SHARED", entityType: "PRODUCT", entityId: productId, productId });
      const request = await tx.catalogRequest.findFirst({ where: { products: { some: { productId } }, status: { in: ["in_progress", "submitted"] } }, orderBy: { createdAt: "desc" } });
      if (request) await createNotification(tx, { userId: request.createdById, action: "Produto enviado para revisão", description: `${product.name} foi enviado para revisão.`, entityType: "product", entityId: productId });
    } else {
      await recordActivity(tx as any, { companyId: user.importer!.id, actorUserId: userId, type: "PRODUCT_UPDATED", visibility: "SHARED", entityType: "PRODUCT", entityId: productId, productId });
    }
  });
  return getImporterProduct(userId, productId);
}
