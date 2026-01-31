/**
 * =============================================================================
 * [Patent Technology] Government24 Simple Authentication Confirm API
 * =============================================================================
 *
 * POST /api/rpa/auth/confirm
 *
 * 사용자가 카카오톡에서 인증을 완료한 후 세션 상태를 확인합니다.
 * 인증 완료 시 세션 쿠키를 반환합니다.
 *
 * [보안 고려사항]
 * - 세션 쿠키는 민원 자동 접수에만 사용
 * - 세션은 5분 후 자동 만료
 *
 * @author AI Admin Platform
 * @version 1.0.0
 * =============================================================================
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  confirmGov24Auth,
  getSession,
  deleteSession,
} from '@/lib/rpa/gov24Login';

// =============================================================================
// Request Validation Schema
// =============================================================================

const AuthConfirmSchema = z.object({
  sessionId: z
    .string()
    .uuid('올바른 세션 ID 형식이 아닙니다'),
});

type AuthConfirmInput = z.infer<typeof AuthConfirmSchema>;

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Request Body 파싱
    const body = await request.json();

    // 입력 검증
    const validationResult = AuthConfirmSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { sessionId } = validationResult.data;

    console.log(`[Auth Confirm API] Checking auth status for session: ${sessionId}`);

    // 세션 존재 여부 먼저 확인
    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          sessionId,
          authenticated: false,
          status: 'not_found',
          message: '세션을 찾을 수 없습니다. 인증 요청을 다시 시작해주세요.',
          action: {
            description: '인증 요청 API를 다시 호출해주세요',
            endpoint: '/api/rpa/auth/request',
            method: 'POST',
          },
        },
        { status: 404 }
      );
    }

    // 세션 만료 체크
    if (session.expiresAt < new Date()) {
      deleteSession(sessionId);
      return NextResponse.json(
        {
          success: false,
          sessionId,
          authenticated: false,
          status: 'expired',
          message: '세션이 만료되었습니다. 인증 요청을 다시 시작해주세요.',
          action: {
            description: '인증 요청 API를 다시 호출해주세요',
            endpoint: '/api/rpa/auth/request',
            method: 'POST',
          },
        },
        { status: 410 } // Gone
      );
    }

    // 인증 확인 시도
    const result = await confirmGov24Auth(sessionId);

    const responseTime = Date.now() - startTime;

    if (result.success && result.status === 'authenticated') {
      // 인증 성공
      return NextResponse.json({
        success: true,
        sessionId: result.sessionId,
        authenticated: true,
        status: result.status,
        message: result.message,
        cookies: result.cookies
          ? {
              // 쿠키 정보 (민감 정보 마스킹)
              count: result.cookies.length,
              domains: [...new Set(result.cookies.map((c) => c.domain))],
              // 실제 쿠키 값은 서버에서만 사용
            }
          : null,
        nextStep: {
          description: '이제 민원 자동 접수를 진행할 수 있습니다',
          endpoint: '/api/rpa/submit',
          method: 'POST',
          additionalParams: {
            authSessionId: result.sessionId,
          },
        },
        metadata: {
          confirmedAt: new Date().toISOString(),
          responseTime: `${responseTime}ms`,
        },
      });
    } else if (result.status === 'waiting_auth') {
      // 아직 인증 대기 중
      return NextResponse.json(
        {
          success: false,
          sessionId: result.sessionId,
          authenticated: false,
          status: result.status,
          message: result.message,
          remainingTime: Math.max(
            0,
            Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)
          ),
          action: {
            description: '카카오톡에서 인증을 완료한 후 다시 호출해주세요',
            retryAfter: 3, // 3초 후 재시도 권장
          },
          metadata: {
            checkedAt: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
          },
        },
        { status: 202 } // Accepted (아직 처리 중)
      );
    } else {
      // 인증 실패
      return NextResponse.json(
        {
          success: false,
          sessionId: result.sessionId,
          authenticated: false,
          status: result.status,
          message: result.message,
          fallback: {
            description: 'RPA 인증에 실패했습니다. 수동으로 정부24에서 인증해주세요.',
            gov24Url: 'https://www.gov.kr/nlogin',
          },
          action: {
            description: '인증 요청을 다시 시작하거나 수동으로 진행해주세요',
            endpoint: '/api/rpa/auth/request',
            method: 'POST',
          },
          metadata: {
            checkedAt: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
          },
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Auth Confirm API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        message: '인증 확인 처리 중 오류가 발생했습니다.',
        fallback: {
          description: '수동으로 정부24에서 인증해주세요.',
          gov24Url: 'https://www.gov.kr/nlogin',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET Handler - 세션 상태 조회 (폴링용)
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing sessionId parameter',
          message: 'sessionId 파라미터가 필요합니다.',
        },
        { status: 400 }
      );
    }

    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid sessionId format',
          message: '올바른 세션 ID 형식이 아닙니다.',
        },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          sessionId,
          status: 'not_found',
          message: '세션을 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    }

    const now = new Date();
    const isExpired = session.expiresAt < now;

    if (isExpired) {
      deleteSession(sessionId);
    }

    return NextResponse.json({
      success: true,
      sessionId,
      status: isExpired ? 'expired' : session.status,
      authenticated: session.status === 'authenticated',
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      remainingTime: isExpired
        ? 0
        : Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000),
      hasCookies: !!(session.cookies && session.cookies.length > 0),
    });
  } catch (error) {
    console.error('[Auth Confirm API GET] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
