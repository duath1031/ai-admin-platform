/**
 * =============================================================================
 * Keep-Alive Self-Ping Module
 * =============================================================================
 *
 * 5분마다 자체 /api/health 엔드포인트를 호출하여
 * 서버리스 함수 콜드 스타트를 방지하고 Railway RPA Worker 상태를 확인한다.
 *
 * 사용법:
 *   import { startKeepAlive, stopKeepAlive } from '@/lib/cron/keepAlive';
 *   startKeepAlive();  // 서버 시작 시
 *   stopKeepAlive();   // 종료 시
 */

const PING_INTERVAL_MS = 5 * 60 * 1000; // 5분

let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * 자체 health 엔드포인트에 ping을 보낸다.
 */
async function ping(): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || process.env.VERCEL_URL
    || process.env.NEXTAUTH_URL
    || '';

  if (!baseUrl) {
    console.warn('[KeepAlive] BASE_URL 미설정 - ping 스킵');
    return;
  }

  const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

  try {
    const res = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[KeepAlive] Ping OK: ${res.status} - ${data.status || 'unknown'}`);
  } catch (err) {
    console.warn(`[KeepAlive] Ping 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Railway RPA Worker ping (설정된 경우)
  const rpaUrl = process.env.RPA_WORKER_URL || process.env.NEXT_PUBLIC_RPA_URL;
  if (rpaUrl) {
    try {
      const res = await fetch(`${rpaUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      console.log(`[KeepAlive] RPA Worker: ${res.ok ? 'OK' : `Error ${res.status}`}`);
    } catch (err) {
      console.warn(`[KeepAlive] RPA Worker unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * Keep-Alive 스케줄러를 시작한다.
 * 이미 실행 중이면 무시된다.
 */
export function startKeepAlive(): void {
  if (isRunning) {
    console.log('[KeepAlive] 이미 실행 중');
    return;
  }

  isRunning = true;
  console.log(`[KeepAlive] 시작 (${PING_INTERVAL_MS / 1000}초 간격)`);

  // 즉시 1회 실행
  ping().catch(() => {});

  intervalId = setInterval(() => {
    ping().catch(() => {});
  }, PING_INTERVAL_MS);
}

/**
 * Keep-Alive 스케줄러를 중지한다.
 */
export function stopKeepAlive(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
  console.log('[KeepAlive] 중지됨');
}

/**
 * 현재 상태를 반환한다.
 */
export function getKeepAliveStatus(): { running: boolean; intervalMs: number } {
  return {
    running: isRunning,
    intervalMs: PING_INTERVAL_MS,
  };
}
