// =============================================================================
// User Profile API
// GET /api/user/profile - 프로필 조회
// PATCH /api/user/profile - 프로필 수정
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// GET - Get user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        credits: true,
        plan: true,
        createdAt: true,
        accounts: {
          select: {
            provider: true,
          },
        },
        _count: {
          select: {
            documents: true,
            chats: true,
            civilServiceSubmissions: true,
            powersOfAttorney: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        connectedProviders: user.accounts.map(a => a.provider),
      },
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: '프로필 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// PATCH - Update user profile
const updateProfileSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상이어야 합니다').optional(),
  phone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '올바른 휴대폰 번호를 입력하세요').optional().nullable(),
  image: z.string().url().optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = updateProfileSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '입력값이 올바르지 않습니다',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, phone, image } = validationResult.data;

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(image !== undefined && { image }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: '프로필이 수정되었습니다',
      data: updatedUser,
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: '프로필 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
