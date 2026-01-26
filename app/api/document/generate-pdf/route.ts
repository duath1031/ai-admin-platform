/**
 * =============================================================================
 * PDF Generation API
 * =============================================================================
 * POST /api/document/generate-pdf
 * 서비스 코드와 사용자 데이터를 받아 PDF 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePdf, loadMapping } from '@/lib/document/pdfEngine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceCode, userData } = body;

    // 유효성 검사
    if (!serviceCode) {
      return NextResponse.json(
        { success: false, error: 'serviceCode는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!userData || typeof userData !== 'object') {
      return NextResponse.json(
        { success: false, error: 'userData 객체가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`[API] Generating PDF: ${serviceCode}`);

    // PDF 생성
    const result = await generatePdf(serviceCode, userData);

    if (!result.success || !result.pdfData) {
      return NextResponse.json(
        { success: false, error: result.error || 'PDF 생성 실패' },
        { status: 500 }
      );
    }

    // PDF 반환
    return new NextResponse(result.pdfData, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename || 'document.pdf')}"`,
        'X-Generation-Stats': JSON.stringify(result.stats),
      },
    });

  } catch (error) {
    console.error('[API] PDF generation error:', error);
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
 * GET /api/document/generate-pdf
 * 사용 가능한 템플릿 목록 조회
 */
export async function GET() {
  try {
    const { listAvailableMappings } = await import('@/lib/document/pdfEngine/mappingLoader');
    const mappings = await listAvailableMappings();

    const templates = await Promise.all(
      mappings.map(async (code) => {
        const mapping = await loadMapping(code);
        return mapping ? {
          serviceCode: mapping.serviceCode,
          serviceName: mapping.serviceName,
          version: mapping.version,
          pageCount: mapping.pageCount,
          fieldCount: (mapping.fields?.length || 0) +
                      (mapping.checkboxes?.length || 0) +
                      (mapping.images?.length || 0),
        } : null;
      })
    );

    return NextResponse.json({
      success: true,
      templates: templates.filter(Boolean),
    });

  } catch (error) {
    console.error('[API] Template list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}
