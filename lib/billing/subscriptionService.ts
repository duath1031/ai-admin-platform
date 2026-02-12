/**
 * 구독 관리 서비스
 * 구독 생성, 갱신, 해지, 플랜 변경
 */

import { prisma } from "@/lib/prisma";
import { payWithBillingKey } from "./portoneClient";

/** 주문번호 생성 */
function generateOrderId(prefix: string = "sub") {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

/** 다음 결제일 계산 (1개월 후) */
function getNextBillingDate(from: Date = new Date()): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  return next;
}

/** 유예기간 종료일 (3일 후) */
function getGracePeriodEnd(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + 3);
  return end;
}

/** 무료체험 종료일 (1일 후) */
function getTrialEndDate(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + 1);
  return end;
}

/**
 * 신규 구독 생성 (빌링키 등록 + 첫 결제 또는 무료체험)
 */
export async function createSubscription(params: {
  userId: string;
  planCode: string;
  billingKeyId: string;
  withTrial?: boolean;
}) {
  const { userId, planCode, billingKeyId, withTrial } = params;

  // 플랜 조회
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { planCode },
  });
  if (!plan) throw new Error(`플랜을 찾을 수 없습니다: ${planCode}`);

  // 기존 활성 구독 확인
  const existingSub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trial"] },
    },
  });
  if (existingSub) {
    throw new Error("이미 활성 구독이 있습니다. 먼저 해지하거나 플랜을 변경해주세요.");
  }

  const now = new Date();

  // 무료체험 모드
  if (withTrial) {
    const trialEnd = getTrialEndDate(now);

    const subscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          billingKeyId,
          status: "trial",
          startDate: now,
          trialEndsAt: trialEnd,
          nextBillingDate: trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          billingCycle: "monthly",
        },
        include: { plan: true },
      });

      // 토큰 충전 (Pro 기능 체험)
      await tx.user.update({
        where: { id: userId },
        data: { credits: plan.tokenQuota },
      });

      return sub;
    });

    return subscription;
  }

  // 즉시 결제 모드
  const billingKey = await prisma.billingKey.findUnique({
    where: { id: billingKeyId },
  });
  if (!billingKey) throw new Error("빌링키를 찾을 수 없습니다.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const orderId = generateOrderId();
  const nextBilling = getNextBillingDate(now);

  // PortOne 빌링키 결제
  const payResult = await payWithBillingKey({
    paymentId: orderId,
    billingKey: billingKey.billingKey,
    orderName: `Admini ${plan.displayName} 구독`,
    amount: plan.price,
    customerId: userId,
    customerName: user?.name || undefined,
    customerEmail: user?.email || undefined,
  });

  // 트랜잭션: 구독 + 결제 + 토큰 충전
  const subscription = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        billingKeyId,
        status: "active",
        startDate: now,
        nextBillingDate: nextBilling,
        currentPeriodStart: now,
        currentPeriodEnd: nextBilling,
        billingCycle: "monthly",
      },
      include: { plan: true },
    });

    // 결제 기록
    await tx.payment.create({
      data: {
        userId,
        subscriptionId: sub.id,
        orderId,
        paymentKey: payResult.paymentId || orderId,
        amount: plan.price,
        itemType: "subscription",
        itemName: `Admini ${plan.displayName} 구독`,
        status: "PAID",
        method: payResult.method?.type || "CARD",
        approvedAt: new Date(),
        receiptUrl: payResult.receiptUrl || null,
        impUid: payResult.paymentId || null,
      },
    });

    // 토큰 충전
    await tx.user.update({
      where: { id: userId },
      data: { credits: plan.tokenQuota },
    });

    // 다음 자동결제 스케줄
    await tx.scheduledPayment.create({
      data: {
        subscriptionId: sub.id,
        scheduledDate: nextBilling,
        amount: plan.price,
        status: "pending",
      },
    });

    // 크레딧 트랜잭션 기록
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: plan.tokenQuota,
        balance: plan.tokenQuota,
        type: "subscription_grant",
        description: `${plan.displayName} 구독 시작 - ${plan.tokenQuota.toLocaleString()} 토큰 충전`,
      },
    });

    return sub;
  });

  return subscription;
}

/**
 * 구독 갱신 (자동결제 처리)
 */
export async function renewSubscription(subscriptionId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, billingKey: true, user: true },
  });

  if (!sub || !sub.billingKey) {
    throw new Error("구독 또는 빌링키를 찾을 수 없습니다.");
  }

  const orderId = generateOrderId("renew");
  const now = new Date();
  const nextBilling = getNextBillingDate(now);

  try {
    const payResult = await payWithBillingKey({
      paymentId: orderId,
      billingKey: sub.billingKey.billingKey,
      orderName: `Admini ${sub.plan.displayName} 구독 갱신`,
      amount: sub.plan.price,
      customerId: sub.userId,
      customerName: sub.user?.name || undefined,
      customerEmail: sub.user?.email || undefined,
    });

    // 성공: 구독 갱신 + 토큰 리셋
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "active",
          nextBillingDate: nextBilling,
          currentPeriodStart: now,
          currentPeriodEnd: nextBilling,
          retryCount: 0,
          gracePeriodEndsAt: null,
        },
      });

      await tx.payment.create({
        data: {
          userId: sub.userId,
          subscriptionId: sub.id,
          orderId,
          paymentKey: payResult.paymentId || orderId,
          amount: sub.plan.price,
          itemType: "subscription_renewal",
          itemName: `Admini ${sub.plan.displayName} 구독 갱신`,
          status: "PAID",
          method: payResult.method?.type || "CARD",
          approvedAt: new Date(),
          receiptUrl: payResult.receiptUrl || null,
          impUid: payResult.paymentId || null,
        },
      });

      // 토큰 리셋 (월간 할당)
      await tx.user.update({
        where: { id: sub.userId },
        data: { credits: sub.plan.tokenQuota },
      });

      await tx.creditTransaction.create({
        data: {
          userId: sub.userId,
          amount: sub.plan.tokenQuota,
          balance: sub.plan.tokenQuota,
          type: "subscription_renewal",
          description: `${sub.plan.displayName} 구독 갱신 - 토큰 리셋`,
        },
      });

      // 다음 자동결제 스케줄
      await tx.scheduledPayment.create({
        data: {
          subscriptionId: sub.id,
          scheduledDate: nextBilling,
          amount: sub.plan.price,
          status: "pending",
        },
      });
    });

    return { success: true, nextBillingDate: nextBilling };
  } catch (error) {
    // 결제 실패: 유예기간 또는 재시도
    const newRetryCount = (sub.retryCount || 0) + 1;
    const maxRetries = 3;

    if (newRetryCount >= maxRetries) {
      // 최대 재시도 초과 → 유예기간 (3일)
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "grace",
          retryCount: newRetryCount,
          gracePeriodEndsAt: getGracePeriodEnd(),
        },
      });
    } else {
      // 재시도 대기
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "past_due",
          retryCount: newRetryCount,
        },
      });
    }

    console.error(`[Subscription Renew] 결제 실패 (${newRetryCount}/${maxRetries}):`, error);
    return { success: false, retryCount: newRetryCount, error: String(error) };
  }
}

/**
 * 구독 해지
 */
export async function cancelSubscription(
  userId: string,
  subscriptionId: string,
  reason?: string
) {
  const sub = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
      status: { in: ["active", "trial", "past_due", "grace"] },
    },
    include: { plan: true },
  });

  if (!sub) {
    throw new Error("활성 구독을 찾을 수 없습니다.");
  }

  await prisma.$transaction(async (tx) => {
    // 구독 해지 (현재 기간 끝까지는 사용 가능)
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        // endDate를 현재 기간 종료일로 설정 (즉시 해지가 아닌 기간 만료 해지)
        endDate: sub.currentPeriodEnd || new Date(),
      },
    });

    // 예정된 자동결제 취소
    await tx.scheduledPayment.updateMany({
      where: {
        subscriptionId,
        status: "pending",
      },
      data: { status: "cancelled" },
    });
  });

  return {
    success: true,
    message: sub.currentPeriodEnd
      ? `구독이 해지되었습니다. ${sub.currentPeriodEnd.toLocaleDateString("ko-KR")}까지 서비스를 이용하실 수 있습니다.`
      : "구독이 해지되었습니다.",
    endDate: sub.currentPeriodEnd,
  };
}

/**
 * 플랜 변경 (업그레이드/다운그레이드)
 */
export async function changePlan(params: {
  userId: string;
  subscriptionId: string;
  newPlanCode: string;
}) {
  const { userId, subscriptionId, newPlanCode } = params;

  const [sub, newPlan] = await Promise.all([
    prisma.subscription.findFirst({
      where: { id: subscriptionId, userId, status: { in: ["active", "trial"] } },
      include: { plan: true, billingKey: true },
    }),
    prisma.subscriptionPlan.findUnique({ where: { planCode: newPlanCode } }),
  ]);

  if (!sub) throw new Error("활성 구독을 찾을 수 없습니다.");
  if (!newPlan) throw new Error(`플랜을 찾을 수 없습니다: ${newPlanCode}`);
  if (sub.plan.planCode === newPlanCode) throw new Error("현재 플랜과 동일합니다.");

  const isUpgrade = newPlan.price > sub.plan.price;

  // 업그레이드: 즉시 차액 결제 + 플랜 변경
  if (isUpgrade && sub.billingKey && newPlan.price > 0) {
    const priceDiff = newPlan.price - sub.plan.price;
    const orderId = generateOrderId("upgrade");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    await payWithBillingKey({
      paymentId: orderId,
      billingKey: sub.billingKey.billingKey,
      orderName: `Admini ${newPlan.displayName} 업그레이드 차액`,
      amount: priceDiff,
      customerId: userId,
      customerName: user?.name || undefined,
      customerEmail: user?.email || undefined,
    });

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { planId: newPlan.id },
      });

      await tx.payment.create({
        data: {
          userId,
          subscriptionId,
          orderId,
          amount: priceDiff,
          itemType: "plan_upgrade",
          itemName: `${sub.plan.displayName} → ${newPlan.displayName} 업그레이드`,
          status: "PAID",
          approvedAt: new Date(),
        },
      });

      // 토큰 차이만큼 추가 충전
      const tokenDiff = newPlan.tokenQuota - sub.plan.tokenQuota;
      if (tokenDiff > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { credits: { increment: tokenDiff } },
        });
      }
    });
  } else {
    // 다운그레이드: 다음 결제일부터 적용
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { planId: newPlan.id },
    });
  }

  return {
    success: true,
    message: isUpgrade
      ? `${newPlan.displayName} 플랜으로 업그레이드되었습니다.`
      : `다음 결제일부터 ${newPlan.displayName} 플랜이 적용됩니다.`,
    plan: newPlan,
  };
}

/**
 * 활성 구독 조회
 */
export async function getActiveSubscription(userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trial", "past_due", "grace", "cancelled"] },
    },
    include: { plan: true, billingKey: true },
    orderBy: { createdAt: "desc" },
  });

  if (!sub) return null;

  // cancelled인데 endDate가 지나면 expired로 변경
  if (sub.status === "cancelled" && sub.endDate && sub.endDate < new Date()) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "expired" },
    });
    return null;
  }

  // grace인데 유예기간 지나면 expired
  if (sub.status === "grace" && sub.gracePeriodEndsAt && sub.gracePeriodEndsAt < new Date()) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "expired" },
    });
    return null;
  }

  // trial인데 체험기간 지나면 처리
  if (sub.status === "trial" && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
    // 빌링키 있으면 자동 결제 시도, 없으면 expired
    if (sub.billingKeyId) {
      const result = await renewSubscription(sub.id);
      if (result.success) {
        return prisma.subscription.findUnique({
          where: { id: sub.id },
          include: { plan: true, billingKey: true },
        });
      }
    }
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "expired" },
    });
    return null;
  }

  return sub;
}
