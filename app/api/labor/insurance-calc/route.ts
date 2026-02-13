/**
 * 4대보험 계산 API
 * POST /api/labor/insurance-calc - 전체 계산
 * GET  /api/labor/insurance-calc - 산재보험 업종코드 목록
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateInsurance, INDUSTRY_RATES, EI_EMPLOYER_EXTRA } from "@/lib/labor/insuranceCalculator";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "insurance_calc");
    if (!access.allowed) {
      return NextResponse.json({
        error: `${access.requiredPlan} 이상 요금제에서 사용 가능합니다.`,
        requiredPlan: access.requiredPlan,
      }, { status: 403 });
    }

    const body = await request.json();
    const { monthlySalary, nonTaxableAmount, dependents, childrenUnder20, companySize, industryCode,
      nationalPensionExempt, healthInsuranceExempt, employmentInsuranceExempt } = body;

    if (!monthlySalary || monthlySalary <= 0) {
      return NextResponse.json({ error: "월 급여를 입력해주세요." }, { status: 400 });
    }

    const result = calculateInsurance({
      monthlySalary: Number(monthlySalary),
      nonTaxableAmount: Number(nonTaxableAmount) || 0,
      dependents: Number(dependents) || 1,
      childrenUnder20: Number(childrenUnder20) || 0,
      companySize: companySize || "under150",
      industryCode: industryCode || "80",
      nationalPensionExempt: Boolean(nationalPensionExempt),
      healthInsuranceExempt: Boolean(healthInsuranceExempt),
      employmentInsuranceExempt: Boolean(employmentInsuranceExempt),
    });

    // 토큰 차감
    await deductTokens(session.user.id, "insurance_calc");

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Insurance Calc API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "계산 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    industryRates: INDUSTRY_RATES,
    companySizes: Object.entries(EI_EMPLOYER_EXTRA).map(([key, val]) => ({
      code: key,
      label: val.label,
      extraRate: `${(val.rate * 100).toFixed(2)}%`,
    })),
  });
}
