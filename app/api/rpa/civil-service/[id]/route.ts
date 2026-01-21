// =============================================================================
// [Patent Technology] Civil Service Submission Detail API
// GET /api/rpa/civil-service/[id] - 민원 상세 조회
// POST /api/rpa/civil-service/[id] - 민원 실행/재시도
// DELETE /api/rpa/civil-service/[id] - 민원 취소
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { civilServiceSubmissionService } from '@/lib/rpa/civilServiceSubmission';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Submission detail with tracking logs
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

    const submission = await prisma.civilServiceSubmission.findUnique({
      where: { id },
      include: {
        powerOfAttorney: {
          select: {
            id: true,
            delegatorName: true,
            serviceName: true,
            status: true,
            validFrom: true,
            validTo: true,
          },
        },
        trackingLogs: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: '민원을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (submission.userId !== session.user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: submission.id,
        serviceName: submission.serviceName,
        serviceCode: submission.serviceCode,
        targetSite: submission.targetSite,
        targetUrl: submission.targetUrl,
        applicantName: submission.applicantName,
        applicantBirth: submission.applicantBirth ? submission.applicantBirth.substring(0, 4) + '****' : null,
        applicantPhone: submission.applicantPhone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        applicationData: JSON.parse(submission.applicationData),
        status: submission.status,
        progress: submission.progress,
        applicationNumber: submission.applicationNumber,
        receiptUrl: submission.receiptUrl,
        errorMessage: submission.errorMessage,
        retryCount: submission.retryCount,
        maxRetries: submission.maxRetries,
        creditsUsed: submission.creditsUsed,
        powerOfAttorney: submission.powerOfAttorney,
        trackingLogs: submission.trackingLogs,
        createdAt: submission.createdAt,
        completedAt: submission.completedAt,
      },
    });

  } catch (error) {
    console.error('Submission detail error:', error);
    return NextResponse.json(
      { error: '민원 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// POST - Execute or retry submission
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const submission = await prisma.civilServiceSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      return NextResponse.json(
        { error: '민원을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (submission.userId !== session.user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'execute':
        if (submission.status !== 'draft') {
          return NextResponse.json(
            { error: '이미 실행 중이거나 완료된 민원입니다' },
            { status: 400 }
          );
        }
        // Execute in background
        civilServiceSubmissionService.executeSubmission(id).catch(err => {
          console.error('Execution failed:', err);
        });
        return NextResponse.json({
          success: true,
          message: '민원 처리가 시작되었습니다',
        });

      case 'retry':
        if (submission.status !== 'failed') {
          return NextResponse.json(
            { error: '실패한 민원만 재시도할 수 있습니다' },
            { status: 400 }
          );
        }
        if (submission.retryCount >= submission.maxRetries) {
          return NextResponse.json(
            { error: '최대 재시도 횟수를 초과했습니다' },
            { status: 400 }
          );
        }
        // Retry in background
        civilServiceSubmissionService.retrySubmission(id).catch(err => {
          console.error('Retry failed:', err);
        });
        return NextResponse.json({
          success: true,
          message: '민원 재시도가 시작되었습니다',
        });

      default:
        return NextResponse.json(
          { error: '잘못된 action입니다 (execute, retry)' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Submission action error:', error);
    return NextResponse.json(
      { error: '민원 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel submission
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

    const submission = await prisma.civilServiceSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      return NextResponse.json(
        { error: '민원을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (submission.userId !== session.user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // Can only cancel draft or pending submissions
    if (!['draft', 'pending'].includes(submission.status)) {
      return NextResponse.json(
        { error: '이미 처리 중이거나 완료된 민원은 취소할 수 없습니다' },
        { status: 400 }
      );
    }

    await civilServiceSubmissionService.cancelSubmission(id);

    // Refund credits if applicable
    if (submission.creditsUsed > 0) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { credits: true },
      });

      await prisma.user.update({
        where: { id: session.user.id },
        data: { credits: { increment: submission.creditsUsed } },
      });

      await prisma.creditTransaction.create({
        data: {
          userId: session.user.id,
          amount: submission.creditsUsed,
          balance: (user?.credits || 0) + submission.creditsUsed,
          type: 'refund',
          description: `민원 취소 환불: ${submission.serviceName}`,
          referenceType: 'submission',
          referenceId: id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: '민원이 취소되었습니다',
      refundedCredits: submission.creditsUsed,
    });

  } catch (error) {
    console.error('Submission cancel error:', error);
    return NextResponse.json(
      { error: '민원 취소 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
