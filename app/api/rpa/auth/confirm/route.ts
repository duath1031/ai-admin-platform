/**
 * =============================================================================
 * Government24 Simple Authentication Confirm API
 * =============================================================================
 *
 * POST /api/rpa/auth/confirm
 *
 * 사용자가 앱에서 인증을 완료한 후 Railway RPA Worker를 통해 상태를 확인합니다.
 *
 * [보안 고려사항]
 * - 세션 쿠키는 민원 자동 접수에만 사용
 * - 세션은 5분 후 자동 만료
 *
 * @version 2.0.0 - Railway Worker 호출 방식으로 변경
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, updateSessionStatus, deleteSession } from '@/lib/rpa/authSessionStore';

// Railway RPA Worker URL
const RPA_WORKER_URL = process.env.RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
const RPA_WORKER_API_KEY = process.env.RPA_WORKER_API_KEY || '';

// =============================================================================
// Railway Worker 호출
// =============================================================================

interface RpaWorkerConfirmResponse {
  success: boolean;
  taskId?: string;
  phase?: string;
  message?: string;
  error?: string;
  cookies?: Array<{ domain: string; name: string; value: string }>;
  logs?: Array<{ step: string; message: string; status: string }>;
}

async function callRpaWorkerConfirm(taskId: string): Promise<RpaWorkerConfirmResponse> {
  // Worker에 15초 타임아웃 전달 (인증 완료 클릭 + 결과 대기 시간)
  // Vercel 무료 플랜: 10초, Pro 플랜: 60초
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch(`${RPA_WORKER_URL}/gov24/auth/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': RPA_WORKER_API_KEY,
      },
      body: JSON.stringify({ taskId, timeout: 50000 }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RPA Worker error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      // 타임아웃 - 아직 인증 대기 중으로 처리
      return {
        success: false,
        taskId,
        phase: 'waiting',
        message: '인증 확인 중입니다. 앱에서 인증을 완료해주세요.',
      };
    }
    throw error;
  }
}

// =============================================================================
// Request Validation Schema
// =============================================================================

const AuthConfirmSchema = z.object({
  sessionId: z
    .string()
    .uuid('올바른 세션 ID 형식이 아닙니다'),
});

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

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

    console.log(`[Auth Confirm API] Checking session: ${sessionId}`);

    // 세션 존재 확인
    const session = getSession(sessionId);
    if (!session) {
      // 세션이 없어도 Railway Worker에 직접 확인 시도
      // (서버 재시작 등으로 세션이 날아갔을 수 있음)
      console.log(`[Auth Confirm API] Session not in local store, trying worker directly`);
    }

    // 세션 만료 체크
    if (session && session.expiresAt < new Date()) {
      deleteSession(sessionId);
      return NextResponse.json(
        {
          success: false,
          sessionId,
          authenticated: false,
          status: 'expired',
          message: '세션이 만료되었습니다. 인증 요청을 다시 시작해주세요.',
        },
        { status: 410 }
      );
    }

    // Railway Worker에 인증 확인 요청
    const result = await callRpaWorkerConfirm(sessionId);
    const responseTime = Date.now() - startTime;

    if (result.success && result.phase === 'completed') {
      // 인증 성공
      if (session) {
        updateSessionStatus(sessionId, 'authenticated');
      }

      return NextResponse.json({
        success: true,
        sessionId,
        authenticated: true,
        status: 'authenticated',
        message: result.message || '인증이 완료되었습니다.',
        cookies: result.cookies
          ? {
              count: result.cookies.length,
              domains: [...new Set(result.cookies.map((c) => c.domain))],
            }
          : null,
        nextStep: {
          description: '이제 민원 자동 접수를 진행할 수 있습니다',
          endpoint: '/api/rpa/submit',
          method: 'POST',
          additionalParams: { authSessionId: sessionId },
        },
        metadata: {
          confirmedAt: new Date().toISOString(),
          responseTime: `${responseTime}ms`,
        },
      });
    } else if (result.phase === 'error' && result.error?.includes('시간 초과')) {
      // 인증 시간 초과
      if (session) {
        updateSessionStatus(sessionId, 'expired');
      }

      return NextResponse.json(
        {
          success: false,
          sessionId,
          authenticated: false,
          status: 'expired',
          message: '인증 시간이 만료되었습니다.',
        },
        { status: 410 }
      );
    } else if (result.phase === 'error') {
      // 인증 실패
      return NextResponse.json(
        {
          success: false,
          sessionId,
          authenticated: false,
          status: 'failed',
          message: result.error || '인증에 실패했습니다.',
          fallback: {
            description: '수동으로 정부24에서 인증해주세요.',
            gov24Url: 'https://www.gov.kr/nlogin',
          },
        },
        { status: 400 }
      );
    } else {
      // 아직 대기 중
      const remainingTime = session
        ? Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))
        : 300;

      return NextResponse.json(
        {
          success: false,
          sessionId,
          authenticated: false,
          status: 'waiting_auth',
          message: '앱에서 인증을 완료해주세요.',
          remainingTime,
          action: {
            retryAfter: 3,
          },
          metadata: {
            checkedAt: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
          },
        },
        { status: 202 }
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
        { success: false, message: 'sessionId 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json(
        { success: false, message: '올바른 세션 ID 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, sessionId, status: 'not_found', message: '세션을 찾을 수 없습니다.' },
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
    });
  } catch (error) {
    console.error('[Auth Confirm API GET] Error:', error);

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
