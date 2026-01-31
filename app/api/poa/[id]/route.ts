// =============================================================================
// [Patent Technology] Power of Attorney Detail API
// GET /api/poa/[id] - 전자위임장 상세 조회
// DELETE /api/poa/[id] - 전자위임장 취소
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

// GET - 위임장 상세 조회
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

    const poa = await prisma.powerOfAttorney.findUnique({
      where: { id },
      include: {
        submissions: {
          select: {
            id: true,
            serviceName: true,
            status: true,
            applicationNumber: true,
            createdAt: true,
          },
        },
      },
    });

    if (!poa) {
      return NextResponse.json(
        { error: '위임장을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 권한 확인 (본인 소유만 조회 가능)
    if (poa.userId !== session.user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 민감 정보 제외하고 반환
    return NextResponse.json({
      success: true,
      data: {
        id: poa.id,
        delegatorName: poa.delegatorName,
        delegatorBirth: poa.delegatorBirth.substring(0, 4) + '****', // 마스킹
        delegatorPhone: poa.delegatorPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), // 마스킹
        delegatorAddress: poa.delegatorAddress,
        serviceType: poa.serviceType,
        serviceName: poa.serviceName,
        serviceCode: poa.serviceCode,
        delegationScope: JSON.parse(poa.delegationScope || '{}'),
        status: poa.status,
        validFrom: poa.validFrom,
        validTo: poa.validTo,
        signedAt: poa.signedAt,
        revokedAt: poa.revokedAt,
        revokedReason: poa.revokedReason,
        submissions: poa.submissions,
        createdAt: poa.createdAt,
      },
    });

  } catch (error) {
    console.error('POA detail error:', error);
    return NextResponse.json(
      { error: '위임장 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// DELETE - 위임장 취소
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { reason } = await req.json().catch(() => ({ reason: '사용자 요청에 의한 취소' }));

    const poa = await prisma.powerOfAttorney.findUnique({
      where: { id },
    });

    if (!poa) {
      return NextResponse.json(
        { error: '위임장을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 권한 확인
    if (poa.userId !== session.user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 이미 취소/만료된 경우
    if (poa.status === 'revoked' || poa.status === 'expired') {
      return NextResponse.json(
        { error: '이미 취소되었거나 만료된 위임장입니다' },
        { status: 400 }
      );
    }

    // 사용된 위임장은 취소 불가
    if (poa.status === 'used') {
      return NextResponse.json(
        { error: '이미 사용된 위임장은 취소할 수 없습니다' },
        { status: 400 }
      );
    }

    // 위임장 취소
    await powerOfAttorneyService.revoke(id, reason);

    return NextResponse.json({
      success: true,
      message: '위임장이 취소되었습니다',
    });

  } catch (error) {
    console.error('POA delete error:', error);
    return NextResponse.json(
      { error: '위임장 취소 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
