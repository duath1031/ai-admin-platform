/**
 * Vercel Cron: Keep-Alive Self-Ping
 *
 * 5분마다 실행되어 서버리스 함수의 콜드 스타트를 방지하고
 * Railway RPA Worker의 상태를 확인한다.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';

const RPA_WORKER_URL = process.env.RPA_WORKER_URL || process.env.NEXT_PUBLIC_RPA_URL || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: NextRequest) {
  // Vercel Cron 보안 검증
  if (CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results: Record<string, string> = {
    platform: 'ok',
    timestamp: new Date().toISOString(),
  };

  // Railway RPA Worker health check
  if (RPA_WORKER_URL) {
    try {
      const res = await fetch(`${RPA_WORKER_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      results.rpaWorker = res.ok ? 'ok' : `error:${res.status}`;
    } catch (e) {
      results.rpaWorker = `unreachable:${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    results.rpaWorker = 'not_configured';
  }

  console.log(`[KeepAlive] ${JSON.stringify(results)}`);

  return NextResponse.json({
    success: true,
    ...results,
  });
}
