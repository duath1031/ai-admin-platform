/**
 * 온라인 이전등록 대행 API
 * POST /api/fleet/transfer-online - 대행 신청 접수
 * GET  /api/fleet/transfer-online - 내 대행 접수 목록 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailService } from "@/lib/notification/email";

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
      transferType: body.serviceType || "agent_visit",
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

    const serviceType = body.serviceType || "agent_visit";

    // VehicleTransfer DB 저장
    const transfer = await prisma.vehicleTransfer.create({
      data: {
        vehicleId,
        userId: session.user.id,
        transferType: serviceType === "online_self" ? "online_self" : "online_agent",
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

    // ── 관리자 이메일 알림 발송 (행정사 방문 대행 시) ──
    const adminEmails = ["Lawyeom@naver.com", "duath1031@gmail.com"];
    const saleAmount = body.salePrice ? Number(body.salePrice).toLocaleString() : "-";
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>
        body { font-family: 'Apple SD Gothic Neo', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; background: #f9fafb; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .label { color: #6b7280; font-size: 14px; }
        .value { color: #111827; font-weight: 600; font-size: 14px; }
        .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
        .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
      </style></head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0;">자동차 이전등록 대행 접수</h2>
            <p style="margin:5px 0 0;font-size:14px;opacity:0.9;">새로운 접수가 도착했습니다</p>
          </div>
          <div class="content">
            <p><span class="badge">${serviceType === "online_self" ? "온라인 직접" : "행정사 방문"}</span> &nbsp; 접수번호: <strong>${requestNumber}</strong></p>
            <div style="margin:15px 0;">
              <div class="info-row"><span class="label">양도인 (매도인)</span><span class="value">${body.sellerName} ${body.sellerPhone ? "/ " + body.sellerPhone : ""}</span></div>
              <div class="info-row"><span class="label">양수인 (매수인)</span><span class="value">${body.buyerName} ${body.buyerPhone ? "/ " + body.buyerPhone : ""}</span></div>
              <div class="info-row"><span class="label">차량</span><span class="value">${body.vehicleName} (${body.plateNumber || "-"})</span></div>
              <div class="info-row"><span class="label">매매금액</span><span class="value">${saleAmount}원</span></div>
              <div class="info-row"><span class="label">양도일자</span><span class="value">${transferDate}</span></div>
              <div class="info-row"><span class="label">등록 지역</span><span class="value">${body.region || "서울"}</span></div>
              <div class="info-row"><span class="label">예상 비용</span><span class="value">${totalCost ? totalCost.toLocaleString() + "원" : "미계산"}</span></div>
              ${body.specialTerms ? `<div class="info-row"><span class="label">특약사항</span><span class="value">${body.specialTerms}</span></div>` : ""}
            </div>
            <p style="font-size:13px;color:#6b7280;">신청자에게 확인 연락을 해주세요.</p>
          </div>
          <div class="footer">AI 행정사 어드미니 | admini.co.kr</div>
        </div>
      </body>
      </html>
    `;

    // 비동기로 이메일 발송 (응답 지연 방지)
    Promise.allSettled(
      adminEmails.map((email) =>
        emailService.send({
          to: email,
          subject: `[어드미니] 이전등록 대행 접수 - ${body.vehicleName} (${requestNumber})`,
          html: emailHtml,
          text: `이전등록 대행 접수\n접수번호: ${requestNumber}\n양도인: ${body.sellerName}\n양수인: ${body.buyerName}\n차량: ${body.vehicleName} (${body.plateNumber || "-"})\n매매금액: ${saleAmount}원\n지역: ${body.region || "서울"}`,
        })
      )
    ).then((results) => {
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(`[Transfer Email] Failed to send to ${adminEmails[i]}:`, r.reason);
        } else {
          console.log(`[Transfer Email] Sent to ${adminEmails[i]}:`, r.value);
        }
      });
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
