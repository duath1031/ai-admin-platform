// =============================================================================
// [Patent Technology] Power of Attorney Create API
// POST /api/poa/create - 전자위임장 생성
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { powerOfAttorneyService, type PowerOfAttorneyCreateInput } from '@/lib/rpa/powerOfAttorney';
import { z } from 'zod';

// Request validation schema
const createPOASchema = z.object({
  delegator: z.object({
    name: z.string().min(2, '위임자 이름은 2자 이상이어야 합니다'),
    birthDate: z.string().regex(/^\d{8}$/, '생년월일은 YYYYMMDD 형식이어야 합니다'),
    phone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '올바른 휴대폰 번호를 입력하세요'),
    idNumber: z.string().regex(/^\d{6}-?\d{7}$/, '올바른 주민등록번호를 입력하세요'),
    address: z.string().optional(),
  }),
  scope: z.object({
    serviceType: z.enum(['gov24', 'hometax', 'wetax', 'minwon', 'other']),
    serviceName: z.string().min(1, '민원명을 입력하세요'),
    serviceCode: z.string().optional(),
    purposes: z.array(z.string()).min(1, '최소 1개의 위임 목적을 선택하세요'),
    restrictions: z.array(z.string()).optional(),
  }),
  signature: z.object({
    imageData: z.string().min(1, '서명 데이터가 필요합니다'),
    timestamp: z.string().datetime(),
    deviceInfo: z.string().optional(),
    ipAddress: z.string().optional(),
  }),
  validityDays: z.number().min(1).max(365).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 요청 본문 파싱
    const body = await req.json();

    // 유효성 검사
    const validationResult = createPOASchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '입력값이 올바르지 않습니다',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // IP 주소 추출
    const forwarded = req.headers.get('x-forwarded-for');
    const ipAddress = forwarded?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';

    // 위임장 생성 입력 데이터
    const input: PowerOfAttorneyCreateInput = {
      delegator: data.delegator,
      scope: data.scope,
      signature: {
        imageData: data.signature.imageData,
        timestamp: new Date(data.signature.timestamp),
        deviceInfo: data.signature.deviceInfo,
        ipAddress: data.signature.ipAddress || ipAddress,
      },
      validityDays: data.validityDays,
      userId: session.user.id,
    };

    // 전자위임장 생성
    const poa = await powerOfAttorneyService.create(input);

    return NextResponse.json({
      success: true,
      message: '전자위임장이 성공적으로 생성되었습니다',
      data: poa,
    });

  } catch (error) {
    console.error('POA creation error:', error);
    return NextResponse.json(
      { error: '전자위임장 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
