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

async function readJson(filename: string) {
  const filePath = path.join(__dirname, "seed", filename);
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
}

async function main() {
  console.log("🌱 Iniciando o seed...");

  const users = await readJson("users.json");
  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await prisma.user.create({ data: {
      email: user.email,
      name: user.name,
      password: user.password
    } });
  }
  console.log(`✅ ${users.length} users criados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
