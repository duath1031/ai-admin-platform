/**
 * =============================================================================
 * 문서24 자동접수 API
 * =============================================================================
 * POST /api/rpa/doc24-submit
 *   - 사용자 문서24 계정 조회 → 비밀번호 복호화 → Worker 호출 → DB 기록
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

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const {
      recipient,
      title,
      content,
      files, // [{fileName, fileBase64, mimeType}]
    } = body;

    if (!recipient || !title) {
      return NextResponse.json(
        { error: '수신기관과 제목은 필수입니다.' },
        { status: 400 }
      );
    }

    // 2. 문서24 계정 조회
    const account = await prisma.doc24Account.findUnique({
      where: { userId: session.user.id },
    });

    if (!account || !account.isActive) {
      return NextResponse.json({
        success: false,
        requiresAccountLink: true,
        error: '문서24 계정을 먼저 연동해주세요. 마이페이지에서 계정을 연동할 수 있습니다.',
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

    console.log(`[Doc24 API] 제출 시작: submissionId=${submission.id}, recipient=${recipient}, title=${title}`);

    // 5. Worker 호출
    const workerResult = await callWorker('/doc24/submit', {
      loginId: account.doc24LoginId,
      password: decryptedPassword,
      recipient,
      title,
      content: content || '',
      files: files || [],
    });

    // 6. 결과에 따라 DB 업데이트
    if (workerResult.success) {
      await prisma.doc24Submission.update({
        where: { id: submission.id },
        data: {
          status: 'sent',
          receiptNumber: workerResult.receiptNumber || null,
          completedAt: new Date(),
        },
      });

      // 계정 마지막 사용일 업데이트
      await prisma.doc24Account.update({
        where: { userId: session.user.id },
        data: { lastUsedAt: new Date() },
      });

      console.log(`[Doc24 API] 발송 성공: receiptNumber=${workerResult.receiptNumber}`);
    } else {
      await prisma.doc24Submission.update({
        where: { id: submission.id },
        data: {
          status: 'failed',
          errorMessage: workerResult.error || '알 수 없는 오류',
        },
      });

      console.log(`[Doc24 API] 발송 실패: ${workerResult.error}`);
    }

    // 7. 결과 반환
    return NextResponse.json({
      success: workerResult.success,
      submissionId: submission.id,
      receiptNumber: workerResult.receiptNumber || null,
      documentUrl: workerResult.documentUrl || null,
      screenshot: workerResult.screenshot || null,
      message: workerResult.message || workerResult.error || null,
      error: workerResult.success ? undefined : (workerResult.error || '발송에 실패했습니다.'),
    });

  } catch (error: any) {
    console.error('[Doc24 API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류' },
      { status: 500 }
    );
  }
}
