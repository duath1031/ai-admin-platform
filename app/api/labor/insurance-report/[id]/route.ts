/**
 * 4대보험 신고서 상세 API
 * GET    /api/labor/insurance-report/[id] - 신고서 상세
 * DELETE /api/labor/insurance-report/[id] - 신고서 삭제
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
    const report = await prisma.insuranceReport.findFirst({
      where: { id, userId: session.user.id },
      include: {
        employee: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "신고서를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("[InsuranceReport GET] Error:", error);
    return NextResponse.json({ error: "신고서 조회 실패" }, { status: 500 });
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
    const report = await prisma.insuranceReport.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!report) {
      return NextResponse.json({ error: "신고서를 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.insuranceReport.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "신고서가 삭제되었습니다." });
  } catch (error) {
    console.error("[InsuranceReport DELETE] Error:", error);
    return NextResponse.json({ error: "신고서 삭제 실패" }, { status: 500 });
  }
}
