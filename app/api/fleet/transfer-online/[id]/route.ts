/**
 * 온라인 이전등록 대행 상세 API
 * GET /api/fleet/transfer-online/[id] - 대행 접수 상세 조회
 * PUT /api/fleet/transfer-online/[id] - 상태 업데이트 (관리자용)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── GET: 대행 접수 상세 조회 ──
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

    const transfer = await prisma.vehicleTransfer.findFirst({
      where: {
        id,
        userId: session.user.id,
        transferType: "online_agent",
      },
      include: {
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            vehicleType: true,
            modelName: true,
            modelYear: true,
            displacement: true,
            color: true,
            currentMileage: true,
          },
        },
      },
    });

    if (!transfer) {
      return NextResponse.json({ error: "접수 내역을 찾을 수 없습니다." }, { status: 404 });
    }

    // documentsJson에서 전체 신청 데이터 추출
    let applicationData: Record<string, unknown> = {};
    try {
      applicationData = transfer.documentsJson ? JSON.parse(transfer.documentsJson) : {};
    } catch {
      applicationData = {};
    }

    return NextResponse.json({
      success: true,
      data: {
        id: transfer.id,
        requestNumber: applicationData.requestNumber || "-",
        status: transfer.status,
        vehicle: transfer.vehicle,
        counterparty: transfer.counterparty,
        transferPrice: transfer.transferPrice,
        transferDate: transfer.transferDate,
        acquisitionTax: transfer.acquisitionTax,
        registrationTax: transfer.registrationTax,
        educationTax: transfer.educationTax,
        bondDiscount: transfer.bondDiscount,
        stampTax: transfer.stampTax,
        totalCost: transfer.totalCost,
        applicationData,
        createdAt: transfer.createdAt,
        updatedAt: transfer.updatedAt,
      },
    });
  } catch (error) {
    console.error("[Transfer Online GET Detail] Error:", error);
    return NextResponse.json(
      { error: "접수 상세 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

// ── PUT: 상태 업데이트 (관리자용) ──
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // 관리자 권한 확인
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // 상태값 검증
    const validStatuses = [
      "requested",      // 접수완료
      "document_check", // 서류확인
      "in_progress",    // 처리중
      "completed",      // 완료
      "failed",         // 실패
      "cancelled",      // 취소
    ];

    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `유효하지 않은 상태입니다. (${validStatuses.join(", ")})` },
        { status: 400 }
      );
    }

    const existing = await prisma.vehicleTransfer.findFirst({
      where: { id, transferType: "online_agent" },
    });

    if (!existing) {
      return NextResponse.json({ error: "접수 내역을 찾을 수 없습니다." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.status) {
      updateData.status = body.status;
    }

    // documentsJson에 관리자 메모나 추가 정보 업데이트
    if (body.adminNote || body.status) {
      let applicationData: Record<string, unknown> = {};
      try {
        applicationData = existing.documentsJson ? JSON.parse(existing.documentsJson) : {};
      } catch {
        applicationData = {};
      }

      // 상태 히스토리 추가
      const statusHistory = (applicationData.statusHistory as Array<Record<string, unknown>>) || [];
      statusHistory.push({
        status: body.status || existing.status,
        changedBy: session.user.id,
        changedAt: new Date().toISOString(),
        note: body.adminNote || "",
      });
      applicationData.statusHistory = statusHistory;

      if (body.adminNote) {
        applicationData.adminNote = body.adminNote;
      }

      updateData.documentsJson = JSON.stringify(applicationData);
    }

    const updated = await prisma.vehicleTransfer.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("[Transfer Online PUT] Error:", error);
    return NextResponse.json(
      { error: "상태 업데이트에 실패했습니다." },
      { status: 500 }
    );
  }
}
