export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function serializeClient(client: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(client)) {
    result[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return result;
}

// GET - 거래처 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const client = await prisma.clientCompany.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!client) {
      return NextResponse.json({ error: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: serializeClient(client as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Client company fetch error:", error);
    return NextResponse.json({ error: "거래처 조회 실패" }, { status: 500 });
  }
}

// PUT - 거래처 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.clientCompany.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    // 업데이트 데이터 빌드 (undefined면 기존값 유지)
    const updateData: Record<string, unknown> = {};
    const stringFields = [
      "companyName", "ownerName", "bizRegNo", "address", "phone",
      "npBizNo", "hiBizNo", "eiBizNo", "memo",
      "clientType", "nationality", "visaType", "visaStatus", "alienRegNo", "email",
      "ceoGender", "corpRegNo", "bizType",
      "businessSector", "industryCode", "industryName", "businessSubType",
      "revenueLabel1", "revenueLabel2", "revenueLabel3",
      "manufacturingItems", "factoryAddress", "factoryArea", "manufacturingCerts", "mainRawMaterials",
      "g2bRegistrationNumber", "mainProducts",
      "exportCountries", "foreignWorkerVisaTypes",
      "otherCertifications", "patentDetails",
    ];
    for (const f of stringFields) {
      if (body[f] !== undefined) updateData[f] = body[f] || null;
    }

    // Date fields
    if (body.foundedDate !== undefined) updateData.foundedDate = body.foundedDate ? new Date(body.foundedDate) : null;
    if (body.researchInstituteDate !== undefined) updateData.researchInstituteDate = body.researchInstituteDate ? new Date(body.researchInstituteDate) : null;
    if (body.ventureExpiry !== undefined) updateData.ventureExpiry = body.ventureExpiry ? new Date(body.ventureExpiry) : null;
    if (body.birthDate !== undefined) updateData.birthDate = body.birthDate ? new Date(body.birthDate) : null;
    if (body.visaExpiry !== undefined) updateData.visaExpiry = body.visaExpiry ? new Date(body.visaExpiry) : null;
    if (body.alienRegExpiry !== undefined) updateData.alienRegExpiry = body.alienRegExpiry ? new Date(body.alienRegExpiry) : null;

    // BigInt fields
    const bigintFields = [
      "revenueYear1", "revenueYear2", "revenueYear3",
      "operatingProfitYear1", "operatingProfitYear2", "operatingProfitYear3",
      "netIncomeYear1", "netIncomeYear2", "netIncomeYear3",
      "totalAssets", "totalLiabilities", "capital", "rndExpenditure", "exportAmount",
    ];
    for (const f of bigintFields) {
      if (body[f] !== undefined) updateData[f] = body[f] != null ? BigInt(body[f]) : null;
    }

    // Int fields
    const intFields = [
      "employeeCount", "permanentEmployees", "contractEmployees", "researcherCount", "foreignEmployees", "profileCompleteness",
      "patentCount", "utilityModelCount", "designPatentCount", "trademarkCount", "swCopyrightCount",
    ];
    for (const f of intFields) {
      if (body[f] !== undefined) updateData[f] = body[f] != null ? Number(body[f]) : null;
    }

    // Boolean fields
    const boolFields = [
      "hasResearchInstitute", "hasRndDepartment", "isManufacturer",
      "isG2bRegistered", "hasDirectProductionCert", "hasMasContract",
      "isExporter", "hasForeignWorkers", "isForeigner",
      "isVentureCertified", "isInnobiz", "isMainbiz",
      "isISO9001", "isISO14001", "isISO45001",
      "isWomenBiz", "isSocialEnterprise", "isRootCompany",
    ];
    for (const f of boolFields) {
      if (body[f] !== undefined) updateData[f] = Boolean(body[f]);
    }

    const client = await prisma.clientCompany.update({
      where: { id },
      data: updateData,
    });

    // 비자 만료일이 변경되었으면 기존 알림 삭제 후 재생성
    if (body.visaExpiry !== undefined) {
      await prisma.deadlineAlert.deleteMany({
        where: { userId: session.user.id, referenceType: "visa_expiry", referenceId: id },
      });
      if (body.visaExpiry) {
        const visaDate = new Date(body.visaExpiry);
        for (const alertType of ["d-30", "d-7", "d-3", "d-1"] as const) {
          const daysMap = { "d-30": 30, "d-7": 7, "d-3": 3, "d-1": 1 };
          const alertDate = new Date(visaDate);
          alertDate.setDate(alertDate.getDate() - daysMap[alertType]);
          if (alertDate > new Date()) {
            await prisma.deadlineAlert.create({
              data: {
                userId: session.user.id,
                referenceType: "visa_expiry",
                referenceId: id,
                title: `[${client.companyName}] 비자(${body.visaType || client.visaType || ""}) 만료 ${alertType.replace("d-", "D-")}`,
                deadline: alertDate,
                alertType,
                channel: "in_app",
              },
            });
          }
        }
      }
    }

    if (body.alienRegExpiry !== undefined) {
      await prisma.deadlineAlert.deleteMany({
        where: { userId: session.user.id, referenceType: "alien_reg_expiry", referenceId: id },
      });
      if (body.alienRegExpiry) {
        const alienDate = new Date(body.alienRegExpiry);
        for (const alertType of ["d-30", "d-7"] as const) {
          const daysMap = { "d-30": 30, "d-7": 7 };
          const alertDate = new Date(alienDate);
          alertDate.setDate(alertDate.getDate() - daysMap[alertType]);
          if (alertDate > new Date()) {
            await prisma.deadlineAlert.create({
              data: {
                userId: session.user.id,
                referenceType: "alien_reg_expiry",
                referenceId: id,
                title: `[${client.companyName}] 외국인등록증 만료 ${alertType.replace("d-", "D-")}`,
                deadline: alertDate,
                alertType,
                channel: "in_app",
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: serializeClient(client as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Client company update error:", error);
    return NextResponse.json({ error: "거래처 수정 실패" }, { status: 500 });
  }
}

// DELETE - 거래처 삭제 (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.clientCompany.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.clientCompany.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Client company delete error:", error);
    return NextResponse.json({ error: "거래처 삭제 실패" }, { status: 500 });
  }
}
