/**
 * 문서24 수신기관 실시간 검색 API
 * POST /api/doc24/org-search
 * Body: { keyword: string }
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

async function callWorker(endpoint: string, data: Record<string, unknown>, timeoutMs = 45000) {
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
      return { success: false, error: '검색 시간 초과' };
    }
    return { success: false, error: `Worker 연결 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { keyword } = body;

    if (!keyword || keyword.length < 2) {
      return NextResponse.json({ success: false, error: '검색어는 2자 이상 입력해주세요.' });
    }

    // 사용자의 문서24 계정 조회
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

    let decryptedPassword: string;
    try {
      decryptedPassword = decrypt(
        account.encryptedPassword,
        account.encryptionIv,
        account.encryptionTag
      );
    } catch {
      return NextResponse.json({
        success: false,
        error: '문서24 계정 정보를 복호화할 수 없습니다.',
      }, { status: 500 });
    }

    const result = await callWorker('/doc24/org-search', {
      loginId: account.doc24LoginId,
      password: decryptedPassword,
      accountType: account.accountType || 'personal',
      keyword,
    }, 55000);

    // 디버깅 로그 출력
    if (result.logs) {
      console.log('[Doc24 OrgSearch] Worker logs:', JSON.stringify(result.logs, null, 2));
    }
    if (result.popupDump) {
      console.log('[Doc24 OrgSearch] Popup dump:', JSON.stringify(result.popupDump, null, 2));
    }
    if (result.afterSearchText) {
      console.log('[Doc24 OrgSearch] After search text:', result.afterSearchText);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Doc24 OrgSearch] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
