/**
 * =============================================================================
 * Services API
 * =============================================================================
 * GET /api/services - 서비스 검색 및 목록 조회
 * Query params:
 *   - category: 카테고리 필터
 *   - keyword: 키워드 검색
 *   - hasTemplate: 템플릿 있는 서비스만
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SERVICE_REGISTRY,
  searchServices,
  getServicesByCategory,
  getServicesWithTemplate,
  getAllCategories,
  getServiceCount,
} from '@/lib/config/serviceRegistry';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const keyword = searchParams.get('keyword');
    const hasTemplate = searchParams.get('hasTemplate') === 'true';
    const listCategories = searchParams.get('categories') === 'true';

    // 카테고리 목록 요청
    if (listCategories) {
      return NextResponse.json({
        success: true,
        categories: getAllCategories(),
        totalServices: getServiceCount(),
      });
    }

    let services = Object.values(SERVICE_REGISTRY);

    // 키워드 검색
    if (keyword) {
      services = searchServices(keyword);
    }

    // 카테고리 필터
    if (category) {
      services = services.filter(s => s.category === category);
    }

    // 템플릿 필터
    if (hasTemplate) {
      services = services.filter(s => s.document.hasTemplate);
    }

    // 결과 정리
    const results = services.map(service => ({
      code: service.code,
      name: service.name,
      category: service.category,
      hasTemplate: service.document.hasTemplate,
      processingDays: service.info.processingDays,
      fee: service.info.fee,
      gov24Url: service.gov24.directUrl || service.gov24.cappBizCD
        ? `https://www.gov.kr/main?a=AA020InfoCappViewApp&CappBizCD=${service.gov24.cappBizCD}`
        : null,
    }));

    return NextResponse.json({
      success: true,
      count: results.length,
      services: results,
    });

  } catch (error) {
    console.error('[Services API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
