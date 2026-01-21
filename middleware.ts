// =============================================================================
// 미들웨어 - 기본 설정 (Vercel Edge 호환)
// =============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 기본 통과 - 인증은 각 페이지/API에서 처리
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
