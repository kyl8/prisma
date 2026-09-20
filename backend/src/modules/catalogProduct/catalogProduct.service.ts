import type { PrismaClient } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { recordActivity } from "@/modules/activity/activity.service";
import type { CreateProductInput } from "./catalogProduct.schemas";

export class CatalogProductError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

type ProductClient = Pick<PrismaClient, "customsbroker" | "importer" | "product" | "productField" | "record" | "prodFieldResp" | "identifier" | "activityEvent" | "catalogRequest" | "$transaction">;

async function assertBrokerCompany(userId: string, companyId: string) {
  const broker = await prisma.customsbroker.findUnique({ where: { userId }, include: { companyAccesses: { select: { companyId: true } } } });
  if (!broker || !broker.companyAccesses.some((access) => access.companyId === companyId)) throw new CatalogProductError("FORBIDDEN", "Você não possui acesso a este catálogo.", 403);
  const company = await prisma.importer.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) throw new CatalogProductError("COMPANY_NOT_FOUND", "Empresa não encontrada.", 404);
}

function cleanFields(fields: CreateProductInput["fields"]) {
  const unique = new Map<string, CreateProductInput["fields"][number]>();
  for (const field of fields) {
    const key = field.key.trim().toLowerCase();
    if (!unique.has(key)) unique.set(key, { ...field, key: field.key.trim(), label: field.label.trim() });
  }
  return [...unique.values()];
}

export async function createCatalogProduct(input: CreateProductInput, userId: string) {
  await assertBrokerCompany(userId, input.companyId);
  const fields = cleanFields(input.fields);
  const requiredFields = fields.filter((field) => field.required);
  const complete = requiredFields.every((field) => field.value.trim()) && fields.every((field) => !field.required || field.value.trim());
  const completeness = fields.length ? Math.round((fields.filter((field) => field.value.trim()).length / fields.length) * 100) : 0;
  const status = input.submitForReview ? "sent_for_review" : "Ativo";

  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { importerId: input.companyId, name: input.name, code: input.code, ncm: input.ncm, completeness: `${completeness}%`, status, updatedAt: new Date(), fields: { create: fields.map((field) => ({ title: field.key, label: field.label, type: field.type, required: field.required })) } }, include: { fields: true } });
      const values = product.fields.flatMap((field) => {
        const inputField = fields.find((item) => item.key.toLowerCase() === field.title.toLowerCase());
        return inputField?.value.trim() ? [{ fieldId: field.id, value: inputField.value.trim() }] : [];
      });
      if (values.length) await tx.record.create({ data: { productId: product.id, userId, fieldResp: { create: values.map(({ fieldId, value }) => ({ fieldId, response: value })) } } });
      const client = tx as unknown as ProductClient;
      await recordActivity(client, { companyId: input.companyId, actorUserId: userId, type: input.submitForReview && complete ? "PRODUCT_SUBMITTED" : "PRODUCT_UPDATED", visibility: "SHARED", entityType: "PRODUCT", entityId: product.id, productId: product.id, metadata: { operation: "created", source: "dispatcher" } });
      return { id: product.id, name: product.name, code: product.code, ncm: product.ncm, status: product.status, completeness: product.completeness };
    });
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "P2002") throw new CatalogProductError("PRODUCT_ALREADY_EXISTS", "Já existe um produto com este nome ou código.", 409);
    throw error;
  }
}

export async function deleteCatalogProduct(productId: string, userId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, importerId: true } });
  if (!product) throw new CatalogProductError("PRODUCT_NOT_FOUND", "Produto nÃ£o encontrado.", 404);
  await assertBrokerCompany(userId, product.importerId);

  await prisma.$transaction(async (tx) => {
    const fields = await tx.productField.findMany({ where: { productId }, select: { id: true } });
    const records = await tx.record.findMany({ where: { productId }, select: { id: true } });
    const fieldIds = fields.map((field) => field.id);
    const recordIds = records.map((record) => record.id);
    if (fieldIds.length || recordIds.length) {
      await tx.prodFieldResp.deleteMany({
        where: {
          OR: [
            ...(fieldIds.length ? [{ fieldId: { in: fieldIds } }] : []),
            ...(recordIds.length ? [{ recordId: { in: recordIds } }] : []),
          ],
        },
      });
    }
    await tx.record.deleteMany({ where: { productId } });
    await tx.productField.deleteMany({ where: { productId } });
    await tx.identifier.deleteMany({ where: { productId } });
    // Request links cascade with the product; activity history is retained and
    // its nullable product relation is cleared by the database.
    await tx.product.delete({ where: { id: productId } });
  });
  return { id: productId };
}
