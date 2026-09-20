import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const brokerEmail = "carlos.menezes@portoseguro-despachos.com.br";
const importerEmail = "teste.importador@prisma.local";

async function main() {
  const broker = await prisma.user.findUnique({ where: { email: brokerEmail }, include: { custbrok: true } });
  if (!broker?.custbrok) throw new Error(`Despachante ${brokerEmail} não encontrado. Execute o seed base primeiro.`);
  const password = await bcrypt.hash("Importador@123", 10);
  const user = await prisma.user.upsert({ where: { email: importerEmail }, update: { name: "Mariana Teste", enterprise: "AutoPeças Global Importação S.A.", cnpj: "44.555.666/0001-81", password }, create: { email: importerEmail, name: "Mariana Teste", enterprise: "AutoPeças Global Importação S.A.", cnpj: "44.555.666/0001-81", password } });
  const company = await prisma.importer.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  await prisma.customsBrokerCompanyAccess.upsert({ where: { customsBrokerId_companyId: { customsBrokerId: broker.custbrok.id, companyId: company.id } }, update: {}, create: { customsBrokerId: broker.custbrok.id, companyId: company.id } });
  const productData = [
    { name: "Motor Elétrico Teste XP-200", code: "TEST-MTR-001", ncm: "8501.10.19", status: "Ativo", completeness: "50%", fields: [{ title: "material", label: "Material", type: "text" }, { title: "potencia", label: "Potência nominal", type: "number" }, { title: "aplicacao", label: "Aplicação", type: "text" }] },
    { name: "Sensor Industrial Teste A12", code: "TEST-SNS-001", ncm: "9031.80.99", status: "Ativo", completeness: "100%", fields: [{ title: "material", label: "Material", type: "text" }, { title: "aplicacao", label: "Aplicação", type: "text" }] },
    { name: "Válvula Hidráulica Teste V40", code: "TEST-VLV-001", ncm: "8481.20.90", status: "Ativo", completeness: "0%", fields: [{ title: "material", label: "Material", type: "text" }, { title: "pressao", label: "Pressão de trabalho", type: "number" }, { title: "aplicacao", label: "Aplicação", type: "text" }] },
  ];
  for (const item of productData) {
    const product = await prisma.product.upsert({ where: { name: item.name }, update: { importerId: company.id, code: item.code, ncm: item.ncm, status: item.status, completeness: item.completeness }, create: { importerId: company.id, name: item.name, code: item.code, ncm: item.ncm, status: item.status, completeness: item.completeness, updatedAt: new Date(), fields: { create: item.fields } }, include: { fields: true } });
    for (const field of item.fields) await prisma.productField.updateMany({ where: { productId: product.id, title: field.title }, data: { label: field.label, type: field.type } });
  }
  const first = await prisma.product.findFirst({ where: { importerId: company.id }, orderBy: { createdAt: "asc" } });
  if (first) await prisma.activityEvent.create({ data: { companyId: company.id, actorUserId: broker.id, type: "PRODUCT_UPDATED", visibility: "SHARED", productId: first.id, entityType: "product", entityId: first.id, metadata: { source: "test-company-seed" } } });
  const product = await prisma.product.findUniqueOrThrow({ where: { name: "Válvula Hidráulica Teste V40" } });
  const rawToken = `teste-${crypto.randomBytes(18).toString("hex")}`;
  const request = await prisma.catalogRequest.create({ data: { tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"), companyId: company.id, createdById: broker.id, recipientName: user.name ?? "Mariana Teste", recipientEmail: user.email, status: "waiting", kind: "fill", message: "Preencha os atributos do produto de teste.", expiresAt: new Date(Date.now() + 14 * 86400000), products: { create: [{ productId: product.id }] } } });
  console.log(JSON.stringify({ companyId: company.id, importerEmail, importerPassword: "Importador@123", enterprise: user.enterprise, cnpj: user.cnpj, productId: product.id, requestId: request.id, requestToken: rawToken, requestUrl: `http://localhost:5173/r/${rawToken}/catalogo` }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
