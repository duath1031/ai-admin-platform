/**
 * 주휴수당 계산 API
 * POST /api/labor/weekly-holiday-pay
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateWeeklyHolidayPay } from "@/lib/labor/weeklyHolidayPayCalculator";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "weekly_holiday_calc");
    if (!access.allowed) {
      return NextResponse.json({
        error: `${access.requiredPlan} 이상 요금제에서 사용 가능합니다.`,
        requiredPlan: access.requiredPlan,
      }, { status: 403 });
    }

    const body = await request.json();
    const { hourlyWage, weeklyWorkHours, contractDaysPerWeek, actualDaysWorked, isMonthlySalary } = body;

    if (!hourlyWage || !weeklyWorkHours) {
      return NextResponse.json({ error: "시급과 주 근로시간은 필수입니다." }, { status: 400 });
    }

    const result = calculateWeeklyHolidayPay({
      hourlyWage: Number(hourlyWage),
      weeklyWorkHours: Number(weeklyWorkHours),
      contractDaysPerWeek: contractDaysPerWeek ? Number(contractDaysPerWeek) : undefined,
      actualDaysWorked: actualDaysWorked ? Number(actualDaysWorked) : undefined,
      isMonthlySalary: Boolean(isMonthlySalary),
    });

    await deductTokens(session.user.id, "weekly_holiday_calc");

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Weekly Holiday Pay API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "계산 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
