/**
 * =============================================================================
 * [Patent Technology] Government24 Simple Authentication Request API
 * =============================================================================
 *
 * POST /api/rpa/auth/request
 *
 * 정부24 간편인증(카카오톡) 요청을 시작합니다.
 * 사용자 정보를 받아 인증 요청을 시작하고 세션 ID를 반환합니다.
 *
 * [보안 고려사항]
 * - 개인정보(이름, 생년월일, 전화번호)는 메모리에서만 사용
 * - DB 저장 절대 금지
 * - 세션은 5분 후 자동 만료
 *
 * @author AI Admin Platform
 * @version 1.0.0
 * =============================================================================
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Railway RPA Worker URL
const RPA_WORKER_URL = process.env.RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
const RPA_WORKER_API_KEY = process.env.RPA_WORKER_API_KEY || '';

// =============================================================================
// Request Validation Schema
// =============================================================================

const AuthRequestSchema = z.object({
  name: z
    .string()
    .min(2, '이름은 2자 이상이어야 합니다')
    .max(20, '이름은 20자 이하여야 합니다')
    .regex(/^[가-힣]+$/, '이름은 한글만 입력 가능합니다'),

  birthDate: z
    .string()
    .length(8, '생년월일은 8자리(YYYYMMDD)로 입력해주세요')
    .regex(/^\d{8}$/, '생년월일은 숫자만 입력 가능합니다')
    .refine(
      (val) => {
        const year = parseInt(val.substring(0, 4));
        const month = parseInt(val.substring(4, 6));
        const day = parseInt(val.substring(6, 8));
        return (
          year >= 1900 &&
          year <= new Date().getFullYear() &&
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31
        );
      },
      { message: '유효한 생년월일을 입력해주세요' }
    ),

  phoneNumber: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, '올바른 휴대폰 번호 형식이 아닙니다 (예: 01012345678)'),

  carrier: z.enum(['SKT', 'KT', 'LGU', 'SKT_MVNO', 'KT_MVNO', 'LGU_MVNO'], {
    errorMap: () => ({
      message: '올바른 통신사를 선택해주세요 (SKT, KT, LGU, SKT_MVNO, KT_MVNO, LGU_MVNO)',
    }),
  }),
});

type AuthRequestInput = z.infer<typeof AuthRequestSchema>;

// =============================================================================
// Rate Limiting (간단한 메모리 기반)
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1분
const RATE_LIMIT_MAX_REQUESTS = 5; // 분당 최대 5회

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || record.resetTime < now) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// =============================================================================
// Railway Worker API 호출
// =============================================================================

interface RpaWorkerResponse {
  success: boolean;
  taskId?: string;
  phase?: string;
  message?: string;
  error?: string;
  logs?: Array<{ step: string; message: string; status: string }>;
  sessionData?: {
    sessionActive?: boolean;
  };
}

async function callRpaWorker(endpoint: string, data: Record<string, unknown>): Promise<RpaWorkerResponse> {
  const response = await fetch(`${RPA_WORKER_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': RPA_WORKER_API_KEY,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RPA Worker error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // IP 기반 Rate Limiting
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests',
          message: '요청이 너무 많습니다. 1분 후에 다시 시도해주세요.',
        },
        { status: 429 }
      );
    }

    // 동시 세션 제한 (서버 부하 방지)
    const activeSessionCount = getActiveSessionCount();
    if (activeSessionCount >= 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'Server busy',
          message: '현재 서버가 바쁩니다. 잠시 후 다시 시도해주세요.',
        },
        { status: 503 }
      );
    }

    // Request Body 파싱
    const body = await request.json();

    // 입력 검증
    const validationResult = AuthRequestSchema.safeParse(body);

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

    const input = validationResult.data;

    console.log(`[Auth Request API] Starting auth for: ${input.name.substring(0, 1)}** via Railway worker`);

    // Railway RPA Worker로 인증 요청 전달
    // birthDate (YYYYMMDD) → rrn1 (6자리) 변환
    const rrn1 = input.birthDate.substring(2); // YYMMDD

    const result = await callRpaWorker('/gov24/auth/request', {
      name: input.name,
      rrn1: rrn1,
      rrn2: '1000000', // 비회원 인증에는 뒷자리 전체가 필요하지 않을 수 있음
      phoneNumber: input.phoneNumber,
      carrier: input.carrier,
      authMethod: 'pass', // 기본값: PASS 인증
    });

    const responseTime = Date.now() - startTime;

    if (result.success) {
      return NextResponse.json({
        success: true,
        sessionId: result.taskId,
        status: result.phase === 'waiting' ? 'waiting_auth' : result.phase,
        message: result.message || '인증 요청이 전송되었습니다. 스마트폰 앱에서 인증을 완료해주세요.',
        expiresIn: 300, // 5분
        nextStep: {
          description: 'PASS/카카오톡에서 인증을 완료한 후 아래 API를 호출하세요',
          endpoint: '/api/rpa/auth/confirm',
          method: 'POST',
          body: {
            sessionId: result.taskId,
          },
        },
        metadata: {
          requestedAt: new Date().toISOString(),
          responseTime: `${responseTime}ms`,
          worker: 'railway',
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          sessionId: result.taskId,
          status: 'failed',
          message: result.message || result.error || 'RPA 인증 요청 실패',
          fallback: {
            description: 'RPA 인증에 실패했습니다. 수동으로 정부24에서 인증해주세요.',
            gov24Url: 'https://www.gov.kr/nlogin',
          },
          metadata: {
            requestedAt: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Auth Request API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        message: '인증 요청 처리 중 오류가 발생했습니다.',
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
// GET Handler - API 정보 제공
// =============================================================================

export async function GET() {
  return NextResponse.json({
    success: true,
    endpoint: '/api/rpa/auth/request',
    method: 'POST',
    description: '정부24 간편인증(카카오톡) 요청 API',
    requestSchema: {
      name: {
        type: 'string',
        required: true,
        description: '인증자 이름 (한글)',
        example: '홍길동',
      },
      birthDate: {
        type: 'string',
        required: true,
        description: '생년월일 (YYYYMMDD 형식)',
        example: '19900101',
      },
      phoneNumber: {
        type: 'string',
        required: true,
        description: '휴대폰 번호 (- 없이)',
        example: '01012345678',
      },
      carrier: {
        type: 'string',
        required: true,
        description: '통신사',
        enum: ['SKT', 'KT', 'LGU', 'SKT_MVNO', 'KT_MVNO', 'LGU_MVNO'],
        example: 'SKT',
      },
    },
    responseSchema: {
      success: { type: 'boolean' },
      sessionId: { type: 'string', description: '인증 세션 ID' },
      status: {
        type: 'string',
        enum: ['pending', 'waiting_auth', 'authenticated', 'failed', 'expired'],
      },
      message: { type: 'string' },
      expiresIn: { type: 'number', description: '세션 만료 시간 (초)' },
    },
    securityNote:
      '개인정보는 메모리에서만 휘발성으로 사용되며, 데이터베이스에 저장되지 않습니다.',
  });
}
