import { prisma } from "@/lib/prisma";
import { TOKEN_COSTS } from "@/lib/config/tokenCosts";

/**
 * 관리자(ADMIN) 여부 확인
 */
async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

/**
 * 토큰 잔액 조회 (관리자는 항상 무제한)
 */
export async function getBalance(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, role: true },
  });
  if (user?.role === "ADMIN") return -1;
  return user?.credits ?? 0;
}

/**
 * 기능 사용에 필요한 토큰 비용 조회
 */
export function getCost(feature: string): number {
  return TOKEN_COSTS[feature] ?? 0;
}

/**
 * 잔액 확인 (충분한지 여부)
 */
export async function checkBalance(
  userId: string,
  feature: string
): Promise<{ sufficient: boolean; balance: number; cost: number }> {
  const balance = await getBalance(userId);
  const cost = getCost(feature);

  // 무제한 플랜 (credits = -1) 체크
  if (balance === -1) {
    return { sufficient: true, balance: -1, cost };
  }

  return { sufficient: balance >= cost, balance, cost };
}

/**
 * 원자적 토큰 차감 (race condition 방지)
 * 관리자(ADMIN)는 항상 무제한 — 토큰 차감 없이 통과
 * @returns true if deduction succeeded, false if insufficient balance
 */
export async function deductTokens(
  userId: string,
  feature: string,
  customCost?: number
): Promise<boolean> {
  const cost = customCost ?? getCost(feature);
  if (cost <= 0) return true;

  // 관리자 또는 무제한 유저 체크
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, role: true },
  });
  if (user?.role === "ADMIN") return true;
  if (user?.credits === -1) return true;

  // 원자적 차감: credits >= cost 조건으로 업데이트
  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      credits: { gte: cost },
    },
    data: {
      credits: { decrement: cost },
    },
  });

  // count === 0이면 잔액 부족
  return result.count > 0;
}

/**
 * 토큰 충전
 */
export async function grantTokens(
  userId: string,
  amount: number
): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      credits: { increment: amount },
    },
    select: { credits: true },
  });
  return user.credits;
}

/**
 * 월간 토큰 리셋 (구독 플랜 기준)
 */
export async function resetMonthlyTokens(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: { status: { in: ["active", "trial"] } },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user) return 0;

  const activeSub = user.subscriptions[0];
  const quota = activeSub?.plan?.tokenQuota ?? 10000; // 기본 Starter

  await prisma.user.update({
    where: { id: userId },
    data: { credits: quota },
  });

  return quota;
}
