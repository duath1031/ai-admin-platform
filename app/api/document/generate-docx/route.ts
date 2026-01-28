/**
 * =============================================================================
 * DOCX Generation API (The Writer)
 * =============================================================================
 * POST /api/document/generate-docx
 * 템플릿 코드와 사용자 데이터를 받아 DOCX 생성
 *
 * GET /api/document/generate-docx
 * 사용 가능한 템플릿 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateDocx,
  getAvailableTemplates,
  getTemplateMetadata,
  getAllTemplateMetadata,
} from '@/lib/document/docxEngine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateCode, data, returnFormat = 'binary' } = body;

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

    console.log(`[API] Generating DOCX: ${templateCode}`);

    // DOCX 생성
    const result = await generateDocx(templateCode, data);

    if (!result.success || !result.docxData) {
      return NextResponse.json(
        { success: false, error: result.error || 'DOCX 생성 실패' },
        { status: 500 }
      );
    }

    // returnFormat에 따라 응답 형식 결정
    if (returnFormat === 'base64') {
      // Base64로 반환 (프론트엔드에서 다운로드 처리할 때 유용)
      const base64 = Buffer.from(result.docxData).toString('base64');
      return NextResponse.json({
        success: true,
        filename: result.filename,
        base64,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        stats: result.stats,
      });
    }

    // 바이너리로 반환 (직접 다운로드)
    return new NextResponse(Buffer.from(result.docxData), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename || 'document.docx')}"`,
        'X-Generation-Stats': JSON.stringify(result.stats),
      },
    });

  } catch (error) {
    console.error('[API] DOCX generation error:', error);
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
 * GET /api/document/generate-docx
 * 사용 가능한 템플릿 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateCode = searchParams.get('code');

    // 특정 템플릿 상세 조회
    if (templateCode) {
      const metadata = await getTemplateMetadata(templateCode);

      if (!metadata) {
        return NextResponse.json(
          { success: false, error: '템플릿을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        template: metadata,
      });
    }

    // 전체 템플릿 목록 조회
    const templates = await getAllTemplateMetadata();

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    });

  } catch (error) {
    console.error('[API] Template list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}
