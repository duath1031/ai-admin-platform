/**
 * =============================================================================
 * Phase 10: HWPX → Gov24 RPA Submit Pipeline
 * =============================================================================
 *
 * POST /api/rpa/submit-hwpx
 *   HWPX 생성 → 세션 확인 → 정부24 업로드 → 스크린샷 확인
 *   전체 파이프라인을 하나의 API로 통합.
 *
 * GET /api/rpa/submit-hwpx
 *   워커 상태 및 세션 정보 조회.
 *
 * POST /api/rpa/submit-hwpx?action=confirm
 *   스크린샷 확인 후 최종 제출 확인.
 *
 * POST /api/rpa/submit-hwpx?action=session-check
 *   세션 유효성만 확인.
 *
 * POST /api/rpa/submit-hwpx?action=clear-session
 *   세션 강제 초기화.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateHwpx, saveHwpxToTemp } from '@/lib/hwpx';
import { Gov24Worker } from '@/lib/rpa/gov24Worker';
import { z } from 'zod';
import * as path from 'path';

// =============================================================================
// Request Schema
// =============================================================================

const SubmitHwpxSchema = z.object({
  /** FormTemplate code (e.g. "hwpx_식품영업신고서") */
  templateCode: z.string().min(1),
  /** 플레이스홀더 치환 데이터 */
  data: z.record(z.string()),
  /** 정부24 서비스 URL */
  serviceUrl: z.string().url(),
  /** 서비스명 */
  serviceName: z.string().min(1),
  /** 자동 제출 여부 (기본: false, 스크린샷 확인 후 수동 제출) */
  autoSubmit: z.boolean().default(false),
});

// =============================================================================
// POST: Full Pipeline (Generate + Upload)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // --- Action: Session Check ---
    if (action === 'session-check') {
      const worker = new Gov24Worker();
      const sessionStatus = await worker.checkSession();
      return NextResponse.json({
        success: true,
        session: sessionStatus,
        hasStoredSession: Gov24Worker.hasStoredSession(),
      });
    }

    // --- Action: Clear Session ---
    if (action === 'clear-session') {
      Gov24Worker.clearSession();
      return NextResponse.json({
        success: true,
        message: '세션이 초기화되었습니다.',
      });
    }

    // --- Action: Confirm (스크린샷 확인 후 제출) ---
    if (action === 'confirm') {
      const body = await request.json();
      const { submissionId } = body;

      if (!submissionId) {
        return NextResponse.json(
          { success: false, error: 'submissionId가 필요합니다.' },
          { status: 400 }
        );
      }

      // DB에서 submission 조회
      const submission = await prisma.civilServiceSubmission.findUnique({
        where: { id: submissionId },
      });

      if (!submission || submission.userId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: '신청 건을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 자동 제출로 재실행
      const resultData = JSON.parse(submission.resultData || '{}');
      const worker = new Gov24Worker();
      const result = await worker.submitFile({
        filePath: resultData.tempFilePath || '',
        serviceUrl: submission.targetUrl || '',
        serviceName: submission.serviceName,
        userId: session.user.id,
        autoSubmit: true,
      });

      // DB 업데이트
      await prisma.civilServiceSubmission.update({
        where: { id: submissionId },
        data: {
          status: result.success ? 'submitted' : 'failed',
          applicationNumber: result.applicationNumber || undefined,
          resultData: JSON.stringify({ ...resultData, confirmResult: result }),
          completedAt: result.success ? new Date() : undefined,
          errorMessage: result.error || undefined,
        },
      });

      return NextResponse.json({
        success: result.success,
        message: result.message,
        applicationNumber: result.applicationNumber,
        screenshotPath: result.screenshotPath,
      });
    }

    // --- Main: Generate + Upload Pipeline ---
    const body = await request.json();
    const validation = SubmitHwpxSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const input = validation.data;

    // Step 1: HWPX 생성
    console.log(`[RPA Pipeline] Step 1: HWPX 생성 - ${input.templateCode}`);

    const template = await prisma.formTemplate.findUnique({
      where: { code: input.templateCode },
    });

    if (!template || template.originalFileType !== 'hwpx') {
      return NextResponse.json(
        { success: false, error: `HWPX 템플릿을 찾을 수 없습니다: ${input.templateCode}` },
        { status: 404 }
      );
    }

    const templatePath = path.join(process.cwd(), 'public', template.originalFileUrl || '');
    const hwpxResult = await generateHwpx(templatePath, input.data, template.outputFileName || undefined);

    if (!hwpxResult.success || !hwpxResult.buffer || !hwpxResult.fileName) {
      return NextResponse.json(
        { success: false, error: hwpxResult.error || 'HWPX 생성 실패', step: 'generate' },
        { status: 500 }
      );
    }

    // 임시 파일 저장
    const tempFilePath = await saveHwpxToTemp(hwpxResult.buffer, hwpxResult.fileName);

    // DB에 제출 건 생성
    const submission = await prisma.civilServiceSubmission.create({
      data: {
        serviceName: input.serviceName,
        serviceCode: input.templateCode,
        targetSite: 'gov24',
        targetUrl: input.serviceUrl,
        applicationData: JSON.stringify(input.data),
        applicantName: input.data['성명'] || input.data['대표자명'] || input.data['신청인'] || session.user.name || '',
        status: 'processing',
        userId: session.user.id,
        resultData: JSON.stringify({
          tempFilePath,
          hwpxFileName: hwpxResult.fileName,
          replacedCount: hwpxResult.replacedCount,
        }),
      },
    });

    // Step 2: Gov24 업로드
    console.log(`[RPA Pipeline] Step 2: Gov24 업로드 시작`);

    const worker = new Gov24Worker();
    const rpaResult = await worker.submitFile({
      filePath: tempFilePath,
      serviceUrl: input.serviceUrl,
      serviceName: input.serviceName,
      userId: session.user.id,
      autoSubmit: input.autoSubmit,
    });

    // DB 업데이트
    const newStatus = rpaResult.success
      ? rpaResult.step === 'verify'
        ? 'pending_confirm'
        : 'submitted'
      : rpaResult.step === 'login_check'
        ? 'auth_required'
        : 'failed';

    await prisma.civilServiceSubmission.update({
      where: { id: submission.id },
      data: {
        status: newStatus,
        applicationNumber: rpaResult.applicationNumber || undefined,
        resultData: JSON.stringify({
          tempFilePath,
          hwpxFileName: hwpxResult.fileName,
          replacedCount: hwpxResult.replacedCount,
          rpaResult: {
            step: rpaResult.step,
            message: rpaResult.message,
            screenshotPath: rpaResult.screenshotPath,
          },
        }),
        completedAt: rpaResult.step === 'submitted' ? new Date() : undefined,
        errorMessage: rpaResult.error || undefined,
      },
    });

    // 트래킹 로그 기록
    await prisma.submissionTrackingLog.create({
      data: {
        submissionId: submission.id,
        step: rpaResult.step,
        stepOrder: getStepOrder(rpaResult.step),
        status: rpaResult.success ? 'success' : 'failed',
        message: rpaResult.message,
        screenshotUrl: rpaResult.screenshotPath || undefined,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: rpaResult.success,
      submissionId: submission.id,
      step: rpaResult.step,
      message: rpaResult.message,
      screenshotPath: rpaResult.screenshotPath,
      applicationNumber: rpaResult.applicationNumber,
      hwpx: {
        fileName: hwpxResult.fileName,
        replacedCount: hwpxResult.replacedCount,
      },
    });
  } catch (error) {
    console.error('[RPA Pipeline] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Pipeline execution failed',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET: Worker Status
// =============================================================================

export async function GET() {
  const workerStatus = Gov24Worker.getWorkerStatus();
  const hasSession = Gov24Worker.hasStoredSession();

  return NextResponse.json({
    success: true,
    worker: workerStatus,
    session: {
      exists: hasSession,
      message: hasSession ? '저장된 세션이 있습니다.' : '저장된 세션이 없습니다.',
    },
    pipeline: {
      description: 'HWPX 생성 → 정부24 업로드 통합 파이프라인',
      steps: [
        { order: 1, name: 'generate', description: 'HWPX 문서 생성' },
        { order: 2, name: 'login_check', description: '정부24 세션 확인' },
        { order: 3, name: 'navigate', description: '서비스 페이지 이동' },
        { order: 4, name: 'upload', description: '파일 업로드' },
        { order: 5, name: 'verify', description: '스크린샷 확인 (사용자 컨펌 대기)' },
        { order: 6, name: 'submitted', description: '제출 완료' },
      ],
    },
  });
}

// =============================================================================
// Helpers
// =============================================================================

function getStepOrder(step: string): number {
  const order: Record<string, number> = {
    generate: 1,
    login_check: 2,
    navigate: 3,
    upload: 4,
    verify: 5,
    submitted: 6,
    failed: -1,
  };
  return order[step] ?? 0;
}
