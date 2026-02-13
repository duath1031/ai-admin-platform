import { prisma } from "@/lib/prisma";
import { TOKEN_COSTS } from "@/lib/config/tokenCosts";
import { payWithBillingKey } from "@/lib/billing/portoneClient";

/**
 * 초과과금 설정
 * 배치 단위로 자동충전: 100,000 토큰 = 15,000원
 */
const OVERAGE_BATCH_TOKENS = 100_000;
const OVERAGE_BATCH_PRICE = 15_000; // 원

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
 * 초과과금 자동충전 (빌링키 결제)
 * @returns 충전된 토큰 수 (0이면 실패)
 */
async function autoChargeOverage(userId: string, requiredTokens: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      overageEnabled: true,
      overageMonthlyLimit: true,
      overageSpentThisMonth: true,
      name: true,
      email: true,
    },
  });

  if (!user?.overageEnabled) return 0;

  // 월 한도 체크
  const remainingBudget = user.overageMonthlyLimit - user.overageSpentThisMonth;
  if (remainingBudget < OVERAGE_BATCH_PRICE) {
    console.log(`[Overage] 월 한도 초과: spent=${user.overageSpentThisMonth}, limit=${user.overageMonthlyLimit}`);
    return 0;
  }

  // 필요한 배치 수 계산 (최소 1배치)
  const batchesNeeded = Math.ceil(requiredTokens / OVERAGE_BATCH_TOKENS);
  const maxBatches = Math.floor(remainingBudget / OVERAGE_BATCH_PRICE);
  const batchesToCharge = Math.min(batchesNeeded, maxBatches);

  if (batchesToCharge <= 0) return 0;

  const totalTokens = batchesToCharge * OVERAGE_BATCH_TOKENS;
  const totalPrice = batchesToCharge * OVERAGE_BATCH_PRICE;

  // 빌링키 확인
  const billingKey = await prisma.billingKey.findFirst({
    where: { userId, isDefault: true, isActive: true },
  });

  if (!billingKey) {
    console.log(`[Overage] 빌링키 없음: userId=${userId}`);
    return 0;
  }

  // 주문번호 생성
  const orderId = `overage_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    // PortOne 빌링키 결제
    const payResult = await payWithBillingKey({
      paymentId: orderId,
      billingKey: billingKey.billingKey,
      orderName: `Admini 초과과금 - ${totalTokens.toLocaleString()}토큰`,
      amount: totalPrice,
      customerId: userId,
      customerName: user.name || undefined,
      customerEmail: user.email || undefined,
    });

    // 트랜잭션: 토큰 충전 + 결제 기록 + 초과과금 추적
    const now = new Date();
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    await prisma.$transaction(async (tx) => {
      // 토큰 충전
      await tx.user.update({
        where: { id: userId },
        data: {
          credits: { increment: totalTokens },
          overageSpentThisMonth: { increment: totalPrice },
        },
      });

      // 결제 기록
      await tx.payment.create({
        data: {
          userId,
          orderId,
          paymentKey: payResult.paymentId || orderId,
          amount: totalPrice,
          itemType: "overage",
          itemName: `초과과금 ${totalTokens.toLocaleString()}토큰`,
          status: "PAID",
          method: payResult.method?.type || "CARD",
          approvedAt: new Date(),
          receiptUrl: payResult.receiptUrl || null,
          impUid: payResult.paymentId || null,
        },
      });

      // 크레딧 트랜잭션 (추적용)
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: totalTokens,
          balance: 0, // 실제 잔액은 사후 확인
          type: "overage_charge",
          description: `초과과금 자동충전 ${totalTokens.toLocaleString()}토큰 (${totalPrice.toLocaleString()}원)`,
          isOverage: true,
          overageAmount: totalTokens,
          overageCharge: totalPrice,
        },
      });

      // OverageCharge 레코드 (월별 집계)
      await tx.overageCharge.upsert({
        where: { userId_billingMonth: { userId, billingMonth } },
        create: {
          userId,
          billingMonth,
          includedCredits: 0,
          usedCredits: 0,
          overageCredits: totalTokens,
          pricePerCredit: Math.round(totalPrice / totalTokens * 10000), // 만 토큰당 가격
          totalCharge: totalPrice,
          status: "charged",
        },
        update: {
          overageCredits: { increment: totalTokens },
          totalCharge: { increment: totalPrice },
        },
      });
    });

    console.log(`[Overage] 자동충전 성공: userId=${userId}, tokens=${totalTokens}, price=${totalPrice}원`);
    return totalTokens;
  } catch (error) {
    console.error(`[Overage] 결제 실패:`, error);
    return 0;
  }
}

/**
 * 원자적 토큰 차감 (race condition 방지)
 * 관리자(ADMIN)는 항상 무제한 — 토큰 차감 없이 통과
 * 잔액 부족 시 초과과금 자동충전 시도
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

  // 성공하면 바로 반환
  if (result.count > 0) return true;

  // 잔액 부족 → 초과과금 자동충전 시도
  const currentBalance = user?.credits ?? 0;
  const shortage = cost - currentBalance;

  const charged = await autoChargeOverage(userId, shortage);
  if (charged <= 0) return false;

  // 충전 후 재시도
  const retryResult = await prisma.user.updateMany({
    where: {
      id: userId,
      credits: { gte: cost },
    },
    data: {
      credits: { decrement: cost },
    },
  });

  return retryResult.count > 0;
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
 * 초과과금 누적도 함께 리셋
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
    data: {
      credits: quota,
      overageSpentThisMonth: 0, // 초과과금 누적 리셋
    },
  });

  return quota;
}
