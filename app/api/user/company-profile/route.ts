// =============================================================================
// Company Profile API (기업 마스터 프로필)
// GET  /api/user/company-profile - 기업 프로필 조회
// POST /api/user/company-profile - 기업 프로필 생성/수정 (upsert)
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// GET - 기업 프로필 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: session.user.id },
    });

    // BigInt는 JSON 직렬화가 안 되므로 Number로 변환
    const data = profile ? { ...profile, capital: Number(profile.capital) } : null;

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error('Company profile fetch error:', error);
    return NextResponse.json(
      { error: '기업 정보 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// POST - 기업 프로필 생성/수정 (upsert)
const companyProfileSchema = z.object({
  companyName: z.string().min(1, '상호를 입력하세요').max(100).optional().nullable(),
  ownerName: z.string().min(1, '대표자명을 입력하세요').max(50).optional().nullable(),
  bizRegNo: z.string()
    .regex(/^\d{3}-?\d{2}-?\d{5}$/, '사업자등록번호 형식이 올바르지 않습니다 (000-00-00000)')
    .optional()
    .nullable()
    .transform(val => val ? val.replace(/-/g, '') : val),
  corpRegNo: z.string()
    .regex(/^\d{6}-?\d{7}$/, '법인등록번호 형식이 올바르지 않습니다 (000000-0000000)')
    .optional()
    .nullable()
    .transform(val => val ? val.replace(/-/g, '') : val),
  address: z.string().max(200).optional().nullable(),
  bizType: z.string().max(100).optional().nullable(),
  foundedDate: z.string().optional().nullable(),
  employeeCount: z.number().int().min(0).optional().default(0),
  capital: z.number().int().min(0).optional().default(0),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = companyProfileSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '입력값이 올바르지 않습니다',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    const profileData = {
      companyName: data.companyName ?? null,
      ownerName: data.ownerName ?? null,
      bizRegNo: data.bizRegNo ?? null,
      corpRegNo: data.corpRegNo ?? null,
      address: data.address ?? null,
      bizType: data.bizType ?? null,
      foundedDate: data.foundedDate ? new Date(data.foundedDate) : null,
      employeeCount: data.employeeCount ?? 0,
      capital: BigInt(data.capital ?? 0),
    };

    const profile = await prisma.companyProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...profileData,
      },
      update: profileData,
    });

    // BigInt는 JSON 직렬화가 안 되므로 변환
    const serialized = {
      ...profile,
      capital: Number(profile.capital),
    };

    return NextResponse.json({
      success: true,
      message: '기업 정보가 저장되었습니다',
      data: serialized,
    });

  } catch (error) {
    console.error('Company profile save error:', error);
    return NextResponse.json(
      { error: '기업 정보 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
