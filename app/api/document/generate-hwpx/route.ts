/**
 * =============================================================================
 * HWPX Generation API (Phase 9 - The Writer)
 * =============================================================================
 * POST /api/document/generate-hwpx
 *   템플릿 코드와 사용자 데이터를 받아 HWPX 생성
 *
 * GET /api/document/generate-hwpx?code=xxx
 *   HWPX 템플릿 목록 조회 또는 특정 템플릿 상세 조회
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateHwpx, saveHwpxToTemp, extractPlaceholders } from '@/lib/hwpx';
import * as path from 'path';

// =============================================================================
// Data Transformation: User Input → HWPX Placeholders
// =============================================================================

/**
 * 사용자 입력 데이터를 HWPX 플레이스홀더 형태로 변환.
 * - select 필드 → check_XXX 체크박스 (■/□)
 * - date 필드 → 연도/월/일 분리
 * - address → 관할관청 자동 매핑
 */
function transformDataForHwpx(
  data: Record<string, string>,
  fields: Array<{ name: string; type: string; options?: string[]; checkPrefix?: string }>
): Record<string, string> {
  const result: Record<string, string> = {};

  // 직접 매핑 복사
  for (const [key, value] of Object.entries(data)) {
    result[key] = String(value);
  }

  // 1. 체크박스 확장 (select → check_XXX)
  // checkPrefix가 있으면 check_{prefix}{option}, 없으면 check_{option}
  for (const field of fields) {
    if (field.type === 'select' && field.options?.length) {
      const selectedValue = data[field.name] || '';
      const selectedNormalized = selectedValue.replace(/[\s·ㆍ\-]/g, '');
      const prefix = field.checkPrefix || '';
      for (const option of field.options) {
        const normalized = option.replace(/[\s·ㆍ\-]/g, '');
        const checkKey = `check_${prefix}${normalized}`;
        result[checkKey] = (normalized === selectedNormalized || option === selectedValue) ? '■' : '□';
      }
    }
  }

  // 2. 날짜 분리 (date → 연도/월/일)
  let dateParsed = false;
  for (const field of fields) {
    if (field.type === 'date' && data[field.name]) {
      const date = new Date(data[field.name]);
      if (!isNaN(date.getTime())) {
        result['신고연도'] = String(date.getFullYear());
        result['신고월'] = String(date.getMonth() + 1);
        result['신고일'] = String(date.getDate());
        result['신청연도'] = String(date.getFullYear());
        result['신청월'] = String(date.getMonth() + 1);
        result['신청일'] = String(date.getDate());
        dateParsed = true;
      }
    }
  }

  // 날짜가 없으면 오늘 날짜 사용
  if (!dateParsed && !result['신고연도']) {
    const today = new Date();
    result['신고연도'] = String(today.getFullYear());
    result['신고월'] = String(today.getMonth() + 1);
    result['신고일'] = String(today.getDate());
    result['신청연도'] = String(today.getFullYear());
    result['신청월'] = String(today.getMonth() + 1);
    result['신청일'] = String(today.getDate());
  }

  // 3. 관할관청 자동 매핑
  const address = data['영업장소재지'] || data['주소'] || data['소재지'] || '';
  if (address && !result['관할관청']) {
    result['관할관청'] = deriveJurisdiction(address);
  }

  console.log('[API] 데이터 변환:', Object.keys(result).length, '키,',
    Object.keys(result).filter(k => k.startsWith('check_')).length, '체크박스');
  return result;
}

/**
 * 주소에서 관할관청 추출
 * "인천광역시 계양구 XXX" → "인천광역시 계양구청장"
 */
function deriveJurisdiction(address: string): string {
  // 광역시/특별시 + 구
  const metroMatch = address.match(
    /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시)\s+([\w가-힣]+구)/
  );
  if (metroMatch) return `${metroMatch[1]} ${metroMatch[2]}청장`;

  // 세종특별자치시
  if (address.includes('세종특별자치시')) return '세종특별자치시장';

  // 도 + 시/군
  const doMatch = address.match(
    /(경기도|충청[남북]도|전라[남북]도|전북특별자치도|경상[남북]도|강원특별자치도|제주특별자치도)\s+([\w가-힣]+[시군])/
  );
  if (doMatch) {
    const district = doMatch[2];
    if (district.endsWith('군')) return `${doMatch[1]} ${district}수`;
    return `${doMatch[1]} ${district}장`;
  }

  // 단순 구/군/시 매치
  const simpleMatch = address.match(/([\w가-힣]+)(구|군|시)/);
  if (simpleMatch) {
    const d = simpleMatch[1] + simpleMatch[2];
    if (simpleMatch[2] === '구') return `${d}청장`;
    if (simpleMatch[2] === '군') return `${d}수`;
    return `${d}장`;
  }

  return '';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { templateCode, data, returnFormat = 'binary', saveForRpa = false } = body;

    // 유효성 검사
    if (!templateCode) {
      return NextResponse.json(
        { success: false, error: 'templateCode는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'data 객체가 필요합니다.' },
        { status: 400 }
      );
    }

    // DB에서 템플릿 조회
    const template = await prisma.formTemplate.findUnique({
      where: { code: templateCode },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: `템플릿을 찾을 수 없습니다: ${templateCode}` },
        { status: 404 }
      );
    }

    if (template.originalFileType !== 'hwpx') {
      return NextResponse.json(
        { success: false, error: '이 엔드포인트는 HWPX 템플릿만 지원합니다.' },
        { status: 400 }
      );
    }

    // 템플릿 경로 결정
    const templatePath = template.originalFileUrl || '';
    const fullPath = path.join(process.cwd(), 'public', templatePath);

    console.log(`[API] Generating HWPX: ${templateCode} -> ${fullPath}`);

    // 데이터 변환 (체크박스 확장, 날짜 분리, 관할관청 매핑)
    const fields = JSON.parse(template.fields || '[]');
    const transformedData = transformDataForHwpx(data, fields);

    // HWPX 생성
    const result = await generateHwpx(fullPath, transformedData, template.outputFileName || undefined);

    if (!result.success || !result.buffer) {
      return NextResponse.json(
        { success: false, error: result.error || 'HWPX 생성 실패' },
        { status: 500 }
      );
    }

    // RPA용 임시 저장
    let tempFilePath: string | undefined;
    if (saveForRpa && result.buffer && result.fileName) {
      tempFilePath = await saveHwpxToTemp(result.buffer, result.fileName);
    }

    // DocumentLog 기록
    await prisma.documentLog.create({
      data: {
        documentType: 'hwpx',
        templateUsed: templateCode,
        inputContext: JSON.stringify(data),
        fileSize: result.buffer.length,
        status: 'success',
        userId: session.user.id,
      },
    });

    // 응답 형식
    if (returnFormat === 'base64') {
      return NextResponse.json({
        success: true,
        filename: result.fileName,
        base64: result.buffer.toString('base64'),
        contentType: 'application/hwp+zip',
        replacedCount: result.replacedCount,
        tempFilePath,
      });
    }

    // 바이너리 다운로드
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/hwp+zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(result.fileName || 'document.hwpx')}"`,
        'X-Replaced-Count': String(result.replacedCount || 0),
      },
    });
  } catch (error) {
    console.error('[API] HWPX generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/document/generate-hwpx
 * HWPX 템플릿 목록 또는 특정 템플릿 상세 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (code) {
      // 특정 템플릿 상세
      const template = await prisma.formTemplate.findUnique({
        where: { code },
      });

      if (!template || template.originalFileType !== 'hwpx') {
        return NextResponse.json(
          { success: false, error: 'HWPX 템플릿을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 플레이스홀더 추출
      const templatePath = template.originalFileUrl || '';
      const fullPath = path.join(process.cwd(), 'public', templatePath);
      const placeholders = extractPlaceholders(fullPath);

      return NextResponse.json({
        success: true,
        template: {
          code: template.code,
          name: template.name,
          category: template.category,
          description: template.description,
          fields: JSON.parse(template.fields || '[]'),
          placeholders,
          outputFileName: template.outputFileName,
        },
      });
    }

    // HWPX 템플릿 전체 목록
    const templates = await prisma.formTemplate.findMany({
      where: {
        originalFileType: 'hwpx',
        status: 'active',
      },
      select: {
        code: true,
        name: true,
        category: true,
        description: true,
        outputFileName: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('[API] HWPX template list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}
