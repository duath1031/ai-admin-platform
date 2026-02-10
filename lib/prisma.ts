import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Supabase Session mode 커넥션 풀 초과 방지: 각 인스턴스 커넥션 1개로 제한
  const url = process.env.DATABASE_URL;
  const connLimitUrl = url && !url.includes('connection_limit')
    ? `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`
    : url;

  return new PrismaClient({
    datasources: {
      db: {
        url: connLimitUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// production에서도 글로벌 캐시 사용 (Vercel serverless 커넥션 풀 관리)
globalForPrisma.prisma = prisma;

export default prisma;
