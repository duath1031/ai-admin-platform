export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// BigInt JSON 직렬화 헬퍼
function serializeClient(client: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(client)) {
    result[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return result;
}

// GET - 거래처 목록 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clients = await prisma.clientCompany.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { companyName: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: clients.map((c) => serializeClient(c as unknown as Record<string, unknown>)),
    });
  } catch (error) {
    console.error("Client companies fetch error:", error);
    return NextResponse.json({ error: "거래처 목록 조회 실패" }, { status: 500 });
  }
}

// POST - 거래처 등록
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.companyName) {
      return NextResponse.json({ error: "거래처 상호를 입력해주세요." }, { status: 400 });
    }

    const client = await prisma.clientCompany.create({
      data: {
        userId: session.user.id,
        // 유형 (company / individual)
        clientType: body.clientType || "company",
        // 기본 정보
        companyName: body.companyName,
        ownerName: body.ownerName || null,
        bizRegNo: body.bizRegNo || null,
        address: body.address || null,
        phone: body.phone || null,
        npBizNo: body.npBizNo || null,
        hiBizNo: body.hiBizNo || null,
        eiBizNo: body.eiBizNo || null,
        memo: body.memo || null,
        // 개인 의뢰인 정보
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        nationality: body.nationality || null,
        isForeigner: Boolean(body.isForeigner),
        visaType: body.visaType || null,
        visaExpiry: body.visaExpiry ? new Date(body.visaExpiry) : null,
        visaStatus: body.visaStatus || null,
        alienRegNo: body.alienRegNo || null,
        alienRegExpiry: body.alienRegExpiry ? new Date(body.alienRegExpiry) : null,
        email: body.email || null,
        // 식별 상세
        ceoGender: body.ceoGender || null,
        corpRegNo: body.corpRegNo || null,
        bizType: body.bizType || null,
        foundedDate: body.foundedDate ? new Date(body.foundedDate) : null,
        // 업종 상세
        businessSector: body.businessSector || null,
        industryCode: body.industryCode || null,
        industryName: body.industryName || null,
        businessSubType: body.businessSubType || null,
        // 재무 정보
        revenueYear1: body.revenueYear1 != null ? BigInt(body.revenueYear1) : null,
        revenueYear2: body.revenueYear2 != null ? BigInt(body.revenueYear2) : null,
        revenueYear3: body.revenueYear3 != null ? BigInt(body.revenueYear3) : null,
        revenueLabel1: body.revenueLabel1 || null,
        revenueLabel2: body.revenueLabel2 || null,
        revenueLabel3: body.revenueLabel3 || null,
        operatingProfitYear1: body.operatingProfitYear1 != null ? BigInt(body.operatingProfitYear1) : null,
        operatingProfitYear2: body.operatingProfitYear2 != null ? BigInt(body.operatingProfitYear2) : null,
        operatingProfitYear3: body.operatingProfitYear3 != null ? BigInt(body.operatingProfitYear3) : null,
        netIncomeYear1: body.netIncomeYear1 != null ? BigInt(body.netIncomeYear1) : null,
        netIncomeYear2: body.netIncomeYear2 != null ? BigInt(body.netIncomeYear2) : null,
        netIncomeYear3: body.netIncomeYear3 != null ? BigInt(body.netIncomeYear3) : null,
        totalAssets: body.totalAssets != null ? BigInt(body.totalAssets) : null,
        totalLiabilities: body.totalLiabilities != null ? BigInt(body.totalLiabilities) : null,
        capital: body.capital != null ? BigInt(body.capital) : null,
        rndExpenditure: body.rndExpenditure != null ? BigInt(body.rndExpenditure) : null,
        exportAmount: body.exportAmount != null ? BigInt(body.exportAmount) : null,
        // 고용 정보
        employeeCount: Number(body.employeeCount) || 0,
        permanentEmployees: body.permanentEmployees != null ? Number(body.permanentEmployees) : null,
        contractEmployees: body.contractEmployees != null ? Number(body.contractEmployees) : null,
        researcherCount: body.researcherCount != null ? Number(body.researcherCount) : null,
        foreignEmployees: body.foreignEmployees != null ? Number(body.foreignEmployees) : null,
        // 연구소
        hasResearchInstitute: Boolean(body.hasResearchInstitute),
        hasRndDepartment: Boolean(body.hasRndDepartment),
        researchInstituteDate: body.researchInstituteDate ? new Date(body.researchInstituteDate) : null,
        // 제조업
        isManufacturer: Boolean(body.isManufacturer),
        manufacturingItems: body.manufacturingItems || null,
        factoryAddress: body.factoryAddress || null,
        factoryArea: body.factoryArea || null,
        manufacturingCerts: body.manufacturingCerts || null,
        mainRawMaterials: body.mainRawMaterials || null,
        // 조달
        isG2bRegistered: Boolean(body.isG2bRegistered),
        g2bRegistrationNumber: body.g2bRegistrationNumber || null,
        mainProducts: body.mainProducts || null,
        hasDirectProductionCert: Boolean(body.hasDirectProductionCert),
        hasMasContract: Boolean(body.hasMasContract),
        // 수출/외국인
        isExporter: Boolean(body.isExporter),
        exportCountries: body.exportCountries || null,
        hasForeignWorkers: Boolean(body.hasForeignWorkers),
        foreignWorkerVisaTypes: body.foreignWorkerVisaTypes || null,
        // 인증
        isVentureCertified: Boolean(body.isVentureCertified),
        ventureExpiry: body.ventureExpiry ? new Date(body.ventureExpiry) : null,
        isInnobiz: Boolean(body.isInnobiz),
        isMainbiz: Boolean(body.isMainbiz),
        isISO9001: Boolean(body.isISO9001),
        isISO14001: Boolean(body.isISO14001),
        isISO45001: Boolean(body.isISO45001),
        isWomenBiz: Boolean(body.isWomenBiz),
        isSocialEnterprise: Boolean(body.isSocialEnterprise),
        isRootCompany: Boolean(body.isRootCompany),
        otherCertifications: body.otherCertifications || null,
        // 특허/지식재산권
        patentCount: Number(body.patentCount) || 0,
        utilityModelCount: Number(body.utilityModelCount) || 0,
        designPatentCount: Number(body.designPatentCount) || 0,
        trademarkCount: Number(body.trademarkCount) || 0,
        swCopyrightCount: Number(body.swCopyrightCount) || 0,
        patentDetails: body.patentDetails || null,
        // 메타
        profileCompleteness: Number(body.profileCompleteness) || 0,
      },
    });

    // 비자 만료일 / 외국인등록증 만료일 알림 자동 생성
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
              referenceId: client.id,
              title: `[${body.companyName}] 비자(${body.visaType || ""}) 만료 ${alertType.replace("d-", "D-")}`,
              deadline: alertDate,
              alertType,
              channel: "in_app",
            },
          });
        }
      }
    }

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
              referenceId: client.id,
              title: `[${body.companyName}] 외국인등록증 만료 ${alertType.replace("d-", "D-")}`,
              deadline: alertDate,
              alertType,
              channel: "in_app",
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: serializeClient(client as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Client company create error:", error);
    return NextResponse.json({ error: "거래처 등록 실패" }, { status: 500 });
  }
}
