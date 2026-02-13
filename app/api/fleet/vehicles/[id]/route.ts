/**
 * 차량 상세 API
 * GET    /api/fleet/vehicles/[id] - 차량 상세 조회
 * PUT    /api/fleet/vehicles/[id] - 차량 정보 수정
 * DELETE /api/fleet/vehicles/[id] - 차량 소프트 삭제 (비활성화)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, userId: session.user.id },
      include: {
        clientCompany: { select: { id: true, companyName: true } },
        transfers: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    console.error("[Vehicle GET] Error:", error);
    return NextResponse.json({ error: "차량 조회 실패" }, { status: 500 });
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
    const existing = await prisma.vehicle.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // 문자열 필드
    const stringFields = [
      "plateNumber", "vehicleType", "manufacturer", "modelName",
      "fuelType", "color", "insuranceCompany",
      "assignedDriver", "purpose", "ownershipType", "leaseCompany",
      "status", "memo",
    ];
    for (const f of stringFields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    // 숫자(Int) 필드
    const intFields = [
      "modelYear", "purchasePrice", "displacement",
      "currentMileage", "monthlyPayment",
    ];
    for (const f of intFields) {
      if (body[f] !== undefined) updateData[f] = body[f] === null ? null : Number(body[f]);
    }

    // Boolean 필드
    const boolFields = ["isActive"];
    for (const f of boolFields) {
      if (body[f] !== undefined) updateData[f] = Boolean(body[f]);
    }

    // 날짜 필드
    const dateFields = [
      "registrationDate", "purchaseDate",
      "insuranceExpiry", "inspectionExpiry", "leaseExpiry",
    ];
    for (const f of dateFields) {
      if (body[f] !== undefined) updateData[f] = body[f] ? new Date(body[f]) : null;
    }

    // 거래처 변경 시 소유권 확인
    if (body.clientCompanyId !== undefined) {
      if (body.clientCompanyId) {
        const client = await prisma.clientCompany.findFirst({
          where: { id: body.clientCompanyId, userId: session.user.id, isActive: true },
        });
        if (!client) {
          return NextResponse.json({ error: "해당 거래처를 찾을 수 없습니다." }, { status: 404 });
        }
      }
      updateData.clientCompanyId = body.clientCompanyId || null;
    }

    // 차량번호 변경 시 중복 검사
    if (body.plateNumber && body.plateNumber !== existing.plateNumber) {
      const duplicate = await prisma.vehicle.findFirst({
        where: {
          userId: session.user.id,
          plateNumber: body.plateNumber,
          isActive: true,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "이미 등록된 차량번호입니다." },
          { status: 409 }
        );
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
      include: {
        clientCompany: { select: { id: true, companyName: true } },
      },
    });

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    console.error("[Vehicle PUT] Error:", error);
    return NextResponse.json({ error: "차량 수정 실패" }, { status: 500 });
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
    const existing = await prisma.vehicle.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    // 소프트 삭제 (isActive = false)
    await prisma.vehicle.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "차량이 비활성화되었습니다." });
  } catch (error) {
    console.error("[Vehicle DELETE] Error:", error);
    return NextResponse.json({ error: "차량 삭제 실패" }, { status: 500 });
  }
}
