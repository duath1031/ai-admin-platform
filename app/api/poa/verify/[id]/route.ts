// =============================================================================
// [Patent Technology] Power of Attorney Verify API
// GET /api/poa/verify/[id] - 전자위임장 유효성 검증
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { powerOfAttorneyService } from '@/lib/rpa/powerOfAttorney';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 권한 확인
    const poa = await prisma.powerOfAttorney.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!poa) {
      return NextResponse.json(
        { error: '위임장을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (poa.userId !== session.user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 유효성 검증
    const verificationResult = await powerOfAttorneyService.verify(id);

    return NextResponse.json({
      success: true,
      verification: {
        isValid: verificationResult.isValid,
        reason: verificationResult.reason,
        verifiedAt: new Date().toISOString(),
      },
      data: verificationResult.poa,
    });

  } catch (error) {
    console.error('POA verification error:', error);
    return NextResponse.json(
      { error: '위임장 검증 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
