/**
 * 직접생산확인 자가진단 API (smpp.go.kr 기반 재설계)
 * POST /api/procurement/direct-production-check
 *
 * 37개 업종 카테고리, 4대 요건(생산공장/생산시설/생산인력/생산공정) 각 25점
 * 핵심공정 직접 수행 여부가 핵심 판정 기준
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deductTokens } from "@/lib/token/tokenService";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { runDiagnosis, DiagnosisInput } from "@/lib/procurement/directProductionChecker";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 플랜 체크
    const access = await checkFeatureAccess(userId, "direct_production_check");
    if (!access.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "직접생산확인 자가진단은 Standard 이상 플랜에서 사용 가능합니다.",
          requiredPlan: access.requiredPlan,
        },
        { status: 403 }
      );
    }

    // 토큰 차감
    const deducted = await deductTokens(userId, "direct_production_check");
    if (!deducted) {
      return NextResponse.json(
        {
          success: false,
          error: "토큰이 부족합니다. 충전 후 다시 시도해주세요.",
        },
        { status: 402 }
      );
    }

    // 요청 바디 파싱
    const body = await request.json();

    const input: DiagnosisInput = {
      companyName: body.companyName || "",
      bizRegNo: body.bizRegNo || "",
      productName: body.productName || "",
      industryCode: body.industryCode || "37",

      // 1. 생산공장
      hasProductionSite: !!body.hasProductionSite,
      siteType: body.siteType || "none",
      siteArea: body.siteArea != null ? Number(body.siteArea) : undefined,
      siteAddress: body.siteAddress || "",

      // 2. 생산시설
      hasMainEquipment: !!body.hasMainEquipment,
      equipmentOwnership: body.equipmentOwnership || "owned",
      equipmentList: body.equipmentList || "",
      hasMeasuringInstruments: !!body.hasMeasuringInstruments,

      // 3. 생산인력
      totalEmployees: Number(body.totalEmployees) || 0,
      productionWorkers: Number(body.productionWorkers) || 0,
      hasTechnicalStaff: !!body.hasTechnicalStaff,
      hasQualityInspector: !!body.hasQualityInspector,

      // 4. 생산공정
      performsCoreProcess: !!body.performsCoreProcess,
      coreProcessList: Array.isArray(body.coreProcessList)
        ? body.coreProcessList
        : [],
      outsourcedProcesses: Array.isArray(body.outsourcedProcesses)
        ? body.outsourcedProcesses
        : [],
      hasProcessDocumentation: !!body.hasProcessDocumentation,

      // 추가 항목
      hasProductionRecord: !!body.hasProductionRecord,
      hasBizRegistration: !!body.hasBizRegistration,
      hasQualityCertification: !!body.hasQualityCertification,
      isSmallBiz: !!body.isSmallBiz,
    };

    // 진단 실행
    const result = runDiagnosis(input);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("[direct-production-check] Error:", error);
    return NextResponse.json(
      { success: false, error: "진단 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
