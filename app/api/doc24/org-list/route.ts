/**
 * 문서24 수신기관 목록 API
 *
 * GET /api/doc24/org-list?keyword=강남구  - 캐시된 기관 목록 조회 (검색 필터 가능)
 * POST /api/doc24/org-list               - 기관 목록 크롤링 트리거
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

async function callWorker(endpoint: string, method: string, data?: Record<string, unknown>, timeoutMs = 55000) {
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
    const url = `${RPA_WORKER_URL}${endpoint}${method === 'GET' && data ? '?' + new URLSearchParams(data as Record<string, string>).toString() : ''}`;
    const response = await fetch(url, options);
    return response.json();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Worker 응답 시간 초과' };
    }
    return { success: false, error: `Worker 연결 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` };
  } finally {
    clearTimeout(timer);
  }
}

// GET - 캐시된 기관 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const keyword = request.nextUrl.searchParams.get('keyword') || '';
    const result = await callWorker('/doc24/org-list', 'GET', keyword ? { keyword } : undefined, 10000);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - 기관 목록 크롤링 트리거
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
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

    const result = await callWorker('/doc24/org-crawl', 'POST', {
      loginId: account.doc24LoginId,
      password: decryptedPassword,
      accountType: account.accountType || 'personal',
    }, 55000);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
