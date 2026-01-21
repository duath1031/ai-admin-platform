// =============================================================================
// [Patent Technology] Power of Attorney List API
// GET /api/poa - 전자위임장 목록 조회
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { powerOfAttorneyService } from '@/lib/rpa/powerOfAttorney';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // Query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // 유효성 검사
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: '잘못된 페이지 파라미터입니다' },
        { status: 400 }
      );
    }

    const result = await powerOfAttorneyService.listByUser(session.user.id, {
      status,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });

  } catch (error) {
    console.error('POA list error:', error);
    return NextResponse.json(
      { error: '위임장 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
