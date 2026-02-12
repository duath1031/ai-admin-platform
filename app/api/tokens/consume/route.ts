/**
 * 토큰 차감 API
 * POST /api/tokens/consume
 *
 * 기능 사용 시 토큰을 차감하고 트랜잭션을 기록한다.
 * 잔액 부족 시 403 + 업그레이드 안내 반환.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductTokens, getBalance, getCost } from "@/lib/token/tokenService";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { TOKEN_FEATURE_NAMES } from "@/lib/config/tokenCosts";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { feature, customCost } = body;

    if (!feature) {
      return NextResponse.json(
        { error: "feature는 필수입니다." },
        { status: 400 }
      );
    }

    // 1. 기능 접근 권한 확인 (플랜별)
    const access = await checkFeatureAccess(session.user.id, feature);
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: "요금제 업그레이드가 필요합니다.",
          code: "PLAN_REQUIRED",
          currentPlan: access.planCode,
          requiredPlan: access.requiredPlan,
          feature,
          featureName: TOKEN_FEATURE_NAMES[feature] || feature,
        },
        { status: 403 }
      );
    }

    // 2. 잔액 확인
    const balance = await getBalance(session.user.id);
    const cost = customCost || getCost(feature);

    if (balance !== -1 && balance < cost) {
      return NextResponse.json(
        {
          error: "토큰이 부족합니다.",
          code: "INSUFFICIENT_TOKENS",
          balance,
          cost,
          feature,
          featureName: TOKEN_FEATURE_NAMES[feature] || feature,
        },
        { status: 402 }
      );
    }

    // 3. 원자적 차감
    const deducted = await deductTokens(session.user.id, feature, customCost);
    if (!deducted) {
      return NextResponse.json(
        {
          error: "토큰 차감에 실패했습니다. (동시 요청 충돌)",
          code: "DEDUCTION_FAILED",
        },
        { status: 409 }
      );
    }

    // 4. 트랜잭션 기록
    const newBalance = await getBalance(session.user.id);
    await prisma.creditTransaction.create({
      data: {
        userId: session.user.id,
        amount: -cost,
        balance: newBalance,
        type: "consume",
        description: TOKEN_FEATURE_NAMES[feature] || feature,
        referenceType: feature,
      },
    });

    return NextResponse.json({
      success: true,
      consumed: cost,
      balance: newBalance,
      feature,
    });
  } catch (error) {
    console.error("[Token Consume] Error:", error);
    return NextResponse.json(
      { error: "토큰 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
