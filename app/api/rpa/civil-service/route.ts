// =============================================================================
// [Patent Technology] Civil Service Submission API
// POST /api/rpa/civil-service - 민원 접수 생성 및 실행
// GET /api/rpa/civil-service - 민원 접수 목록 조회
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  civilServiceSubmissionService,
  type SubmissionInput,
} from '@/lib/rpa/civilServiceSubmission';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Request validation schema
const createSubmissionSchema = z.object({
  serviceName: z.string().min(1, '민원명을 입력하세요'),
  serviceCode: z.string().optional(),
  targetSite: z.enum(['gov24', 'hometax', 'wetax', 'minwon']),
  targetUrl: z.string().url().optional(),
  applicantName: z.string().min(2, '신청인 이름을 입력하세요'),
  applicantBirth: z.string().optional(),
  applicantPhone: z.string().optional(),
  applicationData: z.array(z.object({
    fieldId: z.string(),
    fieldName: z.string(),
    fieldType: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'radio', 'file']),
    value: z.union([z.string(), z.boolean(), z.array(z.string())]),
    required: z.boolean(),
    selector: z.string().optional(),
  })),
  powerOfAttorneyId: z.string().optional(),
  executeImmediately: z.boolean().optional(),
});

// POST - Create and optionally execute submission
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
    const validationResult = createSubmissionSchema.safeParse(body);

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

    // Check user credits (민원 접수는 50 크레딧)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true, plan: true },
    });

    if (!user || user.plan === 'none') {
      return NextResponse.json(
        { error: '유효한 구독이 필요합니다' },
        { status: 403 }
      );
    }

    const requiredCredits = 50;
    if (user.credits < requiredCredits) {
      return NextResponse.json(
        { error: `크레딧이 부족합니다. 필요: ${requiredCredits}, 보유: ${user.credits}` },
        { status: 402 }
      );
    }

    // Create submission input
    const input: SubmissionInput = {
      userId: session.user.id,
      serviceName: data.serviceName,
      serviceCode: data.serviceCode,
      targetSite: data.targetSite,
      targetUrl: data.targetUrl,
      applicantName: data.applicantName,
      applicantBirth: data.applicantBirth,
      applicantPhone: data.applicantPhone,
      applicationData: data.applicationData,
      powerOfAttorneyId: data.powerOfAttorneyId,
    };

    // Create submission
    const submissionId = await civilServiceSubmissionService.createSubmission(input);

    // Deduct credits
    await prisma.user.update({
      where: { id: session.user.id },
      data: { credits: { decrement: requiredCredits } },
    });

    // Record credit transaction
    await prisma.creditTransaction.create({
      data: {
        userId: session.user.id,
        amount: -requiredCredits,
        balance: user.credits - requiredCredits,
        type: 'use',
        description: `민원 접수: ${data.serviceName}`,
        referenceType: 'submission',
        referenceId: submissionId,
      },
    });

    // Update submission with credits used
    await prisma.civilServiceSubmission.update({
      where: { id: submissionId },
      data: { creditsUsed: requiredCredits },
    });

    // If executeImmediately, start the process (but don't wait)
    if (data.executeImmediately) {
      // Execute in background
      civilServiceSubmissionService.executeSubmission(submissionId).catch(err => {
        console.error('Background submission execution failed:', err);
      });
    }

    return NextResponse.json({
      success: true,
      message: '민원 접수가 생성되었습니다',
      data: {
        submissionId,
        status: data.executeImmediately ? 'pending' : 'draft',
      },
    });

  } catch (error) {
    console.error('Civil service submission error:', error);
    return NextResponse.json(
      { error: '민원 접수 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// GET - List submissions
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const where = {
      userId: session.user.id,
      ...(status && { status }),
    };

    const [submissions, total] = await Promise.all([
      prisma.civilServiceSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          serviceName: true,
          serviceCode: true,
          targetSite: true,
          applicantName: true,
          status: true,
          progress: true,
          applicationNumber: true,
          creditsUsed: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.civilServiceSubmission.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Submission list error:', error);
    return NextResponse.json(
      { error: '민원 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
