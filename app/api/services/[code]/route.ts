/**
 * =============================================================================
 * Service Detail API
 * =============================================================================
 * GET /api/services/:code - 서비스 상세 정보 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getService,
  getServiceGov24Url,
  formatServiceInfo,
} from '@/lib/config/serviceRegistry';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const service = getService(code);

    if (!service) {
      return NextResponse.json(
        { success: false, error: '서비스를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // format 쿼리 파라미터 확인
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    if (format === 'markdown') {
      return NextResponse.json({
        success: true,
        markdown: formatServiceInfo(service),
      });
    }

    return NextResponse.json({
      success: true,
      service: {
        ...service,
        gov24Url: getServiceGov24Url(code),
      },
    });

  } catch (error) {
    console.error('[Service Detail API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}
