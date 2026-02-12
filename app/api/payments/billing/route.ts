/**
 * 빌링키 등록 + 구독 생성 API
 * POST /api/payments/billing
 *
 * 클라이언트에서 PortOne SDK로 발급받은 billingKey를 전달받아
 * DB에 저장하고 구독을 생성한다.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSubscription } from "@/lib/billing/subscriptionService";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { billingKey, planCode, cardName, cardNumber, withTrial } = body;

    if (!billingKey || !planCode) {
      return NextResponse.json(
        { error: "billingKey와 planCode는 필수입니다." },
        { status: 400 }
      );
    }

    // 플랜 유효성 검증
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { planCode },
    });
    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: "유효하지 않은 요금제입니다." },
        { status: 400 }
      );
    }

    // 기존 활성 구독 확인
    const existingSub = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ["active", "trial"] },
      },
    });
    if (existingSub) {
      return NextResponse.json(
        { error: "이미 활성 구독이 있습니다." },
        { status: 409 }
      );
    }

    // 빌링키 저장 (기존 것이 있으면 비활성화)
    await prisma.billingKey.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });

    const savedKey = await prisma.billingKey.create({
      data: {
        userId: session.user.id,
        billingKey,
        cardName: cardName || null,
        cardNumber: cardNumber || null,
        isDefault: true,
        isActive: true,
      },
    });

    // 구독 생성
    const subscription = await createSubscription({
      userId: session.user.id,
      planCode,
      billingKeyId: savedKey.id,
      withTrial: withTrial === true,
    });

    console.log(
      `[Billing] 구독 생성: user=${session.user.id}, plan=${planCode}, trial=${!!withTrial}`
    );

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        planCode: plan.planCode,
        planName: plan.displayName,
        status: subscription.status,
        nextBillingDate: subscription.nextBillingDate,
        trialEndsAt: subscription.trialEndsAt,
      },
    });
  } catch (error) {
    console.error("[Billing] Error:", error);
    const message =
      error instanceof Error ? error.message : "결제 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
