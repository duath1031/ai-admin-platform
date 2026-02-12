/**
 * 구독 해지 API
 * POST /api/payments/cancel-subscription
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelSubscription } from "@/lib/billing/subscriptionService";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, reason } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId는 필수입니다." },
        { status: 400 }
      );
    }

    const result = await cancelSubscription(
      session.user.id,
      subscriptionId,
      reason
    );

    console.log(
      `[Cancel Subscription] user=${session.user.id}, sub=${subscriptionId}, reason=${reason || "미입력"}`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Cancel Subscription] Error:", error);
    const message =
      error instanceof Error ? error.message : "구독 해지 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
