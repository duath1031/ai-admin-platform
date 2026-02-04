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
import { generateHwpx, saveHwpxToTemp, extractPlaceholders, transformDataForHwpx } from '@/lib/hwpx';
import * as path from 'path';

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
