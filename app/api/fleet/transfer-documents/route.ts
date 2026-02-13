/**
 * 자동차 이전등록 서류 생성 API
 * POST /api/fleet/transfer-documents - 서류 4종 데이터 생성 + VehicleTransfer 저장
 *
 * 서류 4종:
 * 1. transfer_application - 이전등록신청서
 * 2. transfer_certificate - 양도증명서
 * 3. power_of_attorney - 위임장
 * 4. sale_contract - 매매계약서
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface TransferDocumentInput {
  // 차량 연결 (선택)
  vehicleId?: string;

  // 양도인(매도인) 정보
  sellerName: string;
  sellerIdNumber?: string;  // 주민등록번호
  sellerAddress?: string;
  sellerPhone?: string;

  // 양수인(매수인) 정보
  buyerName: string;
  buyerIdNumber?: string;   // 주민등록번호 또는 사업자번호
  buyerAddress?: string;
  buyerPhone?: string;

  // 차량 정보
  vehicleName: string;      // 차명
  vehicleType?: string;     // 차종 (승용, SUV 등)
  vin?: string;             // 차대번호
  plateNumber?: string;     // 등록번호
  modelYear?: number;       // 연식
  displacement?: number;    // 배기량
  color?: string;           // 색상
  mileage?: number;         // 주행거리 (km)

  // 거래 정보
  salePrice?: number;       // 매매금액
  transferDate?: string;    // 양도일자 (YYYY-MM-DD)
  transferReason?: string;  // 이전사유 (매매/증여/상속/기타)

  // 대리인 정보 (위임장용)
  agentName?: string;
  agentIdNumber?: string;
  agentAddress?: string;
  agentPhone?: string;

  // 특약사항 (매매계약서용)
  specialTerms?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body: TransferDocumentInput = await request.json();

    // 필수 필드 검증
    if (!body.sellerName || !body.buyerName || !body.vehicleName) {
      return NextResponse.json(
        { error: "양도인 성명, 양수인 성명, 차명은 필수입니다." },
        { status: 400 }
      );
    }

    // 차량 연결 시 소유권 확인
    if (body.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: body.vehicleId, userId: session.user.id },
      });
      if (!vehicle) {
        return NextResponse.json(
          { error: "해당 차량을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
    }

    const today = new Date().toISOString().substring(0, 10);
    const transferDate = body.transferDate || today;

    // 서류 4종 데이터 구성
    const documents = {
      transfer_application: {
        type: "transfer_application",
        title: "자동차이전등록신청서",
        data: {
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
            type: body.vehicleType || "",
            vin: body.vin || "",
            plateNumber: body.plateNumber || "",
            modelYear: body.modelYear || null,
            displacement: body.displacement || null,
            color: body.color || "",
            purpose: "자가용",
          },
          transferDate,
          transferReason: body.transferReason || "매매",
        },
      },
      transfer_certificate: {
        type: "transfer_certificate",
        title: "양도증명서",
        data: {
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
            type: body.vehicleType || "",
            vin: body.vin || "",
            plateNumber: body.plateNumber || "",
            modelYear: body.modelYear || null,
          },
          salePrice: body.salePrice || 0,
          transferDate,
        },
      },
      power_of_attorney: {
        type: "power_of_attorney",
        title: "위임장",
        data: {
          delegator: {
            name: body.buyerName,
            idNumber: body.buyerIdNumber || "",
            address: body.buyerAddress || "",
            phone: body.buyerPhone || "",
          },
          agent: {
            name: body.agentName || "",
            idNumber: body.agentIdNumber || "",
            address: body.agentAddress || "",
            phone: body.agentPhone || "",
          },
          vehicle: {
            name: body.vehicleName,
            vin: body.vin || "",
            plateNumber: body.plateNumber || "",
          },
          delegationScope: "자동차이전등록 신청 일체",
          delegationDate: transferDate,
        },
      },
      sale_contract: {
        type: "sale_contract",
        title: "자동차매매계약서",
        data: {
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
            type: body.vehicleType || "",
            vin: body.vin || "",
            plateNumber: body.plateNumber || "",
            modelYear: body.modelYear || null,
            displacement: body.displacement || null,
            color: body.color || "",
            mileage: body.mileage || null,
          },
          salePrice: body.salePrice || 0,
          contractDate: transferDate,
          specialTerms: body.specialTerms || "",
        },
      },
    };

    // VehicleTransfer DB 저장
    let transfer = null;
    if (body.vehicleId) {
      transfer = await prisma.vehicleTransfer.create({
        data: {
          vehicleId: body.vehicleId,
          userId: session.user.id,
          transferType: "sale",
          transferDate: new Date(transferDate),
          counterparty: body.buyerName,
          transferPrice: body.salePrice || null,
          documentsJson: JSON.stringify(
            Object.keys(documents).map((key) => ({
              type: key,
              title: documents[key as keyof typeof documents].title,
              generatedAt: new Date().toISOString(),
            }))
          ),
          status: "pending",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        documents,
        transfer,
        generatedAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[Transfer Documents POST] Error:", error);
    return NextResponse.json(
      { error: "서류 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
