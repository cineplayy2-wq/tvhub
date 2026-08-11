import { PrismaClient } from "@prisma/client";

/**
 * Singleton do Prisma.
 *
 * Em dev, o Hot Reload do Next recria os módulos a cada save. Sem o cache no
 * globalThis, cada reload abriria um novo pool de conexões até o Postgres
 * recusar novas conexões ("too many clients already").
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
