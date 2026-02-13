/**
 * 직원 상세 API
 * GET    /api/labor/employees/[id]
 * PUT    /api/labor/employees/[id]
 * DELETE /api/labor/employees/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const employee = await prisma.employee.findFirst({
      where: { id, userId: session.user.id },
      include: { payslips: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 } },
    });

    if (!employee) {
      return NextResponse.json({ error: "직원을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error("[Employee GET] Error:", error);
    return NextResponse.json({ error: "직원 조회 실패" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.employee.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "직원을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const fields = [
      "name", "department", "position", "employmentType", "industryCode",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    const numberFields = [
      "monthlySalary", "dependents", "childrenUnder20", "nonTaxableAmount",
      "weeklyWorkHours", "hourlyWage",
    ];
    for (const f of numberFields) {
      if (body[f] !== undefined) updateData[f] = body[f] === null ? null : Number(body[f]);
    }

    const boolFields = [
      "nationalPensionExempt", "healthInsuranceExempt", "employmentInsuranceExempt", "isActive",
    ];
    for (const f of boolFields) {
      if (body[f] !== undefined) updateData[f] = Boolean(body[f]);
    }

    const dateFields = ["birthDate", "hireDate", "resignDate"];
    for (const f of dateFields) {
      if (body[f] !== undefined) updateData[f] = body[f] ? new Date(body[f]) : null;
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error("[Employee PUT] Error:", error);
    return NextResponse.json({ error: "직원 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.employee.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "직원을 찾을 수 없습니다." }, { status: 404 });
    }

    // 소프트 삭제 (isActive = false)
    await prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "직원이 비활성화되었습니다." });
  } catch (error) {
    console.error("[Employee DELETE] Error:", error);
    return NextResponse.json({ error: "직원 삭제 실패" }, { status: 500 });
  }
}
