import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import "dotenv/config";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
async function main() {
  const brokerUser = await prisma.user.findUniqueOrThrow({ where: { email: "carlos.menezes@portoseguro-despachos.com.br" }, include: { custbrok: true } });
  const user = await prisma.user.upsert({ where: { email: "teste2.importador@prisma.local" }, update: {}, create: { email: "teste2.importador@prisma.local", name: "Rafael Teste", enterprise: "Logística Horizonte Importação Ltda.", cnpj: "55.666.777/0001-22", password: await bcrypt.hash("Importador@123", 10) } });
  const company = await prisma.importer.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  await prisma.customsBrokerCompanyAccess.upsert({ where: { customsBrokerId_companyId: { customsBrokerId: brokerUser.custbrok!.id, companyId: company.id } }, update: {}, create: { customsBrokerId: brokerUser.custbrok!.id, companyId: company.id } });
  await prisma.product.upsert({ where: { name: "Bomba Centrífuga Teste B10" }, update: {}, create: { importerId: company.id, name: "Bomba Centrífuga Teste B10", code: "TEST2-BMB-001", ncm: "8413.70.90", completeness: "0%", status: "Ativo", updatedAt: new Date(), fields: { create: [{ title: "material", label: "Material", type: "text" }, { title: "vazao", label: "Vazão", type: "number" }] } } });
  console.log(JSON.stringify({ companyId: company.id, email: user.email, password: "Importador@123", enterprise: user.enterprise, cnpj: user.cnpj }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
