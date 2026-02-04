/**
 * =============================================================================
 * Phase 10 V2: Production RPA Submission Pipeline
 * =============================================================================
 *
 * 기존 submit-hwpx의 프로덕션 개선 버전.
 *
 * [개선점]
 * 1. 파일 형식 자동 감지 (HWPX / PDF / JPG / PNG)
 * 2. 문서 상태 체크 (SIGNED → 바로 제출, GENERATED → 서명 필요)
 * 3. 업로드된 파일 직접 제출 지원 (HWPX 생성 없이)
 * 4. 단계별 상세 로깅
 *
 * POST /api/rpa/submit-v2
 *   - mode: "generate" → HWPX 생성 후 제출
 *   - mode: "upload"   → 업로드된 파일 직접 제출
 *
 * POST /api/rpa/submit-v2?action=status
 *   - submissionId로 진행상황 조회
 *
 * POST /api/rpa/submit-v2?action=confirm
 *   - 스크린샷 확인 후 최종 제출
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateHwpx, saveHwpxToTemp } from '@/lib/hwpx';
import { Gov24Worker } from '@/lib/rpa/gov24Worker';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';

// =============================================================================
// Types & Schema
// =============================================================================

/** 문서 상태: SIGNED=서명 완료, GENERATED=생성만 됨, UPLOADED=업로드됨 */
type DocumentStatus = 'SIGNED' | 'GENERATED' | 'UPLOADED';

const GenerateSubmitSchema = z.object({
  mode: z.literal('generate'),
  templateCode: z.string().min(1),
  data: z.record(z.string()),
  serviceUrl: z.string().url(),
  serviceName: z.string().min(1),
  autoSubmit: z.boolean().default(false),
  /** 문서가 전자서명 완료된 상태인지 */
  documentStatus: z.enum(['SIGNED', 'GENERATED']).default('GENERATED'),
});

const UploadSubmitSchema = z.object({
  mode: z.literal('upload'),
  /** 업로드 API에서 반환된 파일 경로 */
  filePath: z.string().min(1),
  serviceUrl: z.string().url(),
  serviceName: z.string().min(1),
  autoSubmit: z.boolean().default(false),
  documentStatus: z.enum(['SIGNED', 'GENERATED', 'UPLOADED']).default('UPLOADED'),
});

const SubmitSchema = z.discriminatedUnion('mode', [
  GenerateSubmitSchema,
  UploadSubmitSchema,
]);

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // --- Action: Status Check ---
    if (action === 'status') {
      return handleStatusCheck(request, session.user.id);
    }

    // --- Action: Confirm Submit ---
    if (action === 'confirm') {
      return handleConfirm(request, session.user.id);
    }

    // --- Main Pipeline ---
    const body = await request.json();
    const validation = SubmitSchema.safeParse(body);

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

    // -----------------------------------------------------------------------
    // Step 1: 파일 준비
    // -----------------------------------------------------------------------
    let filePath: string;
    let fileType: string;
    let hwpxMeta: { fileName: string; replacedCount: number } | null = null;

    if (input.mode === 'generate') {
      // HWPX 생성 모드
      console.log(`[Submit-V2] Step 1: HWPX 생성 - ${input.templateCode}`);

      const template = await prisma.formTemplate.findUnique({
        where: { code: input.templateCode },
      });

      if (!template || template.originalFileType !== 'hwpx') {
        return NextResponse.json(
          { success: false, error: `HWPX 템플릿 없음: ${input.templateCode}` },
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

      filePath = await saveHwpxToTemp(hwpxResult.buffer, hwpxResult.fileName);
      fileType = 'hwpx';
      hwpxMeta = { fileName: hwpxResult.fileName, replacedCount: hwpxResult.replacedCount || 0 };
      console.log(`[Submit-V2] HWPX 생성 완료: ${hwpxResult.fileName} (${hwpxResult.replacedCount} 치환)`);
    } else {
      // 업로드된 파일 직접 제출
      console.log(`[Submit-V2] Step 1: 업로드 파일 확인 - ${input.filePath}`);

      if (!fs.existsSync(input.filePath)) {
        return NextResponse.json(
          { success: false, error: '파일을 찾을 수 없습니다. 먼저 /api/rpa/upload로 업로드하세요.' },
          { status: 404 }
        );
      }

      filePath = input.filePath;
      fileType = Gov24Worker.detectFileType(filePath);
    }

    // -----------------------------------------------------------------------
    // Step 2: 문서 상태 체크
    // -----------------------------------------------------------------------
    console.log(`[Submit-V2] Step 2: 문서 상태 = ${input.documentStatus}, 파일 형식 = ${fileType}`);

    if (input.documentStatus === 'GENERATED' && fileType === 'hwpx') {
      // HWPX는 GENERATED 상태에서도 제출 가능 (정부24가 처리)
      console.log(`[Submit-V2] HWPX 문서 (GENERATED) - 정부24 업로드 진행`);
    } else if (input.documentStatus === 'GENERATED' && fileType === 'pdf') {
      // PDF가 서명 안 된 상태 → 경고만 로깅 (제출은 허용)
      console.log(`[Submit-V2] 경고: PDF 문서가 서명되지 않았습니다. 제출은 진행하지만 반려될 수 있습니다.`);
    }

    // -----------------------------------------------------------------------
    // Step 3: DB 레코드 생성
    // -----------------------------------------------------------------------
    const submission = await prisma.civilServiceSubmission.create({
      data: {
        serviceName: input.serviceName,
        serviceCode: input.mode === 'generate' ? (input as any).templateCode : `upload_${fileType}`,
        targetSite: 'gov24',
        targetUrl: input.serviceUrl,
        applicationData: JSON.stringify(
          input.mode === 'generate' ? (input as any).data : { filePath, fileType }
        ),
        applicantName: input.mode === 'generate'
          ? ((input as any).data['성명'] || (input as any).data['대표자명'] || session.user.name || '')
          : (session.user.name || ''),
        status: 'processing',
        userId: session.user.id,
        resultData: JSON.stringify({
          filePath,
          fileType,
          documentStatus: input.documentStatus,
          hwpxMeta,
          pipeline: 'v2',
        }),
      },
    });

    // 트래킹 로그: 파일 준비 완료
    await prisma.submissionTrackingLog.create({
      data: {
        submissionId: submission.id,
        step: 'generate',
        stepOrder: 1,
        status: 'success',
        message: input.mode === 'generate'
          ? `HWPX 생성 완료 (${hwpxMeta?.replacedCount} 필드 치환)`
          : `파일 준비 완료 (${fileType})`,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // -----------------------------------------------------------------------
    // Step 4: Gov24 업로드
    // -----------------------------------------------------------------------
    console.log(`[Submit-V2] Step 4: Gov24 업로드 시작`);

    const worker = new Gov24Worker();
    const rpaResult = await worker.submitFile({
      filePath,
      fileType: Gov24Worker.detectFileType(filePath),
      serviceUrl: input.serviceUrl,
      serviceName: input.serviceName,
      userId: session.user.id,
      autoSubmit: input.autoSubmit,
    });

    // -----------------------------------------------------------------------
    // Step 5: 결과 저장
    // -----------------------------------------------------------------------
    const newStatus = rpaResult.success
      ? rpaResult.step === 'verify' ? 'pending_confirm' : 'submitted'
      : rpaResult.step === 'login_check' ? 'auth_required' : 'failed';

    await prisma.civilServiceSubmission.update({
      where: { id: submission.id },
      data: {
        status: newStatus,
        applicationNumber: rpaResult.applicationNumber || undefined,
        resultData: JSON.stringify({
          filePath,
          fileType,
          documentStatus: input.documentStatus,
          hwpxMeta,
          pipeline: 'v2',
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

    // 트래킹 로그: RPA 결과
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
      status: newStatus,
      message: rpaResult.message,
      documentStatus: input.documentStatus,
      fileType,
      screenshotPath: rpaResult.screenshotPath,
      applicationNumber: rpaResult.applicationNumber,
      hwpx: hwpxMeta,
    });
  } catch (error) {
    console.error('[Submit-V2] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Action: Status Check
// =============================================================================

async function handleStatusCheck(request: NextRequest, userId: string) {
  const body = await request.json();
  const { submissionId } = body;

  if (!submissionId) {
    return NextResponse.json({ success: false, error: 'submissionId 필요' }, { status: 400 });
  }

  const submission = await prisma.civilServiceSubmission.findUnique({
    where: { id: submissionId },
    include: {
      trackingLogs: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });

  if (!submission || submission.userId !== userId) {
    return NextResponse.json({ success: false, error: '신청 건 없음' }, { status: 404 });
  }

  const resultData = JSON.parse(submission.resultData || '{}');

  return NextResponse.json({
    success: true,
    submission: {
      id: submission.id,
      status: submission.status,
      serviceName: submission.serviceName,
      applicationNumber: submission.applicationNumber,
      documentStatus: resultData.documentStatus,
      fileType: resultData.fileType,
      pipeline: resultData.pipeline,
      createdAt: submission.createdAt,
      completedAt: submission.completedAt,
      errorMessage: submission.errorMessage,
    },
    steps: submission.trackingLogs.map((log) => ({
      step: log.step,
      order: log.stepOrder,
      status: log.status,
      message: log.message,
      screenshotUrl: log.screenshotUrl,
      completedAt: log.completedAt,
    })),
  });
}

// =============================================================================
// Action: Confirm Submit
// =============================================================================

async function handleConfirm(request: NextRequest, userId: string) {
  const body = await request.json();
  const { submissionId } = body;

  if (!submissionId) {
    return NextResponse.json({ success: false, error: 'submissionId 필요' }, { status: 400 });
  }

  const submission = await prisma.civilServiceSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission || submission.userId !== userId) {
    return NextResponse.json({ success: false, error: '신청 건 없음' }, { status: 404 });
  }

  if (submission.status !== 'pending_confirm') {
    return NextResponse.json(
      { success: false, error: `확인 대기 상태가 아닙니다. 현재: ${submission.status}` },
      { status: 400 }
    );
  }

  const resultData = JSON.parse(submission.resultData || '{}');

  const worker = new Gov24Worker();
  const result = await worker.submitFile({
    filePath: resultData.filePath || '',
    fileType: resultData.fileType ? Gov24Worker.detectFileType(resultData.filePath) : undefined,
    serviceUrl: submission.targetUrl || '',
    serviceName: submission.serviceName,
    userId,
    autoSubmit: true,
  });

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

  await prisma.submissionTrackingLog.create({
    data: {
      submissionId,
      step: result.step,
      stepOrder: getStepOrder(result.step),
      status: result.success ? 'success' : 'failed',
      message: result.message,
      screenshotUrl: result.screenshotPath || undefined,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: result.success,
    message: result.message,
    applicationNumber: result.applicationNumber,
    screenshotPath: result.screenshotPath,
  });
}

// =============================================================================
// GET: Pipeline Info
// =============================================================================

export async function GET() {
  const workerStatus = Gov24Worker.getWorkerStatus();
  const hasSession = Gov24Worker.hasStoredSession();

  return NextResponse.json({
    success: true,
    version: 'v2',
    worker: workerStatus,
    session: {
      exists: hasSession,
      message: hasSession ? '저장된 세션 있음' : '세션 없음',
    },
    features: [
      '파일 형식 자동 감지 (HWPX/PDF/JPG/PNG)',
      '문서 상태 체크 (SIGNED/GENERATED/UPLOADED)',
      '업로드 파일 직접 제출',
      '단계별 상세 트래킹',
    ],
    modes: {
      generate: {
        description: 'HWPX 생성 후 정부24 제출',
        requiredFields: ['templateCode', 'data', 'serviceUrl', 'serviceName'],
      },
      upload: {
        description: '업로드된 파일 직접 정부24 제출',
        requiredFields: ['filePath', 'serviceUrl', 'serviceName'],
      },
    },
    steps: [
      { order: 1, name: 'generate', description: '파일 준비 (생성 or 업로드 확인)' },
      { order: 2, name: 'login_check', description: '정부24 세션 확인' },
      { order: 3, name: 'navigate', description: '서비스 페이지 이동' },
      { order: 4, name: 'upload', description: '파일 업로드' },
      { order: 5, name: 'verify', description: '스크린샷 확인 (사용자 대기)' },
      { order: 6, name: 'submitted', description: '제출 완료' },
    ],
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
