/**
 * 토큰 잔액 + 사용현황 조회 API
 * GET /api/tokens/balance
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/token/tokenService";
import { getUserPlanCode } from "@/lib/token/planAccess";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    const [balance, planCode] = await Promise.all([
      getBalance(session.user.id),
      getUserPlanCode(session.user.id),
    ]);

    // 이번 달 사용량 조회
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyUsage = await prisma.creditTransaction.aggregate({
      where: {
        userId: session.user.id,
        type: "consume",
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
      _count: true,
    });

    // 플랜 정보
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { planCode },
    });

    return NextResponse.json({
      success: true,
      balance,
      unlimited: balance === -1,
      planCode,
      planName: plan?.displayName || "Starter",
      tokenQuota: plan?.tokenQuota || 10000,
      monthlyUsed: Math.abs(monthlyUsage._sum.amount || 0),
      monthlyCount: monthlyUsage._count,
    });
  } catch (error) {
    console.error("[Token Balance] Error:", error);
    return NextResponse.json(
      { error: "잔액 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
