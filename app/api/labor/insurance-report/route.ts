/**
 * 4대보험 신고서 API
 * GET  /api/labor/insurance-report - 신고서 목록
 * POST /api/labor/insurance-report - 신고서 생성
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const reportType = searchParams.get("reportType");

    const reports = await prisma.insuranceReport.findMany({
      where: {
        userId: session.user.id,
        ...(employeeId ? { employeeId } : {}),
        ...(reportType ? { reportType } : {}),
      },
      include: {
        employee: {
          select: { id: true, name: true, department: true, position: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    console.error("[InsuranceReport GET] Error:", error);
    return NextResponse.json({ error: "신고서 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "insurance_report");
    if (!access.allowed) {
      return NextResponse.json({
        error: `4대보험 신고서는 ${access.requiredPlan} 이상 요금제에서 사용 가능합니다.`,
        requiredPlan: access.requiredPlan,
      }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, reportType, reportData } = body;

    if (!employeeId || !reportType || !reportData) {
      return NextResponse.json({ error: "직원, 신고유형, 신고데이터는 필수입니다." }, { status: 400 });
    }

    if (!["acquisition", "loss", "salary_change"].includes(reportType)) {
      return NextResponse.json({ error: "유효하지 않은 신고유형입니다." }, { status: 400 });
    }

    // 직원 소유권 확인
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, userId: session.user.id },
    });
    if (!employee) {
      return NextResponse.json({ error: "직원을 찾을 수 없습니다." }, { status: 404 });
    }

    // 토큰 차감
    const success = await deductTokens(session.user.id, "insurance_report");
    if (!success) {
      return NextResponse.json({ error: "토큰이 부족합니다." }, { status: 402 });
    }

    const report = await prisma.insuranceReport.create({
      data: {
        employeeId,
        userId: session.user.id,
        reportType,
        reportData: typeof reportData === "string" ? reportData : JSON.stringify(reportData),
      },
      include: {
        employee: {
          select: { id: true, name: true, department: true, position: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: report }, { status: 201 });
  } catch (error) {
    console.error("[InsuranceReport POST] Error:", error);
    return NextResponse.json({ error: "신고서 생성 실패" }, { status: 500 });
  }
}
