/**
 * 구독 상태 조회 / 플랜 변경 API
 * GET  /api/payments/subscription - 현재 구독 상태
 * PATCH /api/payments/subscription - 플랜 변경
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getActiveSubscription,
  changePlan,
} from "@/lib/billing/subscriptionService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const subscription = await getActiveSubscription(session.user.id);

    if (!subscription) {
      // 구독 없음 = Starter (무료)
      const starterPlan = await prisma.subscriptionPlan.findUnique({
        where: { planCode: "starter" },
      });

      return NextResponse.json({
        success: true,
        subscription: null,
        currentPlan: {
          planCode: "starter",
          displayName: starterPlan?.displayName || "Starter",
          price: 0,
          features: starterPlan?.features || "AI 상담 3회/월, 서류 작성 1건/월",
          tokenQuota: starterPlan?.tokenQuota || 10000,
        },
      });
    }

    // 최근 결제 내역
    const recentPayments = await prisma.payment.findMany({
      where: {
        subscriptionId: subscription.id,
        status: "PAID",
      },
      orderBy: { approvedAt: "desc" },
      take: 3,
      select: {
        orderId: true,
        amount: true,
        approvedAt: true,
        itemName: true,
        receiptUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        nextBillingDate: subscription.nextBillingDate,
        trialEndsAt: subscription.trialEndsAt,
        cancelledAt: subscription.cancelledAt,
        endDate: subscription.endDate,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
      currentPlan: {
        planCode: subscription.plan.planCode,
        displayName: subscription.plan.displayName,
        price: subscription.plan.price,
        features: subscription.plan.features,
        tokenQuota: subscription.plan.tokenQuota,
      },
      billingKey: subscription.billingKey
        ? {
            id: subscription.billingKey.id,
            cardName: subscription.billingKey.cardName,
            cardNumber: subscription.billingKey.cardNumber,
          }
        : null,
      recentPayments,
    });
  } catch (error) {
    console.error("[Subscription GET] Error:", error);
    return NextResponse.json(
      { error: "구독 정보 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, newPlanCode } = body;

    if (!subscriptionId || !newPlanCode) {
      return NextResponse.json(
        { error: "subscriptionId와 newPlanCode는 필수입니다." },
        { status: 400 }
      );
    }

    const result = await changePlan({
      userId: session.user.id,
      subscriptionId,
      newPlanCode,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Subscription PATCH] Error:", error);
    const message =
      error instanceof Error ? error.message : "플랜 변경 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
