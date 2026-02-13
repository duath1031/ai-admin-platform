/**
 * 직접생산확인 자가진단 API
 * POST /api/procurement/direct-production-check
 *
 * 조달청 직접생산확인증명 취득을 위한 사전 점검 도구.
 * 5개 카테고리(생산설비/인력/품질/실적/서류)를 평가하여
 * 100점 만점 기준 합격 여부, 등급, 개선사항을 안내합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deductTokens } from '@/lib/token/tokenService';
import { checkFeatureAccess } from '@/lib/token/planAccess';
import { runDiagnosis, DiagnosisInput } from '@/lib/procurement/directProductionChecker';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // 플랜 체크
    const access = await checkFeatureAccess(userId, 'direct_production_check');
    if (!access.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: '직접생산확인 자가진단은 Standard 이상 플랜에서 사용 가능합니다.',
          requiredPlan: access.requiredPlan,
        },
        { status: 403 },
      );
    }

    // 토큰 차감
    const deducted = await deductTokens(userId, 'direct_production_check');
    if (!deducted) {
      return NextResponse.json(
        { success: false, error: '토큰이 부족합니다. 충전 후 다시 시도해주세요.' },
        { status: 402 },
      );
    }

    // 요청 바디 파싱
    const body = await request.json();
    const input: DiagnosisInput = {
      companyName: body.companyName || '',
      bizRegNo: body.bizRegNo || '',
      productName: body.productName || '',
      productCategory: body.productCategory || '',

      hasFactory: !!body.hasFactory,
      factoryOwnership: body.factoryOwnership || 'none',
      hasProductionEquipment: !!body.hasProductionEquipment,
      equipmentList: body.equipmentList || '',
      hasRawMaterialStorage: !!body.hasRawMaterialStorage,

      totalEmployees: Number(body.totalEmployees) || 0,
      productionWorkers: Number(body.productionWorkers) || 0,
      hasTechnician: !!body.hasTechnician,

      hasQualitySystem: !!body.hasQualitySystem,
      hasQualityInspector: !!body.hasQualityInspector,
      hasTestEquipment: !!body.hasTestEquipment,
      hasISO9001: !!body.hasISO9001,
      hasKSCertification: !!body.hasKSCertification,

      hasProductionRecord: !!body.hasProductionRecord,
      recentYearRevenue: Number(body.recentYearRevenue) || 0,

      hasBizRegistration: !!body.hasBizRegistration,
      hasFactoryRegistration: !!body.hasFactoryRegistration,
      hasEnvironmentPermit: !!body.hasEnvironmentPermit,
    };

    // 진단 실행
    const result = runDiagnosis(input);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('[direct-production-check] Error:', error);
    return NextResponse.json(
      { success: false, error: '진단 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
