export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/user/overage
 * 초과과금 설정 및 현황 조회
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      overageEnabled: true,
      overageMonthlyLimit: true,
      overageSpentThisMonth: true,
      credits: true,
      plan: true,
      billingKeys: {
        where: { isDefault: true, isActive: true },
        select: { id: true, cardName: true, cardNumber: true },
        take: 1,
      },
      subscriptions: {
        where: { status: { in: ["active", "trial"] } },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "사용자 정보 없음" }, { status: 404 });
  }

  const activeSub = user.subscriptions[0];
  const planTokenQuota = activeSub?.plan?.tokenQuota ?? 1000;
  const hasBillingKey = user.billingKeys.length > 0;
  const billingCard = user.billingKeys[0] || null;

  // 이번 달 초과과금 기록
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const overageRecord = await prisma.overageCharge.findUnique({
    where: { userId_billingMonth: { userId: session.user.id, billingMonth } },
  });

  return NextResponse.json({
    success: true,
    overage: {
      enabled: user.overageEnabled,
      monthlyLimit: user.overageMonthlyLimit,
      spentThisMonth: user.overageSpentThisMonth,
      remainingBudget: Math.max(0, user.overageMonthlyLimit - user.overageSpentThisMonth),
      batchTokens: 100_000,
      batchPrice: 15_000,
    },
    plan: {
      name: activeSub?.plan?.displayName || "Starter",
      planCode: activeSub?.plan?.planCode || "starter",
      tokenQuota: planTokenQuota,
      currentBalance: user.credits,
    },
    billing: {
      hasBillingKey,
      card: billingCard
        ? { name: billingCard.cardName, number: billingCard.cardNumber }
        : null,
    },
    history: overageRecord
      ? {
          billingMonth,
          overageTokens: overageRecord.overageCredits,
          totalCharge: overageRecord.totalCharge,
        }
      : null,
  });
}

/**
 * PATCH /api/user/overage
 * 초과과금 설정 변경
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const body = await req.json();
  const { enabled, monthlyLimit } = body;

  // 유효성 검사
  if (enabled === true) {
    // 빌링키 확인 필수
    const billingKey = await prisma.billingKey.findFirst({
      where: { userId: session.user.id, isDefault: true, isActive: true },
    });
    if (!billingKey) {
      return NextResponse.json(
        { error: "초과과금을 활성화하려면 먼저 결제수단을 등록해주세요." },
        { status: 400 }
      );
    }

    // Starter 플랜 차단
    const sub = await prisma.subscription.findFirst({
      where: { userId: session.user.id, status: { in: ["active", "trial"] } },
      include: { plan: true },
    });
    if (!sub || sub.plan.planCode === "starter") {
      return NextResponse.json(
        { error: "Starter 플랜은 초과과금을 사용할 수 없습니다. 플랜을 업그레이드해주세요." },
        { status: 403 }
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (typeof enabled === "boolean") {
    updateData.overageEnabled = enabled;
  }
  if (typeof monthlyLimit === "number") {
    // 최소 15,000원 (1배치), 최대 500,000원
    updateData.overageMonthlyLimit = Math.max(15_000, Math.min(500_000, monthlyLimit));
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: {
      overageEnabled: true,
      overageMonthlyLimit: true,
      overageSpentThisMonth: true,
    },
  });

  return NextResponse.json({
    success: true,
    overage: {
      enabled: updated.overageEnabled,
      monthlyLimit: updated.overageMonthlyLimit,
      spentThisMonth: updated.overageSpentThisMonth,
    },
  });
}
