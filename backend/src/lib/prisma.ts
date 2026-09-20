import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 10000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 10000),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});
pool.on("error", (error) => console.error("prisma_pool_error", error.message));
const adapter = new PrismaPg(pool, { onPoolError: (error) => console.error("prisma_adapter_error", error.message) });
const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export default prisma;
