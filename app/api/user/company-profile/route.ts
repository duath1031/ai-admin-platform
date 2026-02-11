// =============================================================================
// Company Profile API (기업 마스터 프로필)
// GET  /api/user/company-profile - 기업 프로필 조회 (관계 데이터 포함)
// POST /api/user/company-profile - 기업 프로필 생성/수정 (upsert)
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? Number(v) : v));

// GET - 기업 프로필 조회 (관계 데이터 포함)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        licenses: { orderBy: { createdAt: 'desc' } },
        certifications: { orderBy: { createdAt: 'desc' } },
        patents: { orderBy: { createdAt: 'desc' } },
        performances: { orderBy: { createdAt: 'desc' } },
        bidHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    return NextResponse.json({
      success: true,
      data: profile ? serialize(profile) : null,
    });
  } catch (error) {
    console.error('Company profile fetch error:', error);
    return NextResponse.json({ error: '기업 정보 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}

// POST - 기업 프로필 생성/수정 (upsert)
const companyProfileSchema = z.object({
  // Section 1: 필수 식별 정보
  companyName: z.string().max(100).optional().nullable(),
  ownerName: z.string().max(50).optional().nullable(),
  bizRegNo: z.string()
    .regex(/^\d{3}-?\d{2}-?\d{5}$/, '사업자등록번호 형식이 올바르지 않습니다')
    .optional().nullable()
    .transform(val => val ? val.replace(/-/g, '') : val),
  corpRegNo: z.string()
    .regex(/^\d{6}-?\d{7}$/, '법인등록번호 형식이 올바르지 않습니다')
    .optional().nullable()
    .transform(val => val ? val.replace(/-/g, '') : val),
  address: z.string().max(200).optional().nullable(),
  bizType: z.string().max(100).optional().nullable(),
  foundedDate: z.string().optional().nullable(),

  // Section 2: 업종 상세
  businessSector: z.string().max(50).optional().nullable(),
  industryCode: z.string().max(20).optional().nullable(),
  industryName: z.string().max(100).optional().nullable(),
  businessSubType: z.string().max(100).optional().nullable(),
  establishmentDate: z.string().optional().nullable(),

  // Section 3: 재무 정보 (3개년)
  revenueYear1: z.number().optional().nullable(),
  revenueYear2: z.number().optional().nullable(),
  revenueYear3: z.number().optional().nullable(),
  revenueLabel1: z.string().max(10).optional().nullable(),
  revenueLabel2: z.string().max(10).optional().nullable(),
  revenueLabel3: z.string().max(10).optional().nullable(),
  operatingProfitYear1: z.number().optional().nullable(),
  operatingProfitYear2: z.number().optional().nullable(),
  operatingProfitYear3: z.number().optional().nullable(),
  netIncomeYear1: z.number().optional().nullable(),
  netIncomeYear2: z.number().optional().nullable(),
  netIncomeYear3: z.number().optional().nullable(),
  totalAssets: z.number().optional().nullable(),
  totalLiabilities: z.number().optional().nullable(),
  rndExpenditure: z.number().optional().nullable(),
  exportAmount: z.number().optional().nullable(),

  // Section 4: 고용 정보
  employeeCount: z.number().int().min(0).optional().default(0),
  permanentEmployees: z.number().int().min(0).optional().nullable(),
  researcherCount: z.number().int().min(0).optional().nullable(),
  foreignEmployees: z.number().int().min(0).optional().nullable(),
  capital: z.number().int().min(0).optional().default(0),

  // Section 7: 연구소/전담부서
  hasResearchInstitute: z.boolean().optional().default(false),
  hasRndDepartment: z.boolean().optional().default(false),
  researchInstituteDate: z.string().optional().nullable(),

  // Section 7-1: 제조업 정보
  isManufacturer: z.boolean().optional().default(false),
  manufacturingItems: z.string().optional().nullable(),
  factoryAddress: z.string().max(200).optional().nullable(),
  factoryArea: z.string().max(50).optional().nullable(),
  manufacturingCerts: z.string().optional().nullable(),
  hasFactoryRegistration: z.boolean().optional().default(false),
  mainRawMaterials: z.string().optional().nullable(),

  // Section 8: 조달 정보
  isG2bRegistered: z.boolean().optional().default(false),
  g2bRegistrationNumber: z.string().max(50).optional().nullable(),
  mainProducts: z.string().optional().nullable(),
  productClassificationCodes: z.string().optional().nullable(),
  hasDirectProductionCert: z.boolean().optional().default(false),
  hasMasContract: z.boolean().optional().default(false),
  masItems: z.string().optional().nullable(),

  // Section 9: 수출 정보
  isExporter: z.boolean().optional().default(false),
  exportCountries: z.string().optional().nullable(),
  importItems: z.string().optional().nullable(),

  // Section 10: 외국인 관련
  hasForeignWorkers: z.boolean().optional().default(false),
  foreignWorkerVisaTypes: z.string().optional().nullable(),

  // Section 11: 대표자 성별 (여성기업 인증용)
  ceoGender: z.string().max(10).optional().nullable(),
});

// BigInt 변환이 필요한 필드 목록
const BIGINT_FIELDS = [
  'revenueYear1', 'revenueYear2', 'revenueYear3',
  'operatingProfitYear1', 'operatingProfitYear2', 'operatingProfitYear3',
  'netIncomeYear1', 'netIncomeYear2', 'netIncomeYear3',
  'totalAssets', 'totalLiabilities', 'rndExpenditure', 'exportAmount', 'capital',
] as const;

function calculateCompleteness(data: Record<string, any>): number {
  const checks = [
    !!data.companyName, !!data.ownerName, !!data.bizRegNo, !!data.address,
    !!data.bizType, !!data.businessSector,
    data.revenueYear1 != null, data.employeeCount > 0, data.capital > 0,
    !!data.foundedDate,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = companyProfileSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: '입력값이 올바르지 않습니다',
        details: validationResult.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const data = validationResult.data;

    // profileData 빌드
    const profileData: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;

      if (BIGINT_FIELDS.includes(key as any)) {
        profileData[key] = value != null ? BigInt(value) : null;
      } else if (key === 'foundedDate' || key === 'establishmentDate' || key === 'researchInstituteDate') {
        profileData[key] = value ? new Date(value as string) : null;
      } else {
        profileData[key] = value ?? null;
      }
    }

    // 완성도 계산
    profileData.profileCompleteness = calculateCompleteness({ ...data, ...profileData });

    const profile = await prisma.companyProfile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...profileData },
      update: profileData,
      include: {
        licenses: { orderBy: { createdAt: 'desc' } },
        certifications: { orderBy: { createdAt: 'desc' } },
        patents: { orderBy: { createdAt: 'desc' } },
        performances: { orderBy: { createdAt: 'desc' } },
        bidHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    return NextResponse.json({
      success: true,
      message: '기업 정보가 저장되었습니다',
      data: serialize(profile),
    });
  } catch (error) {
    console.error('Company profile save error:', error);
    return NextResponse.json({ error: '기업 정보 저장 중 오류가 발생했습니다' }, { status: 500 });
  }
}
