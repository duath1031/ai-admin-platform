/**
 * 급여명세서 상세 API
 * GET    /api/labor/payslip/[id]
 * PUT    /api/labor/payslip/[id]
 * DELETE /api/labor/payslip/[id]
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
    const payslip = await prisma.payslip.findFirst({
      where: { id, userId: session.user.id },
      include: { employee: true },
    });

    if (!payslip) {
      return NextResponse.json({ error: "명세서를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: payslip });
  } catch (error) {
    console.error("[Payslip GET] Error:", error);
    return NextResponse.json({ error: "명세서 조회 실패" }, { status: 500 });
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
    const existing = await prisma.payslip.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "명세서를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) updateData.status = body.status;
    if (body.overtimePay !== undefined) updateData.overtimePay = Number(body.overtimePay);
    if (body.bonusPay !== undefined) updateData.bonusPay = Number(body.bonusPay);
    if (body.otherAllowance !== undefined) updateData.otherAllowance = Number(body.otherAllowance);
    if (body.mealAllowance !== undefined) updateData.mealAllowance = Number(body.mealAllowance);

    const payslip = await prisma.payslip.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: payslip });
  } catch (error) {
    console.error("[Payslip PUT] Error:", error);
    return NextResponse.json({ error: "명세서 수정 실패" }, { status: 500 });
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
    const existing = await prisma.payslip.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "명세서를 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.payslip.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "명세서가 삭제되었습니다." });
  } catch (error) {
    console.error("[Payslip DELETE] Error:", error);
    return NextResponse.json({ error: "명세서 삭제 실패" }, { status: 500 });
  }
}
