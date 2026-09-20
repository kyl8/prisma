import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const ADMIN_EMAIL = "admin@prisma.local";
const ADMIN_PASSWORD = "Prisma@123";
const JUDGE_EMAIL = "banca@prisma.local";
const JUDGE_PASSWORD = "Banca@123";
const JUDGE_BROKER_EMAIL = "banca.despachante@prisma.local";
const JUDGE_BROKER_PASSWORD = "Banca@123";

async function main() {
  const password = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: "Administrador PRISMA", enterprise: "PRISMA Tecnologia", cnpj: "00.000.000/0001-00", password },
    create: { email: ADMIN_EMAIL, name: "Administrador PRISMA", enterprise: "PRISMA Tecnologia", cnpj: "00.000.000/0001-00", password },
  });
  const adminBroker = await prisma.customsbroker.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id, specialty: "Administrador da plataforma" } });
  const companies = await prisma.importer.findMany({ select: { id: true } });
  for (const company of companies) {
    await prisma.customsBrokerCompanyAccess.upsert({ where: { customsBrokerId_companyId: { customsBrokerId: adminBroker.id, companyId: company.id } }, update: {}, create: { customsBrokerId: adminBroker.id, companyId: company.id } });
  }

  const judgeBrokerPassword = await bcrypt.hash(JUDGE_BROKER_PASSWORD, 10);
  const judgeBrokerUser = await prisma.user.upsert({
    where: { email: JUDGE_BROKER_EMAIL },
    update: { name: "Banca Hackathon — Despachante", enterprise: "PRISMA Demo Despachos", cnpj: "88.888.888/0001-88", password: judgeBrokerPassword },
    create: { email: JUDGE_BROKER_EMAIL, name: "Banca Hackathon — Despachante", enterprise: "PRISMA Demo Despachos", cnpj: "88.888.888/0001-88", password: judgeBrokerPassword },
  });
  const judgeBroker = await prisma.customsbroker.upsert({ where: { userId: judgeBrokerUser.id }, update: {}, create: { userId: judgeBrokerUser.id, specialty: "Despachante para avaliação" } });
  for (const company of companies) {
    await prisma.customsBrokerCompanyAccess.upsert({ where: { customsBrokerId_companyId: { customsBrokerId: judgeBroker.id, companyId: company.id } }, update: {}, create: { customsBrokerId: judgeBroker.id, companyId: company.id } });
  }

  const judgePassword = await bcrypt.hash(JUDGE_PASSWORD, 10);
  const judge = await prisma.user.upsert({
    where: { email: JUDGE_EMAIL },
    update: { name: "Banca Hackathon", enterprise: "PRISMA Demo Importações", cnpj: "99.999.999/0001-99", password: judgePassword },
    create: { email: JUDGE_EMAIL, name: "Banca Hackathon", enterprise: "PRISMA Demo Importações", cnpj: "99.999.999/0001-99", password: judgePassword },
  });
  const judgeImporter = await prisma.importer.upsert({ where: { userId: judge.id }, update: {}, create: { userId: judge.id } });
  await prisma.customsBrokerCompanyAccess.upsert({ where: { customsBrokerId_companyId: { customsBrokerId: adminBroker.id, companyId: judgeImporter.id } }, update: {}, create: { customsBrokerId: adminBroker.id, companyId: judgeImporter.id } });

  const products = [
    { name: "Produto Demo com pendência", code: "DEMO-PEN-001", ncm: "8501.10.19", status: "Ativo", completeness: "40%", fields: [{ title: "material", label: "Material", type: "text", required: true }, { title: "potencia", label: "Potência nominal", type: "number", required: true }, { title: "aplicacao", label: "Aplicação", type: "text", required: false }] },
    { name: "Produto Demo em revisão", code: "DEMO-REV-001", ncm: "9031.80.99", status: "Em análise", completeness: "100%", fields: [{ title: "fabricante", label: "Fabricante", type: "text", required: true }, { title: "modelo", label: "Modelo", type: "text", required: true }] },
    { name: "Produto Demo aprovado", code: "DEMO-APR-001", ncm: "8481.20.90", status: "approved", completeness: "100%", fields: [{ title: "material", label: "Material", type: "text", required: true }, { title: "pressao", label: "Pressão de trabalho", type: "number", required: true }] },
  ];

  const saved: { id: string; fieldId: string }[] = [];
  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { name: item.name },
      update: { importerId: judgeImporter.id, code: item.code, ncm: item.ncm, status: item.status, completeness: item.completeness, updatedAt: new Date() },
      create: { importerId: judgeImporter.id, name: item.name, code: item.code, ncm: item.ncm, status: item.status, completeness: item.completeness, updatedAt: new Date(), fields: { create: item.fields } },
      include: { fields: true },
    });
    for (const field of item.fields) await prisma.productField.updateMany({ where: { productId: product.id, title: field.title }, data: { label: field.label, type: field.type, required: field.required } });
    const firstField = product.fields[0];
    if (firstField) saved.push({ id: product.id, fieldId: firstField.id });
  }

  const correctionProduct = saved[0];
  const requestToken = `demo-${crypto.randomBytes(24).toString("hex")}`;
  const existingCorrection = await prisma.catalogRequest.findFirst({ where: { companyId: judgeImporter.id, kind: "correction", status: "in_progress" } });
  const request = existingCorrection ?? await prisma.catalogRequest.create({
    data: { tokenHash: crypto.createHash("sha256").update(requestToken).digest("hex"), companyId: judgeImporter.id, createdById: admin.id, recipientName: judge.name ?? "Banca Hackathon", recipientEmail: judge.email, status: "in_progress", kind: "correction", message: "Revise os dados destacados e envie novamente para revisão.", expiresAt: new Date(Date.now() + 30 * 86400000), products: { create: [{ productId: correctionProduct.id }] }, responses: { create: [{ productId: correctionProduct.id, fieldKey: correctionProduct.fieldId, value: "", status: "needs_correction", note: "Informe o material comercial do produto." }] } },
  });

  const fillToken = "prisma-demo-importer-link-2026-portal";
  const fillTokenHash = crypto.createHash("sha256").update(fillToken).digest("hex");
  const existingFill = await prisma.catalogRequest.findFirst({ where: { tokenHash: fillTokenHash } });
  const fillRequest = existingFill ?? await prisma.catalogRequest.create({
    data: {
      tokenHash: fillTokenHash,
      companyId: judgeImporter.id,
      createdById: admin.id,
      recipientName: judge.name ?? "Banca Hackathon",
      recipientEmail: judge.email,
      status: "waiting",
      kind: "fill",
      message: "Link de demonstração: preencha os dados e envie para revisão.",
      expiresAt: new Date(Date.now() + 30 * 86400000),
      products: { create: [{ productId: saved[0].id }, { productId: saved[1].id }] },
    },
  });

  await prisma.notification.deleteMany({ where: { userId: judge.id } });
  await prisma.notification.createMany({ data: [
    { userId: judge.id, action: "Correção solicitada", description: "O despachante solicitou uma correção em Produto Demo com pendência.", entityType: "product", entityId: correctionProduct.id },
    { userId: judge.id, action: "Produto aprovado", description: "Produto Demo aprovado foi aprovado pelo despachante.", entityType: "product", entityId: saved[2]?.id },
    { userId: judge.id, action: "Nova solicitação de preenchimento", description: "Você recebeu um link para preencher produtos do catálogo.", entityType: "catalog_request", entityId: fillRequest.id },
  ] });
  await prisma.activityEvent.deleteMany({ where: { companyId: judgeImporter.id } });
  await prisma.activityEvent.createMany({ data: [
    { companyId: judgeImporter.id, actorUserId: admin.id, type: "CORRECTION_REQUESTED", visibility: "SHARED", productId: correctionProduct.id, entityType: "product", entityId: correctionProduct.id },
    { companyId: judgeImporter.id, actorUserId: admin.id, type: "PRODUCT_APPROVED", visibility: "SHARED", productId: saved[2]?.id, entityType: "product", entityId: saved[2]?.id },
    { companyId: judgeImporter.id, actorUserId: judge.id, type: "PRODUCT_UPDATED", visibility: "SHARED", productId: saved[0]?.id, entityType: "product", entityId: saved[0]?.id },
  ] });

  console.log(JSON.stringify({
    admin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    judge: { email: JUDGE_EMAIL, password: JUDGE_PASSWORD },
    judgeBroker: { email: JUDGE_BROKER_EMAIL, password: JUDGE_BROKER_PASSWORD },
    judgeCompanyId: judgeImporter.id,
    correctionRequestId: request.id,
    fillRequestId: fillRequest.id,
    fillRequestUrl: `http://localhost:5173/r/${fillToken}/catalogo`,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
