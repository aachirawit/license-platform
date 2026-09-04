import { PrismaClient } from "@prisma/client";

// A single PrismaClient per server instance. On Vercel/serverless, module state
// is reused across warm invocations, so caching on globalThis avoids opening a
// new pool on every request and exhausting Postgres connections. Use the Neon
// *pooled* DATABASE_URL in that environment.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
