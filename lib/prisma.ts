import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

// production에서도 글로벌 캐시 사용 (Vercel serverless 커넥션 풀 관리)
globalForPrisma.prisma = prisma;

export default prisma;
