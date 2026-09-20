import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

interface SeedNotification {
  action: string;
  description: string;
}

interface SeedUser {
  email: string;
  name: string;
  password: string;
  cnpj: string;
  enterprise: string;
  notification?: SeedNotification;
}

interface SeedBroker extends SeedUser {
  specialty: string;
}

interface SeedField {
  title: string;
  label: string;
  type: string;
}

interface SeedRecord {
  createdBy: string; // e-mail do usuário que criou o registro
  createdAt: string;
  responses: Record<string, string>; // title do campo -> resposta
}

interface SeedProduct {
  name: string;
  code: string;
  ncm: string;
  completeness: string;
  status: string;
  identifierStatus: boolean;
  updatedAt: string;
  identifier?: { duimpId: string };
  fields: SeedField[];
  records: SeedRecord[];
}

interface SeedEnterprise extends SeedUser {
  products: SeedProduct[];
}

async function readJson(filename: string) {
  const filePath = path.join(__dirname, "seed", filename);
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
}

// e-mail -> id do usuário criado (usado para vincular os registros)
const userIdByEmail = new Map<string, string>();

async function createUser(data: SeedUser) {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      password: hashedPassword,
      cnpj: data.cnpj,
      enterprise: data.enterprise,
    },
  });
  userIdByEmail.set(user.email, user.id);

  // Notification.userId é @unique: no máximo uma notificação por usuário
  if (data.notification) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        action: data.notification.action,
        description: data.notification.description,
      },
    });
  }

  return user;
}

async function main() {
  console.log("🌱 Iniciando o seed...");

  // Despachantes primeiro, pois podem ser autores de registros dos produtos
  const brokers: SeedBroker[] = await readJson("customsbrokers.json");
  for (const broker of brokers) {
    const user = await createUser(broker);
    await prisma.customsbroker.create({
      data: {
        userId: user.id,
        specialty: broker.specialty,
      },
    });
  }
  console.log(`✅ ${brokers.length} despachantes criados.`);

  const enterprises: SeedEnterprise[] = await readJson("enterprises.json");
  let productsCount = 0;
  let recordsCount = 0;

  for (const enterprise of enterprises) {
    const user = await createUser(enterprise);
    const importer = await prisma.importer.create({
      data: { userId: user.id },
    });

    for (const p of enterprise.products) {
      const product = await prisma.product.create({
        data: {
          importerId: importer.id,
          name: p.name,
          code: p.code,
          ncm: p.ncm,
          completeness: p.completeness,
          status: p.status,
          identifierStatus: p.identifierStatus,
          updatedAt: new Date(p.updatedAt),
          fields: { create: p.fields },
          ...(p.identifier && {
            identifier: { create: { duimpId: p.identifier.duimpId } },
          }),
        },
        include: { fields: true },
      });
      productsCount++;

      // title do campo -> id do campo
      const fieldIdByTitle = new Map(product.fields.map((f) => [f.title, f.id]));

      for (const r of p.records) {
        const authorId = userIdByEmail.get(r.createdBy);
        if (!authorId) {
          throw new Error(
            `Usuário "${r.createdBy}" (registro do produto ${p.code}) não encontrado nos seeds.`
          );
        }

        await prisma.record.create({
          data: {
            productId: product.id,
            userId: authorId,
            createdAt: new Date(r.createdAt),
            fieldResp: {
              create: Object.entries(r.responses).map(([title, response]) => {
                const fieldId = fieldIdByTitle.get(title);
                if (!fieldId) {
                  throw new Error(
                    `Campo "${title}" não existe no produto ${p.code}.`
                  );
                }
                return { fieldId, response };
              }),
            },
          },
        });
        recordsCount++;
      }
    }
  }

  console.log(`✅ ${enterprises.length} importadores criados.`);
  console.log(`✅ ${productsCount} produtos criados.`);
  console.log(`✅ ${recordsCount} registros criados.`);
  console.log("🌳 Seed finalizado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });