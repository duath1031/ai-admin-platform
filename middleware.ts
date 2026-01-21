// =============================================================================
// API 보안 미들웨어
// - 관리자 페이지 보호
// - Rate limiting
// - 민감한 API 엔드포인트 보호
// =============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Rate limiting을 위한 간단한 메모리 스토어 (프로덕션에서는 Redis 권장)
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

// Rate limit 설정
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1분
  maxRequests: 30, // 1분에 최대 30 요청
};

// 관리자 이메일 목록
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'Lawyeom@naver.com').split(',').map(e => e.trim().toLowerCase());

function rateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.timestamp > RATE_LIMIT.windowMs) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - record.count };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 관리자 페이지 보호
  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      return NextResponse.redirect(new URL('/login?callbackUrl=' + encodeURIComponent(pathname), request.url));
    }

    // 관리자 이메일 확인
    const userEmail = (token.email as string)?.toLowerCase();
    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }
  }

  // 2. API 엔드포인트 Rate Limiting
  if (pathname.startsWith('/api/')) {
    // 인증 관련 API는 제외
    if (pathname.startsWith('/api/auth/')) {
      return NextResponse.next();
    }

    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const { allowed, remaining } = rateLimit(ip);

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60',
          },
        }
      );
    }

    // Rate limit 헤더 추가
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    return response;
  }

  // 3. 민감한 API 키가 노출되지 않도록 확인
  // 환경 변수가 클라이언트에 노출되지 않도록 NEXT_PUBLIC_ 접두사가 없는 변수만 서버에서 사용

  return NextResponse.next();
}

// 미들웨어가 적용될 경로 설정
export const config = {
  matcher: [
    // 관리자 페이지
    '/admin/:path*',
    // API 엔드포인트 (인증 제외)
    '/api/((?!auth).*)',
  ],
};
