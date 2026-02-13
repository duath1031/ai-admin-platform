/**
 * 직원 관리 API
 * GET  /api/labor/employees - 직원 목록
 * POST /api/labor/employees - 직원 등록
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkFeatureAccess } from "@/lib/token/planAccess";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") !== "false";

    const employees = await prisma.employee.findMany({
      where: {
        userId: session.user.id,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: employees });
  } catch (error) {
    console.error("[Employees GET] Error:", error);
    return NextResponse.json({ error: "직원 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "employee_management");
    if (!access.allowed) {
      // Pro 이하에서도 직원 등록은 허용 (10명 제한)
      const existingCount = await prisma.employee.count({
        where: { userId: session.user.id, isActive: true },
      });
      if (existingCount >= 5 && access.planCode !== "pro" && access.planCode !== "pro_plus") {
        return NextResponse.json({
          error: "현재 요금제에서는 최대 5명까지 등록 가능합니다. Pro 이상으로 업그레이드해주세요.",
          requiredPlan: "pro",
        }, { status: 403 });
      }
    }

    const body = await request.json();
    const { name, birthDate, hireDate, department, position, employmentType,
      monthlySalary, dependents, childrenUnder20, nonTaxableAmount,
      nationalPensionExempt, healthInsuranceExempt, employmentInsuranceExempt,
      weeklyWorkHours, hourlyWage, industryCode } = body;

    if (!name || !hireDate || !monthlySalary) {
      return NextResponse.json({ error: "이름, 입사일, 월급여는 필수입니다." }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: {
        userId: session.user.id,
        name,
        birthDate: birthDate ? new Date(birthDate) : null,
        hireDate: new Date(hireDate),
        department: department || null,
        position: position || null,
        employmentType: employmentType || "regular",
        monthlySalary: Number(monthlySalary),
        dependents: Number(dependents) || 1,
        childrenUnder20: Number(childrenUnder20) || 0,
        nonTaxableAmount: Number(nonTaxableAmount) || 0,
        nationalPensionExempt: Boolean(nationalPensionExempt),
        healthInsuranceExempt: Boolean(healthInsuranceExempt),
        employmentInsuranceExempt: Boolean(employmentInsuranceExempt),
        weeklyWorkHours: Number(weeklyWorkHours) || 40,
        hourlyWage: hourlyWage ? Number(hourlyWage) : null,
        industryCode: industryCode || "80",
      },
    });

    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (error) {
    console.error("[Employees POST] Error:", error);
    return NextResponse.json({ error: "직원 등록 실패" }, { status: 500 });
  }
}
