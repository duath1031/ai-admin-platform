/**
 * 급여명세서 API
 * GET  /api/labor/payslip - 명세서 목록
 * POST /api/labor/payslip - 명세서 생성
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";

import { calculateInsurance } from "@/lib/labor/insuranceCalculator";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
    const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
    const employeeId = searchParams.get("employeeId") || undefined;

    const payslips = await prisma.payslip.findMany({
      where: {
        userId: session.user.id,
        ...(year ? { year } : {}),
        ...(month ? { month } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: { select: { name: true, department: true, position: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json({ success: true, data: payslips });
  } catch (error) {
    console.error("[Payslip GET] Error:", error);
    return NextResponse.json({ error: "명세서 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "payslip_generate");
    if (!access.allowed) {
      return NextResponse.json({
        error: `${access.requiredPlan} 이상 요금제에서 사용 가능합니다.`,
        requiredPlan: access.requiredPlan,
      }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, year, month, overtimePay, bonusPay, otherAllowance, mealAllowance } = body;

    if (!employeeId || !year || !month) {
      return NextResponse.json({ error: "직원, 년도, 월은 필수입니다." }, { status: 400 });
    }

    // 직원 정보 조회
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, userId: session.user.id },
    });
    if (!employee) {
      return NextResponse.json({ error: "직원을 찾을 수 없습니다." }, { status: 404 });
    }

    // 중복 체크
    const existing = await prisma.payslip.findUnique({
      where: { employeeId_year_month: { employeeId, year: Number(year), month: Number(month) } },
    });
    if (existing) {
      return NextResponse.json({ error: "해당 월 명세서가 이미 존재합니다." }, { status: 409 });
    }

    // 급여 계산
    const baseSalary = employee.monthlySalary;
    const overtime = Number(overtimePay) || 0;
    const bonus = Number(bonusPay) || 0;
    const other = Number(otherAllowance) || 0;
    const meal = Number(mealAllowance) || 0;
    const totalGross = baseSalary + overtime + bonus + other + meal;

    // 보험료 계산 (비과세 = 식대)
    const nonTaxable = meal + employee.nonTaxableAmount;
    const calcResult = calculateInsurance({
      monthlySalary: totalGross,
      nonTaxableAmount: nonTaxable,
      dependents: employee.dependents,
      childrenUnder20: employee.childrenUnder20,
      companySize: "under150",
      industryCode: employee.industryCode,
      nationalPensionExempt: employee.nationalPensionExempt,
      healthInsuranceExempt: employee.healthInsuranceExempt,
      employmentInsuranceExempt: employee.employmentInsuranceExempt,
    });

    const deductions = {
      nationalPension: calcResult.nationalPension.employeeAmount,
      healthInsurance: calcResult.healthInsurance.employeeAmount,
      longTermCare: calcResult.longTermCare.employeeAmount,
      employmentInsurance: calcResult.employmentInsurance.employeeAmount,
      incomeTax: calcResult.incomeTax.employeeAmount,
      localIncomeTax: calcResult.localIncomeTax.employeeAmount,
    };

    const employerBurden = {
      nationalPension: calcResult.nationalPension.employerAmount,
      healthInsurance: calcResult.healthInsurance.employerAmount,
      longTermCare: calcResult.longTermCare.employerAmount,
      employmentInsurance: calcResult.employmentInsurance.employerAmount,
      industrialAccident: calcResult.industrialAccident.employerAmount,
    };

    const payslip = await prisma.payslip.create({
      data: {
        employeeId,
        userId: session.user.id,
        year: Number(year),
        month: Number(month),
        baseSalary,
        overtimePay: overtime,
        bonusPay: bonus,
        otherAllowance: other,
        mealAllowance: meal,
        totalGross,
        deductions: JSON.stringify(deductions),
        totalDeduction: calcResult.totalEmployeeDeduction,
        netPay: calcResult.netPay,
        employerBurden: JSON.stringify(employerBurden),
      },
      include: { employee: { select: { name: true, department: true, position: true } } },
    });

    await deductTokens(session.user.id, "payslip_generate");

    return NextResponse.json({ success: true, data: payslip }, { status: 201 });
  } catch (error) {
    console.error("[Payslip POST] Error:", error);
    return NextResponse.json({ error: "명세서 생성 실패" }, { status: 500 });
  }
}
