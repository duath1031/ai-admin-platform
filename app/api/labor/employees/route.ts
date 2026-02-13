/**
 * 직원 관리 API
 * GET  /api/labor/employees - 직원 목록 (clientCompanyId 필터 지원)
 * POST /api/labor/employees - 직원 등록 (거래처 직원 등록 가능)
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
    const clientCompanyId = searchParams.get("clientCompanyId");

    // clientCompanyId 파라미터 처리:
    // - "none" 또는 미지정: 내 기업 직원만 (clientCompanyId IS NULL)
    // - 특정 ID: 해당 거래처 직원만
    // - "all": 전체 직원
    const whereClause: Record<string, unknown> = {
      userId: session.user.id,
      ...(activeOnly ? { isActive: true } : {}),
    };

    if (clientCompanyId === "all") {
      // 전체 직원
    } else if (clientCompanyId && clientCompanyId !== "none") {
      whereClause.clientCompanyId = clientCompanyId;
    } else {
      // 기본: 내 기업 직원 (clientCompanyId가 null인 것)
      whereClause.clientCompanyId = null;
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        clientCompany: { select: { id: true, companyName: true } },
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
      weeklyWorkHours, hourlyWage, industryCode, clientCompanyId } = body;

    if (!name || !hireDate || !monthlySalary) {
      return NextResponse.json({ error: "이름, 입사일, 월급여는 필수입니다." }, { status: 400 });
    }

    // 거래처 ID가 있으면 소유권 확인
    if (clientCompanyId) {
      const client = await prisma.clientCompany.findFirst({
        where: { id: clientCompanyId, userId: session.user.id, isActive: true },
      });
      if (!client) {
        return NextResponse.json({ error: "해당 거래처를 찾을 수 없습니다." }, { status: 404 });
      }
    }

    const employee = await prisma.employee.create({
      data: {
        userId: session.user.id,
        clientCompanyId: clientCompanyId || null,
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
      include: {
        clientCompany: { select: { id: true, companyName: true } },
      },
    });

    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (error) {
    console.error("[Employees POST] Error:", error);
    return NextResponse.json({ error: "직원 등록 실패" }, { status: 500 });
  }
}
