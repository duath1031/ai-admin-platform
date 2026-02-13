/**
 * 법인차량 관리 API
 * GET  /api/fleet/vehicles - 차량 목록 (clientCompanyId 필터 지원)
 * POST /api/fleet/vehicles - 차량 등록
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkFeatureAccess } from "@/lib/token/planAccess";

export const dynamic = "force-dynamic";

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
    // - "none" 또는 미지정: 내 기업 차량만 (clientCompanyId IS NULL)
    // - 특정 ID: 해당 거래처 차량만
    // - "all": 전체 차량
    const whereClause: Record<string, unknown> = {
      userId: session.user.id,
      ...(activeOnly ? { isActive: true } : {}),
    };

    if (clientCompanyId === "all") {
      // 전체 차량
    } else if (clientCompanyId && clientCompanyId !== "none") {
      whereClause.clientCompanyId = clientCompanyId;
    } else {
      // 기본: 내 기업 차량 (clientCompanyId가 null인 것)
      whereClause.clientCompanyId = null;
    }

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      include: {
        clientCompany: { select: { id: true, companyName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: vehicles });
  } catch (error) {
    console.error("[Vehicles GET] Error:", error);
    return NextResponse.json({ error: "차량 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // 플랜 접근 권한 확인
    const access = await checkFeatureAccess(session.user.id, "fleet_management");
    if (!access.allowed) {
      return NextResponse.json({
        error: "현재 요금제에서는 법인차량 관리 기능을 사용할 수 없습니다. Pro 이상으로 업그레이드해주세요.",
        requiredPlan: access.requiredPlan,
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      clientCompanyId, plateNumber, vehicleType,
      manufacturer, modelName, modelYear,
      registrationDate, purchaseDate, purchasePrice,
      displacement, fuelType, color,
      insuranceCompany, insuranceExpiry, inspectionExpiry,
      currentMileage, assignedDriver, purpose,
      ownershipType, leaseCompany, leaseExpiry, monthlyPayment,
      status, memo,
    } = body;

    // 필수 필드 검증
    if (!plateNumber || !vehicleType) {
      return NextResponse.json(
        { error: "차량번호와 차종은 필수입니다." },
        { status: 400 }
      );
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

    // 동일 차량번호 중복 검사
    const existing = await prisma.vehicle.findFirst({
      where: { userId: session.user.id, plateNumber, isActive: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "이미 등록된 차량번호입니다." },
        { status: 409 }
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        userId: session.user.id,
        clientCompanyId: clientCompanyId || null,
        plateNumber,
        vehicleType,
        manufacturer: manufacturer || null,
        modelName: modelName || null,
        modelYear: modelYear ? Number(modelYear) : null,
        registrationDate: registrationDate ? new Date(registrationDate) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchasePrice: purchasePrice ? Number(purchasePrice) : null,
        displacement: displacement ? Number(displacement) : null,
        fuelType: fuelType || null,
        color: color || null,
        insuranceCompany: insuranceCompany || null,
        insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
        inspectionExpiry: inspectionExpiry ? new Date(inspectionExpiry) : null,
        currentMileage: currentMileage ? Number(currentMileage) : null,
        assignedDriver: assignedDriver || null,
        purpose: purpose || null,
        ownershipType: ownershipType || "owned",
        leaseCompany: leaseCompany || null,
        leaseExpiry: leaseExpiry ? new Date(leaseExpiry) : null,
        monthlyPayment: monthlyPayment ? Number(monthlyPayment) : null,
        status: status || "active",
        memo: memo || null,
      },
      include: {
        clientCompany: { select: { id: true, companyName: true } },
      },
    });

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (error) {
    console.error("[Vehicles POST] Error:", error);
    return NextResponse.json({ error: "차량 등록 실패" }, { status: 500 });
  }
}
