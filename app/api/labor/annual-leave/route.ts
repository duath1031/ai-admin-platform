/**
 * 연차 계산 API
 * POST /api/labor/annual-leave
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateAnnualLeave } from "@/lib/labor/annualLeaveCalculator";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "annual_leave_calc");
    if (!access.allowed) {
      return NextResponse.json({
        error: `${access.requiredPlan} 이상 요금제에서 사용 가능합니다.`,
        requiredPlan: access.requiredPlan,
      }, { status: 403 });
    }

    const body = await request.json();
    const { hireDate, usedDays, asOfDate } = body;

    if (!hireDate) {
      return NextResponse.json({ error: "입사일은 필수입니다." }, { status: 400 });
    }

    const result = calculateAnnualLeave({
      hireDate,
      usedDays: usedDays ? Number(usedDays) : 0,
      asOfDate: asOfDate || undefined,
    });

    await deductTokens(session.user.id, "annual_leave_calc");

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Annual Leave API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "계산 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
