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
import { generateHwpx, saveHwpxToTemp, transformDataForHwpx, validateRequiredFields } from '@/lib/hwpx';
import { Gov24Worker } from '@/lib/rpa/gov24Worker';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';

// =============================================================================
// RPA Worker 연결 설정
// =============================================================================
const RPA_WORKER_URL = process.env.RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
const RPA_WORKER_API_KEY = process.env.RPA_WORKER_API_KEY || process.env.WORKER_API_KEY || '';

/**
 * RPA Worker API POST 호출 헬퍼
 */
async function callWorker(endpoint: string, data: Record<string, unknown>, timeoutMs = 55000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${RPA_WORKER_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': RPA_WORKER_API_KEY,
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    return response.json();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: `Worker 응답 시간 초과 (${timeoutMs / 1000}초). 다시 시도해주세요.` };
    }
    return { success: false, error: `Worker 연결 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * RPA Worker API GET 호출 헬퍼
 */
async function callWorkerGet(endpoint: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${RPA_WORKER_URL}${endpoint}`, {
      method: 'GET',
      headers: { 'X-API-Key': RPA_WORKER_API_KEY },
      signal: controller.signal,
    });
    return response.json();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Worker 상태 조회 시간 초과' };
    }
    return { success: false, error: `Worker 연결 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Real RPA - 비회원 간편인증 요청 (Railway Worker 호출)
 * 정부24 비회원 로그인 플로우: 이름 + 주민등록번호(rrn1+rrn2) + 전화번호 + 간편인증
 */
async function handleRealRpaAuthRequest(
  userId: string,
  authData: {
    name: string;
    rrn1: string;      // 주민번호 앞자리 (6자리)
    rrn2: string;      // 주민번호 뒷자리 (7자리)
    phoneNumber: string;
    carrier?: string;
    authMethod: string;
  },
  fileInfo: {
    filePath: string;
    fileType: string;
    fileName: string;
    fileBase64?: string;
  },
  serviceName: string,
  serviceUrl: string = ''
) {
  console.log(`[Submit-V2] Real RPA: 비회원 간편인증 요청 시작 (${authData.authMethod})`);

  // Worker에 비회원 인증 요청 (주민등록번호 전체 전송)
  const workerResult = await callWorker('/gov24/auth/request', {
    name: authData.name,
    rrn1: authData.rrn1,
    rrn2: authData.rrn2,
    phoneNumber: authData.phoneNumber,
    carrier: authData.carrier,
    authMethod: authData.authMethod,
  });

  if (!workerResult.success) {
    throw new Error(workerResult.error || 'Worker 인증 요청 실패');
  }

  // DB에 제출 건 생성 (fileBase64도 resultData에 포함 → confirm에서 Worker에 전달)
  const submission = await prisma.civilServiceSubmission.create({
    data: {
      serviceName: serviceName || '정부24 자동 접수',
      serviceCode: `rpa_${fileInfo.fileType}`,
      targetSite: 'gov24',
      targetUrl: serviceUrl || '',
      applicationData: JSON.stringify({ ...fileInfo, authMethod: authData.authMethod }),
      applicantName: authData.name,
      status: 'auth_required',
      userId,
      resultData: JSON.stringify({
        filePath: fileInfo.filePath,
        fileType: fileInfo.fileType,
        fileName: fileInfo.fileName,
        fileBase64: fileInfo.fileBase64 || null,
        pipeline: 'v2_real_rpa',
        workerTaskId: workerResult.taskId,
        authMethod: authData.authMethod,
      }),
    },
  });

  // 트래킹 로그 생성
  await prisma.submissionTrackingLog.create({
    data: {
      submissionId: submission.id,
      step: 'login_check',
      stepOrder: 2,
      status: 'pending',
      message: `정부24 간편인증 요청 (${authData.authMethod})`,
      startedAt: new Date(),
    },
  });

  const authMethodLabels: Record<string, string> = {
    kakao: '카카오톡',
    naver: '네이버',
    pass: 'PASS',
    toss: '토스',
  };
  const authLabel = authMethodLabels[authData.authMethod] || authData.authMethod;

  console.log(`[Submit-V2] Real RPA: auth_required 반환 (submissionId: ${submission.id}, taskId: ${workerResult.taskId})`);

  return {
    success: true,
    submissionId: submission.id,
    workerTaskId: workerResult.taskId,
    step: 'auth_required',
    status: 'auth_required',
    message: `📱 ${authLabel} 인증 요청을 보냈습니다. 스마트폰 앱에서 인증을 완료한 후 [✅ 인증 완료] 버튼을 눌러주세요.`,
    action: 'AUTHENTICATE',
    fileType: fileInfo.fileType,
  };
}

/**
 * Real RPA - Step 1: 인증 확인만 (쿠키 획득 → DB 저장)
 * Vercel 60초 제한 내에 완료 가능 (~10초)
 */
async function handleRealRpaConfirm(submissionId: string, userId: string) {
  console.log(`[Submit-V2] Real RPA: 인증 확인 요청 (submissionId: ${submissionId})`);

  const submission = await prisma.civilServiceSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission || submission.userId !== userId) {
    return { success: false, error: '신청 건을 찾을 수 없습니다.' };
  }

  if (submission.status !== 'auth_required' && submission.status !== 'auth_confirmed') {
    return { success: false, error: `현재 상태: ${submission.status}. 인증 대기 상태가 아닙니다.` };
  }

  // 이미 인증 완료된 경우 → 바로 submit 단계로 안내
  if (submission.status === 'auth_confirmed') {
    return { success: true, submissionId, step: 'auth_confirmed', action: 'SUBMIT_READY', message: '인증이 이미 완료되었습니다. 제출을 진행합니다.' };
  }

  const resultData = JSON.parse(submission.resultData || '{}');
  const workerTaskId = resultData.workerTaskId;

  // Worker에 인증 확인 요청 (clickConfirm으로 "인증 완료" 버튼 클릭)
  console.log(`[Submit-V2] Real RPA: Worker 인증 확인 호출 (taskId: ${workerTaskId})`);
  const confirmResult = await callWorker('/gov24/auth/confirm', {
    taskId: workerTaskId,
    clickConfirm: true,
    timeout: 50000,
  });

  if (!confirmResult.success) {
    await prisma.submissionTrackingLog.create({
      data: { submissionId, step: 'auth_confirm', stepOrder: 3, status: 'failed', message: confirmResult.error || '인증 확인 실패', startedAt: new Date(), completedAt: new Date() },
    });
    return { success: false, error: confirmResult.error || '인증이 완료되지 않았습니다. 스마트폰에서 인증을 완료해주세요.' };
  }

  // 인증 성공 → 쿠키를 DB에 저장, status를 auth_confirmed로 변경
  console.log(`[Submit-V2] Real RPA: 인증 완료, 쿠키 저장 (${confirmResult.cookies?.length || 0}개)`);

  await prisma.submissionTrackingLog.create({
    data: { submissionId, step: 'auth_confirm', stepOrder: 3, status: 'success', message: '간편인증 완료', startedAt: new Date(), completedAt: new Date() },
  });

  await prisma.civilServiceSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'auth_confirmed',
      resultData: JSON.stringify({ ...resultData, cookies: confirmResult.cookies, authConfirmedAt: new Date().toISOString() }),
    },
  });

  return {
    success: true,
    submissionId,
    step: 'auth_confirmed',
    action: 'SUBMIT_READY',
    message: '✅ 인증 완료! 민원 제출을 시작합니다...',
  };
}

/**
 * Real RPA - Step 2: 민원 제출 (저장된 쿠키로 gov24 접수)
 * Vercel 60초 제한 내에 완료 가능 (~30-40초)
 */
async function handleRealRpaSubmit(submissionId: string, userId: string) {
  console.log(`[Submit-V2] Real RPA: 민원 제출 시작 (submissionId: ${submissionId})`);

  const submission = await prisma.civilServiceSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission || submission.userId !== userId) {
    return { success: false, error: '신청 건을 찾을 수 없습니다.' };
  }

  if (submission.status !== 'auth_confirmed') {
    return { success: false, error: `현재 상태: ${submission.status}. 인증 완료 상태가 아닙니다.` };
  }

  const resultData = JSON.parse(submission.resultData || '{}');
  const cookies = resultData.cookies;

  if (!cookies || cookies.length === 0) {
    return { success: false, error: '인증 쿠키가 없습니다. 인증을 다시 진행해주세요.' };
  }

  // serviceUrl 검증
  const serviceUrl = submission.targetUrl || '';
  if (!serviceUrl || !serviceUrl.includes('gov.kr')) {
    return { success: false, error: '정부24 민원 서비스 URL이 지정되지 않았습니다.' };
  }

  // 파일 정보 준비
  const files = [];
  if (resultData.fileBase64 && resultData.fileName) {
    files.push({
      fileName: resultData.fileName,
      fileBase64: resultData.fileBase64,
      mimeType: resultData.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
    });
  }

  // Worker 비동기 큐에 제출 작업 등록 (즉시 반환, 백그라운드 처리)
  console.log(`[Submit-V2] Real RPA: Worker /queue/add 호출 (파일 ${files.length}개, serviceUrl: ${serviceUrl})`);
  const queueResult = await callWorker('/queue/add', {
    taskType: 'gov24_submit',
    taskData: {
      cookies,
      serviceCode: submission.serviceCode || '',
      serviceUrl,
      formData: {},
      files,
    },
  });

  if (!queueResult.success || !queueResult.jobId) {
    await prisma.submissionTrackingLog.create({
      data: { submissionId, step: 'submit', stepOrder: 6, status: 'failed', message: queueResult.error || '작업 등록 실패', startedAt: new Date(), completedAt: new Date() },
    });
    return { success: false, submissionId, error: queueResult.error || '민원 제출 작업 등록에 실패했습니다.' };
  }

  // jobId를 DB에 저장, status를 submitting으로 변경
  console.log(`[Submit-V2] Real RPA: 큐 등록 완료 (jobId: ${queueResult.jobId})`);

  await prisma.civilServiceSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'submitting',
      resultData: JSON.stringify({ ...resultData, workerJobId: queueResult.jobId, submitStartedAt: new Date().toISOString() }),
    },
  });

  await prisma.submissionTrackingLog.create({
    data: { submissionId, step: 'submit_queued', stepOrder: 5, status: 'success', message: `Worker 큐 등록 (jobId: ${queueResult.jobId})`, startedAt: new Date(), completedAt: new Date() },
  });

  return {
    success: true,
    submissionId,
    step: 'submitting',
    status: 'submitting',
    workerJobId: queueResult.jobId,
    message: '📄 정부24에 서류를 제출하고 있습니다. 잠시 기다려주세요...',
  };
}

// =============================================================================
// Types & Schema
// =============================================================================

/** 문서 상태: SIGNED=서명 완료(날인 PDF 업로드), GENERATED=시스템 HWPX, UPLOADED=단순 업로드 */
type DocumentStatus = 'SIGNED' | 'GENERATED' | 'UPLOADED';

const GenerateSubmitSchema = z.object({
  mode: z.literal('generate'),
  templateCode: z.string().min(1),
  data: z.record(z.string()),
  serviceUrl: z.string().url(),
  serviceName: z.string().min(1),
  autoSubmit: z.boolean().default(false),
  documentStatus: z.enum(['SIGNED', 'GENERATED']).default('GENERATED'),
});

const UploadSubmitSchema = z.object({
  mode: z.literal('upload'),
  /** 업로드 API에서 반환된 파일 식별자 또는 경로 */
  filePath: z.string().min(1).optional(),
  /** base64 인코딩된 파일 데이터 (Vercel 서버리스 환경용) */
  fileBase64: z.string().min(1).optional(),
  /** 파일명 (base64 모드 시 필수) */
  fileName: z.string().min(1).optional(),
  serviceUrl: z.string().url().optional(),
  serviceName: z.string().min(1).optional(),
  autoSubmit: z.boolean().default(false),
  documentStatus: z.enum(['SIGNED', 'GENERATED', 'UPLOADED']).default('UPLOADED'),
  /** 간편인증 정보 (Real RPA용 - 비회원 로그인) */
  authData: z.object({
    name: z.string().min(1),
    rrn1: z.string().length(6),  // 주민번호 앞자리 (6자리)
    rrn2: z.string().length(7),  // 주민번호 뒷자리 (7자리)
    phoneNumber: z.string().min(10),
    carrier: z.string().optional(), // SKT, KT, LGU, etc.
    authMethod: z.enum(['kakao', 'naver', 'pass', 'toss']),
  }).optional(),
});

const DocumentIdSubmitSchema = z.object({
  mode: z.literal('document'),
  /** CivilServiceSubmission ID (기존 제출 건) */
  documentId: z.string().min(1),
  serviceUrl: z.string().url(),
  serviceName: z.string().min(1),
  autoSubmit: z.boolean().default(false),
});

const SubmitSchema = z.discriminatedUnion('mode', [
  GenerateSubmitSchema,
  UploadSubmitSchema,
  DocumentIdSubmitSchema,
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

    // --- Action: Confirm (인증 확인만) ---
    if (action === 'confirm') {
      return handleConfirm(request, session.user.id);
    }

    // --- Action: Submit (민원 제출) ---
    if (action === 'submit') {
      return handleSubmitAction(request, session.user.id);
    }

    // --- Action: Submit Status (제출 상태 폴링) ---
    if (action === 'submit-status') {
      return handleSubmitStatusAction(request, session.user.id);
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
    // Step 1: 파일 준비 (3가지 모드)
    // -----------------------------------------------------------------------
    let filePath: string;
    let fileType: string;
    let documentStatus: DocumentStatus;
    let hwpxMeta: { fileName: string; replacedCount: number } | null = null;
    let existingSubmission: any = null;

    if (input.mode === 'generate') {
      // --- Mode A: HWPX 생성 ---
      console.log(`[Submit-V2] Step 1A: HWPX 생성 - ${input.templateCode}`);
      documentStatus = input.documentStatus as DocumentStatus;

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

      // 필수 필드 검증
      const fields = JSON.parse(template.fields || '[]');
      const missingFields = validateRequiredFields(input.data, fields);
      if (missingFields.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `필수 항목이 누락되어 제출할 수 없습니다: ${missingFields.join(', ')}. 다시 입력해 주시겠습니까?`,
            missingFields,
            step: 'validate',
          },
          { status: 400 }
        );
      }

      // 데이터 변환 (체크박스, 날짜, 관할관청, 폴백)
      const transformedData = transformDataForHwpx(input.data, fields);
      const hwpxResult = await generateHwpx(templatePath, transformedData, template.outputFileName || undefined);

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

    } else if (input.mode === 'upload') {
      // --- Mode B: 업로드 파일 직접 제출 ---
      documentStatus = input.documentStatus as DocumentStatus;

      // base64 데이터가 있으면 /tmp에 임시 저장 (서버리스 환경)
      if (input.fileBase64) {
        const tmpDir = '/tmp/rpa-submit';
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const tmpFileName = input.fileName || `upload_${Date.now()}.pdf`;
        const tmpPath = path.join(tmpDir, tmpFileName);
        fs.writeFileSync(tmpPath, Buffer.from(input.fileBase64, 'base64'));
        filePath = tmpPath;
        fileType = Gov24Worker.detectFileType(filePath);
        console.log(`[Submit-V2] Step 1B: base64 → /tmp 저장 - ${tmpFileName} (${input.fileBase64.length} chars)`);
      } else if (input.filePath && fs.existsSync(input.filePath)) {
        filePath = input.filePath;
        fileType = Gov24Worker.detectFileType(filePath);
        console.log(`[Submit-V2] Step 1B: 로컬 파일 확인 - ${input.filePath}`);
      } else {
        return NextResponse.json(
          { success: false, error: '파일 데이터가 필요합니다. fileBase64 또는 유효한 filePath를 전달하세요.' },
          { status: 400 }
        );
      }

      // =====================================================================
      // Real RPA: Railway Worker를 통한 실제 간편인증 (authData가 있으면 항상 이 경로)
      // =====================================================================
      if (input.authData) {
        console.log(`[Submit-V2] Real-Time RPA: 간편인증 요청 (serviceUrl: ${input.serviceUrl || '없음'})`);
        const rpaResult = await handleRealRpaAuthRequest(
          session.user.id,
          input.authData,
          { filePath, fileType, fileName: input.fileName || '', fileBase64: input.fileBase64 || undefined },
          input.serviceName || '정부24 자동 접수',
          input.serviceUrl || ''
        );
        return NextResponse.json(rpaResult);
      }

      // 인증 정보 없으면 에러 (UI에서 인증 수단 선택 필요)
      if (!input.serviceUrl) {
        return NextResponse.json({
          success: false,
          error: '인증 정보가 필요합니다. 인증 수단(카카오/네이버/PASS/토스)과 개인정보를 입력해주세요.',
          requiresAuth: true,
        }, { status: 400 });
      }

    } else {
      // --- Mode C: documentId 기반 (기존 제출 건 조회) ---
      console.log(`[Submit-V2] Step 1C: documentId 조회 - ${input.documentId}`);

      existingSubmission = await prisma.civilServiceSubmission.findUnique({
        where: { id: input.documentId },
      });

      if (!existingSubmission || existingSubmission.userId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: '해당 문서를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const resultData = JSON.parse(existingSubmission.resultData || '{}');
      filePath = resultData.filePath;
      fileType = resultData.fileType || 'hwpx';
      documentStatus = resultData.documentStatus || 'GENERATED';

      if (!filePath || !fs.existsSync(filePath)) {
        return NextResponse.json(
          { success: false, error: '문서 파일을 찾을 수 없습니다. 파일이 만료되었을 수 있습니다.' },
          { status: 404 }
        );
      }

      hwpxMeta = resultData.hwpxMeta || null;
      console.log(`[Submit-V2] 기존 문서 로드: ${existingSubmission.serviceName} (${documentStatus})`);
    }

    // -----------------------------------------------------------------------
    // Step 2: 문서 상태 체크
    // -----------------------------------------------------------------------
    console.log(`[Submit-V2] Step 2: 문서 상태 = ${documentStatus}, 파일 형식 = ${fileType}`);

    if (documentStatus === 'SIGNED') {
      // 사용자가 날인 후 업로드한 PDF → 즉시 제출 가능
      console.log(`[Submit-V2] SIGNED 문서 - 바로 정부24 업로드`);
    } else if (documentStatus === 'GENERATED' && fileType === 'hwpx') {
      console.log(`[Submit-V2] HWPX 문서 (GENERATED) - 정부24 업로드 진행`);
    } else if (documentStatus === 'GENERATED' && fileType === 'pdf') {
      console.log(`[Submit-V2] 경고: PDF 문서 미서명. 제출 진행하나 반려 가능성 있음`);
    }

    // -----------------------------------------------------------------------
    // Step 3: DB 레코드 생성 (또는 기존 건 업데이트)
    // -----------------------------------------------------------------------
    let submission: any;

    const resolvedServiceUrl = input.mode === 'upload'
      ? (input.serviceUrl || '')
      : input.serviceUrl;
    const resolvedServiceName = input.mode === 'upload'
      ? (input.serviceName || '파일 접수')
      : input.serviceName;

    if (existingSubmission) {
      // Mode C: 기존 건 상태 업데이트
      submission = await prisma.civilServiceSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          status: 'processing',
          targetUrl: resolvedServiceUrl,
        },
      });
    } else {
      // Mode A/B: 새 레코드 생성
      submission = await prisma.civilServiceSubmission.create({
        data: {
          serviceName: resolvedServiceName,
          serviceCode: input.mode === 'generate' ? (input as any).templateCode : `upload_${fileType}`,
          targetSite: 'gov24',
          targetUrl: resolvedServiceUrl,
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
            documentStatus,
            hwpxMeta,
            pipeline: 'v2',
          }),
        },
      });
    }

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
      serviceUrl: resolvedServiceUrl,
      serviceName: resolvedServiceName,
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
          documentStatus,
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
      documentStatus,
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

  // Step 1: 인증 확인 (쿠키 획득)
  const rpaResult = await handleRealRpaConfirm(submissionId, userId);
  if (!rpaResult.success) {
    return NextResponse.json(rpaResult, { status: 400 });
  }
  return NextResponse.json(rpaResult);
  /*
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

  // ... legacy code removed ...
  */
}

// =============================================================================
// GET: Pipeline Info
// =============================================================================

export async function GET() {
  return NextResponse.json({
    success: true,
    version: 'v2',
    mode: 'real_rpa',
    worker: {
      url: RPA_WORKER_URL,
      status: 'connected',
      message: 'Railway Worker 연결됨',
    },
    features: [
      '파일 형식 자동 감지 (HWPX/PDF/JPG/PNG)',
      '문서 상태 체크 (SIGNED/GENERATED/UPLOADED)',
      '업로드 파일 직접 제출',
      '단계별 상세 트래킹',
      'Real RPA (Railway Worker)',
      '다중 인증 수단 지원 (카카오/네이버/PASS/토스)',
    ],
    modes: {
      generate: {
        description: 'HWPX 생성 후 정부24 제출',
        requiredFields: ['templateCode', 'data', 'serviceUrl', 'serviceName'],
      },
      upload: {
        description: '업로드된 파일 직접 정부24 제출 (비회원 로그인)',
        requiredFields: ['fileBase64', 'fileName', 'authData'],
        authData: {
          name: '이름',
          rrn1: '주민번호 앞자리 (6자리)',
          rrn2: '주민번호 뒷자리 (7자리)',
          phoneNumber: '휴대폰번호',
          carrier: '통신사 (선택)',
          authMethod: 'kakao | naver | pass | toss',
        },
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
// Action: Submit Status (비동기 제출 상태 폴링)
// =============================================================================

async function handleSubmitStatusAction(request: NextRequest, userId: string) {
  const body = await request.json();
  const { submissionId } = body;

  if (!submissionId) {
    return NextResponse.json({ success: false, error: 'submissionId 필요' }, { status: 400 });
  }

  const submission = await prisma.civilServiceSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission || submission.userId !== userId) {
    return NextResponse.json({ success: false, error: '신청 건을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 이미 완료/실패된 경우 DB 상태 그대로 반환
  if (submission.status === 'submitted') {
    return NextResponse.json({
      success: true, submissionId, step: 'submitted', status: 'submitted',
      message: submission.applicationNumber ? `✅ 접수 완료! 접수번호: ${submission.applicationNumber}` : '✅ 제출 완료!',
      applicationNumber: submission.applicationNumber,
    });
  }
  if (submission.status === 'failed') {
    return NextResponse.json({
      success: false, submissionId, step: 'failed', status: 'failed',
      error: submission.errorMessage || '민원 제출 실패',
    });
  }

  const resultData = JSON.parse(submission.resultData || '{}');
  const workerJobId = resultData.workerJobId;

  if (!workerJobId) {
    return NextResponse.json({ success: false, error: 'Worker 작업 ID가 없습니다.' }, { status: 400 });
  }

  // Worker에서 작업 상태 조회
  console.log(`[Submit-V2] 제출 상태 폴링: jobId=${workerJobId}`);
  const statusResult = await callWorkerGet(`/tasks/${workerJobId}`);

  if (!statusResult.success) {
    return NextResponse.json({
      success: true, submissionId, step: 'submitting', status: 'submitting',
      message: '📄 서류 제출 진행 중...',
    });
  }

  // Worker 작업 완료
  if (statusResult.state === 'completed') {
    const result = statusResult.result || {};

    if (result.success === true) {
      // 실제 제출 성공
      const appNumber = result.receiptNumber || null;

      await prisma.civilServiceSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'submitted',
          applicationNumber: appNumber,
          completedAt: new Date(),
          resultData: JSON.stringify({
            ...resultData,
            fileBase64: undefined,
            submitResult: { receiptNumber: appNumber, finalUrl: result.finalUrl, phase: result.phase },
            screenshot: result.screenshot || null,
            completedAt: new Date().toISOString(),
          }),
        },
      });

      await prisma.submissionTrackingLog.create({
        data: { submissionId, step: 'submitted', stepOrder: 6, status: 'success', message: appNumber ? `정부24 접수 완료 (접수번호: ${appNumber})` : '정부24 제출 완료', startedAt: new Date(), completedAt: new Date() },
      });

      console.log(`[Submit-V2] 제출 완료: 접수번호=${appNumber || '미확인'}`);

      return NextResponse.json({
        success: true, submissionId, step: 'submitted', status: 'submitted',
        message: appNumber ? `✅ 정부24 접수 완료! 접수번호: ${appNumber}` : '✅ 정부24에 제출되었습니다.',
        applicationNumber: appNumber,
        screenshot: result.screenshot || null,
      });
    } else {
      // Worker 함수는 완료했지만 제출 실패
      const errorMsg = result.error || '정부24 제출 중 오류가 발생했습니다.';
      const errorCode = result.errorCode || null;

      await prisma.civilServiceSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'failed',
          errorMessage: errorMsg,
          resultData: JSON.stringify({
            ...resultData,
            fileBase64: undefined,
            failedResult: { error: errorMsg, errorCode, phase: result.phase, finalUrl: result.finalUrl },
            screenshot: result.screenshot || null,
            failedAt: new Date().toISOString(),
          }),
        },
      });

      await prisma.submissionTrackingLog.create({
        data: { submissionId, step: 'submit', stepOrder: 6, status: 'failed', message: `[${errorCode || 'UNKNOWN'}] ${errorMsg}`, startedAt: new Date(), completedAt: new Date() },
      });

      console.log(`[Submit-V2] 제출 실패 (Worker completed but success=false): [${errorCode}] ${errorMsg}`);

      return NextResponse.json({
        success: false, submissionId, step: 'failed', status: 'failed',
        error: errorMsg,
        errorCode,
        screenshot: result.screenshot || null,
      });
    }
  }

  // Worker 작업 실패 (큐 레벨 에러)
  if (statusResult.state === 'failed') {
    const errorMsg = statusResult.failedReason || '민원 제출 실패';
    const result = statusResult.result || {};

    await prisma.civilServiceSubmission.update({
      where: { id: submissionId },
      data: { status: 'failed', errorMessage: errorMsg },
    });

    await prisma.submissionTrackingLog.create({
      data: { submissionId, step: 'submit', stepOrder: 6, status: 'failed', message: errorMsg, startedAt: new Date(), completedAt: new Date() },
    });

    return NextResponse.json({
      success: false, submissionId, step: 'failed', status: 'failed',
      error: errorMsg,
      screenshot: result.screenshot || null,
    });
  }

  // 아직 진행 중 (pending / processing)
  return NextResponse.json({
    success: true, submissionId, step: 'submitting', status: 'submitting',
    progress: statusResult.progress || 0,
    message: `📄 정부24에 서류를 제출하고 있습니다... (${statusResult.progress || 0}%)`,
  });
}

// =============================================================================
// Action: Submit (민원 제출 - 인증 완료 후 별도 호출)
// =============================================================================

async function handleSubmitAction(request: NextRequest, userId: string) {
  const body = await request.json();
  const { submissionId } = body;

  if (!submissionId) {
    return NextResponse.json({ success: false, error: 'submissionId 필요' }, { status: 400 });
  }

  const result = await handleRealRpaSubmit(submissionId, userId);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
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
