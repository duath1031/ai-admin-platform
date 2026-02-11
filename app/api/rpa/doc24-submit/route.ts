/**
 * =============================================================================
 * 문서24 자동접수 API (비동기 폴링 방식)
 * =============================================================================
 * POST /api/rpa/doc24-submit
 *   - Worker에 작업 등록 → jobId 즉시 반환
 *   - 프론트에서 GET /api/rpa/doc24-submit?jobId=xxx 로 폴링
 *
 * GET /api/rpa/doc24-submit?jobId=xxx
 *   - Worker에서 작업 상태 조회
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

const RPA_WORKER_URL = process.env.RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
const RPA_WORKER_API_KEY = process.env.RPA_WORKER_API_KEY || process.env.WORKER_API_KEY || '';

async function callWorker(endpoint: string, method: string, data?: Record<string, unknown>, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': RPA_WORKER_API_KEY,
      },
      signal: controller.signal,
    };
    if (data && method === 'POST') {
      options.body = JSON.stringify(data);
    }
    const response = await fetch(`${RPA_WORKER_URL}${endpoint}`, options);
    return response.json();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: `Worker 응답 시간 초과` };
    }
    return { success: false, error: `Worker 연결 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` };
  } finally {
    clearTimeout(timer);
  }
}

// GET - 작업 상태 폴링
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ error: 'jobId가 필요합니다' }, { status: 400 });
    }

    // Worker에서 작업 상태 조회
    const jobStatus = await callWorker(`/jobs/${jobId}`, 'GET');

    if (!jobStatus || jobStatus.error) {
      return NextResponse.json({ state: 'unknown', error: jobStatus?.error || '작업을 찾을 수 없습니다' });
    }

    // 작업 완료 시 DB 업데이트
    if (jobStatus.state === 'completed' && jobStatus.result) {
      const result = jobStatus.result;
      const submissionId = request.nextUrl.searchParams.get('submissionId');

      if (submissionId) {
        try {
          if (result.success) {
            await prisma.doc24Submission.update({
              where: { id: submissionId },
              data: {
                status: 'sent',
                receiptNumber: result.receiptNumber || null,
                completedAt: new Date(),
              },
            });
            await prisma.doc24Account.update({
              where: { userId: session.user.id },
              data: { lastUsedAt: new Date() },
            });
          } else {
            await prisma.doc24Submission.update({
              where: { id: submissionId },
              data: {
                status: 'failed',
                errorMessage: result.error || '발송 실패',
              },
            });
          }
        } catch (dbErr) {
          console.error('[Doc24 Poll] DB 업데이트 실패:', dbErr);
        }
      }

      return NextResponse.json({
        state: 'completed',
        success: result.success,
        receiptNumber: result.receiptNumber || null,
        documentUrl: result.documentUrl || null,
        screenshot: result.screenshot || null,
        message: result.message || result.error || null,
        error: result.success ? undefined : (result.error || '발송 실패'),
      });
    }

    if (jobStatus.state === 'failed') {
      const submissionId = request.nextUrl.searchParams.get('submissionId');
      if (submissionId) {
        try {
          await prisma.doc24Submission.update({
            where: { id: submissionId },
            data: {
              status: 'failed',
              errorMessage: jobStatus.failedReason || '작업 실패',
            },
          });
        } catch (dbErr) {
          console.error('[Doc24 Poll] DB 업데이트 실패:', dbErr);
        }
      }
      return NextResponse.json({
        state: 'failed',
        success: false,
        error: jobStatus.failedReason || '작업이 실패했습니다.',
      });
    }

    // 아직 진행 중
    return NextResponse.json({
      state: jobStatus.state || 'processing',
      progress: jobStatus.progress || 0,
    });
  } catch (error: any) {
    console.error('[Doc24 Poll] Error:', error);
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}

// POST - 작업 등록
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { recipient, recipientCode, title, content, files } = body;

    if (!recipient || !title) {
      return NextResponse.json({ error: '수신기관과 제목은 필수입니다.' }, { status: 400 });
    }

    // 2. 문서24 계정 조회
    const account = await prisma.doc24Account.findUnique({
      where: { userId: session.user.id },
    });

    if (!account || !account.isActive) {
      return NextResponse.json({
        success: false,
        requiresAccountLink: true,
        error: '문서24 계정을 먼저 연동해주세요.',
      });
    }

    // 3. 비밀번호 복호화
    let decryptedPassword: string;
    try {
      decryptedPassword = decrypt(
        account.encryptedPassword,
        account.encryptionIv,
        account.encryptionTag
      );
    } catch (decryptErr) {
      console.error('[Doc24 API] 비밀번호 복호화 실패:', decryptErr);
      return NextResponse.json({
        success: false,
        error: '문서24 계정 정보를 복호화할 수 없습니다. 계정을 다시 연동해주세요.',
      }, { status: 500 });
    }

    // 4. DB에 제출 기록 생성
    const submission = await prisma.doc24Submission.create({
      data: {
        userId: session.user.id,
        recipient,
        title,
        content: content || null,
        attachmentNames: files ? JSON.stringify(files.map((f: any) => f.fileName)) : null,
        attachmentCount: files ? files.length : 0,
        status: 'submitting',
        startedAt: new Date(),
      },
    });

    console.log(`[Doc24 API] 작업 등록: submissionId=${submission.id}, recipient=${recipient}`);

    // 5. Worker에 비동기 작업 등록
    const workerResult = await callWorker('/doc24/submit', 'POST', {
      loginId: account.doc24LoginId,
      password: decryptedPassword,
      accountType: account.accountType || 'personal',
      recipient,
      recipientCode: recipientCode || '',
      title,
      content: content || '',
      files: files || [],
    });

    if (!workerResult.success && !workerResult.async) {
      // Worker 연결 자체가 실패한 경우
      await prisma.doc24Submission.update({
        where: { id: submission.id },
        data: { status: 'failed', errorMessage: workerResult.error },
      });
      return NextResponse.json({
        success: false,
        error: workerResult.error || 'Worker 연결 실패',
      });
    }

    // 6. jobId와 submissionId 반환 (프론트에서 폴링)
    return NextResponse.json({
      success: true,
      async: true,
      jobId: workerResult.jobId,
      submissionId: submission.id,
      message: '문서24 발송 작업이 시작되었습니다.',
    });

  } catch (error: any) {
    console.error('[Doc24 API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류' },
      { status: 500 }
    );
  }
}
