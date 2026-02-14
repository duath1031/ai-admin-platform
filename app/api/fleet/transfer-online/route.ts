/**
 * 온라인 이전등록 대행 API
 * POST /api/fleet/transfer-online - 대행 신청 접수
 * GET  /api/fleet/transfer-online - 내 대행 접수 목록 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── 접수번호 생성: VT-YYYYMMDD-XXXX ──
function generateRequestNumber(): string {
  const now = new Date();
  const dateStr =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VT-${dateStr}-${random}`;
}

// ── POST: 대행 신청 접수 ──
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();

    // 필수 필드 검증
    if (!body.sellerName || !body.buyerName || !body.vehicleName) {
      return NextResponse.json(
        { error: "양도인 성명, 양수인 성명, 차명은 필수입니다." },
        { status: 400 }
      );
    }

    if (!body.salePrice || body.salePrice <= 0) {
      return NextResponse.json(
        { error: "매매금액은 필수입니다." },
        { status: 400 }
      );
    }

    const requestNumber = generateRequestNumber();
    const transferDate = body.transferDate || new Date().toISOString().substring(0, 10);
    const agencyFee = body.agencyFee || 16500;

    // 비용 정보 구성
    const costBreakdown = body.costBreakdown || {};
    const totalCost = (costBreakdown.totalCost || 0) + agencyFee;

    // documentsJson에 신청 정보 전체 저장
    const applicationData = {
      requestNumber,
      transferType: "online_agent",
      seller: {
        name: body.sellerName,
        idNumber: body.sellerIdNumber || "",
        address: body.sellerAddress || "",
        phone: body.sellerPhone || "",
      },
      buyer: {
        name: body.buyerName,
        idNumber: body.buyerIdNumber || "",
        address: body.buyerAddress || "",
        phone: body.buyerPhone || "",
      },
      vehicle: {
        name: body.vehicleName,
        type: body.vehicleType || "sedan",
        vin: body.vin || "",
        plateNumber: body.plateNumber || "",
        modelYear: body.modelYear || null,
        displacement: body.displacement || null,
        color: body.color || "",
        mileage: body.mileage || null,
      },
      transaction: {
        salePrice: body.salePrice,
        transferDate,
        transferReason: body.transferReason || "매매",
        region: body.region || "서울",
      },
      agent: {
        name: body.agentName || "",
        idNumber: body.agentIdNumber || "",
        address: body.agentAddress || "",
        phone: body.agentPhone || "",
      },
      specialTerms: body.specialTerms || "",
      costBreakdown: {
        ...costBreakdown,
        agencyFee,
        totalEstimated: totalCost,
      },
      attachedFiles: body.attachedFiles || [],
      discountOptions: {
        isElectric: body.isElectric || false,
        isHybrid: body.isHybrid || false,
        isDisabled: body.isDisabled || false,
        isMultiChild: body.isMultiChild || false,
        isFirstCar: body.isFirstCar || false,
      },
      requestedAt: new Date().toISOString(),
    };

    // 사용자의 차량 중 동일 등록번호가 있는지 확인
    let vehicleId: string | null = null;
    if (body.plateNumber) {
      const existingVehicle = await prisma.vehicle.findFirst({
        where: {
          userId: session.user.id,
          plateNumber: body.plateNumber,
          isActive: true,
        },
      });
      if (existingVehicle) {
        vehicleId = existingVehicle.id;
      }
    }

    // 차량이 없으면 임시 차량 생성
    if (!vehicleId) {
      const newVehicle = await prisma.vehicle.create({
        data: {
          userId: session.user.id,
          plateNumber: body.plateNumber || `TEMP-${requestNumber}`,
          vehicleType: body.vehicleType || "sedan",
          modelName: body.vehicleName,
          modelYear: body.modelYear ? Number(body.modelYear) : null,
          displacement: body.displacement ? Number(body.displacement) : null,
          color: body.color || null,
          currentMileage: body.mileage ? Number(body.mileage) : null,
          purchasePrice: body.salePrice ? Number(body.salePrice) : null,
          status: "active",
        },
      });
      vehicleId = newVehicle.id;
    }

    // VehicleTransfer DB 저장
    const transfer = await prisma.vehicleTransfer.create({
      data: {
        vehicleId,
        userId: session.user.id,
        transferType: "online_agent",
        transferDate: new Date(transferDate),
        counterparty: body.buyerName,
        transferPrice: body.salePrice ? Number(body.salePrice) : null,
        acquisitionTax: costBreakdown.acquisitionTax || null,
        registrationTax: costBreakdown.registrationTax || null,
        educationTax: costBreakdown.educationTax || null,
        bondAmount: null,
        bondDiscount: costBreakdown.bondDiscount || null,
        stampTax: costBreakdown.stampTax || null,
        totalCost: totalCost || null,
        documentsJson: JSON.stringify(applicationData),
        status: "requested",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          requestId: transfer.id,
          requestNumber,
          status: transfer.status,
          estimatedCost: totalCost,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Transfer Online POST] Error:", error);
    return NextResponse.json(
      { error: "대행 접수에 실패했습니다." },
      { status: 500 }
    );
  }
}

// ── GET: 내 대행 접수 목록 ──
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const whereClause: Record<string, unknown> = {
      userId: session.user.id,
      transferType: "online_agent",
    };

    if (status) {
      whereClause.status = status;
    }

    const transfers = await prisma.vehicleTransfer.findMany({
      where: whereClause,
      include: {
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            vehicleType: true,
            modelName: true,
            modelYear: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // documentsJson에서 접수번호 등 추출
    const data = transfers.map((t) => {
      let applicationData: Record<string, unknown> = {};
      try {
        applicationData = t.documentsJson ? JSON.parse(t.documentsJson) : {};
      } catch {
        applicationData = {};
      }

      return {
        id: t.id,
        requestNumber: applicationData.requestNumber || "-",
        status: t.status,
        vehicleId: t.vehicleId,
        vehicle: t.vehicle,
        counterparty: t.counterparty,
        transferPrice: t.transferPrice,
        totalCost: t.totalCost,
        transferDate: t.transferDate,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        seller: applicationData.seller || null,
        buyer: applicationData.buyer || null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[Transfer Online GET] Error:", error);
    return NextResponse.json(
      { error: "접수 목록 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
