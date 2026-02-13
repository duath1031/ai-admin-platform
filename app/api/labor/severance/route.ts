/**
 * 퇴직금 계산 API
 * POST /api/labor/severance
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateSeverance } from "@/lib/labor/severanceCalculator";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "severance_calc");
    if (!access.allowed) {
      return NextResponse.json({
        error: `${access.requiredPlan} 이상 요금제에서 사용 가능합니다.`,
        requiredPlan: access.requiredPlan,
      }, { status: 403 });
    }

    const body = await request.json();
    const { hireDate, resignDate, monthlySalary, recentThreeMonthPay, annualBonus, annualAllowance } = body;

    if (!hireDate || !resignDate || !monthlySalary) {
      return NextResponse.json({ error: "입사일, 퇴직일, 월급여는 필수입니다." }, { status: 400 });
    }

    const result = calculateSeverance({
      hireDate,
      resignDate,
      monthlySalary: Number(monthlySalary),
      recentThreeMonthPay: recentThreeMonthPay ? Number(recentThreeMonthPay) : undefined,
      annualBonus: annualBonus ? Number(annualBonus) : undefined,
      annualAllowance: annualAllowance ? Number(annualAllowance) : undefined,
    });

    await deductTokens(session.user.id, "severance_calc");

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Severance API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "계산 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
