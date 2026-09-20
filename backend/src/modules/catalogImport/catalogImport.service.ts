import type { PrismaClient } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { recordActivity } from "@/modules/activity/activity.service";
import type { ImportCatalogInput } from "./catalogImport.schemas";

export class CatalogImportError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

type ImportClient = Pick<PrismaClient, "importer" | "product" | "productField" | "record" | "activityEvent" | "catalogRequest" | "$transaction">;

function cleanFields(fields: ImportCatalogInput["rows"][number]["fields"]) {
  const unique = new Map<string, typeof fields[number]>();
  for (const field of fields) {
    const key = field.key.trim().toLowerCase();
    if (!unique.has(key)) unique.set(key, { ...field, key: field.key.trim(), label: field.label.trim() });
  }
  return [...unique.values()];
}

function completeness(fields: ReturnType<typeof cleanFields>) {
  if (!fields.length) return "0%";
  const filled = fields.filter((field) => field.value.trim()).length;
  return `${Math.round((filled / fields.length) * 100)}%`;
}

async function assertBrokerCompany(userId: string, companyId: string) {
  const broker = await prisma.customsbroker.findUnique({ where: { userId }, include: { companyAccesses: { select: { companyId: true } } } });
  if (!broker) throw new CatalogImportError("FORBIDDEN", "Apenas despachantes podem importar catálogos.", 403);
  if (!broker.companyAccesses.some((access) => access.companyId === companyId)) throw new CatalogImportError("FORBIDDEN", "Você não possui acesso a esta empresa.", 403);
  const company = await prisma.importer.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) throw new CatalogImportError("COMPANY_NOT_FOUND", "Empresa não encontrada.", 404);
}

export async function importCatalog(input: ImportCatalogInput, userId: string) {
  await assertBrokerCompany(userId, input.companyId);
  const seenCodes = new Set<string>();
  for (const row of input.rows) {
    if (seenCodes.has(row.code)) throw new CatalogImportError("DUPLICATE_CODE", `O código ${row.code} aparece mais de uma vez na planilha.`);
    seenCodes.add(row.code);
  }

  return prisma.$transaction(async (tx) => {
    const client = tx as unknown as ImportClient;
    const imported: { id: string; name: string; code: string; created: boolean }[] = [];
    for (const row of input.rows) {
      const fields = cleanFields(row.fields);
      const existing = await tx.product.findFirst({ where: { importerId: input.companyId, code: row.code }, include: { fields: true } });
      let product;
      if (existing) {
        product = await tx.product.update({ where: { id: existing.id }, data: { name: row.name, ncm: row.ncm, completeness: completeness(fields), status: "Ativo", updatedAt: new Date() } });
      } else {
        const conflicting = await tx.product.findFirst({ where: { code: row.code }, select: { importerId: true, code: true, ncm: true } });
        if (conflicting) throw new CatalogImportError("PRODUCT_CONFLICT", `O código ${row.code} já pertence a outro catálogo.`, 409);
        product = await tx.product.create({ data: { importerId: input.companyId, name: row.name, code: row.code, ncm: row.ncm, completeness: completeness(fields), status: "Ativo", updatedAt: new Date() } });
      }
      const currentFields = existing?.fields ?? [];
      const fieldIds: { fieldId: string; value: string }[] = [];
      for (const field of fields) {
        const current = currentFields.find((item) => item.title === field.key || item.label === field.label);
        const saved = current
          ? await tx.productField.update({ where: { id: current.id }, data: { title: field.key, label: field.label, type: field.type, required: !field.value.trim() } })
          : await tx.productField.create({ data: { productId: product.id, title: field.key, label: field.label, type: field.type, required: !field.value.trim() } });
        if (field.value.trim()) fieldIds.push({ fieldId: saved.id, value: field.value.trim() });
      }
      if (fieldIds.length) await tx.record.create({ data: { productId: product.id, userId, fieldResp: { create: fieldIds.map(({ fieldId, value }) => ({ fieldId, response: value })) } } });
      await recordActivity(client, { companyId: input.companyId, actorUserId: userId, type: "CATALOG_IMPORTED", visibility: "SHARED", entityType: "PRODUCT", entityId: product.id, productId: product.id, metadata: { source: "spreadsheet", operation: existing ? "updated" : "created" } });
      imported.push({ id: product.id, name: product.name, code: product.code, created: !existing });
    }
    return { imported, total: imported.length, created: imported.filter((item) => item.created).length, updated: imported.filter((item) => !item.created).length };
  });
}
