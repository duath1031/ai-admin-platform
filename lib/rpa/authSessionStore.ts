/**
 * 간편인증 세션 인메모리 관리
 * - auth/request에서 세션 등록
 * - auth/confirm에서 세션 조회/업데이트
 */

interface AuthSessionInfo {
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'waiting_auth' | 'authenticated' | 'failed' | 'expired';
}

const sessionStore = new Map<string, AuthSessionInfo>();

export function registerSession(sessionId: string) {
  const now = new Date();
  sessionStore.set(sessionId, {
    sessionId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    status: 'waiting_auth',
  });
}

export function getSession(sessionId: string): AuthSessionInfo | undefined {
  return sessionStore.get(sessionId);
}

export function updateSessionStatus(sessionId: string, status: AuthSessionInfo['status']) {
  const session = sessionStore.get(sessionId);
  if (session) {
    session.status = status;
  }
}

export function deleteSession(sessionId: string) {
  sessionStore.delete(sessionId);
}

// 주기적 만료 세션 정리 (1분마다)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = new Date();
    for (const [id, session] of sessionStore.entries()) {
      if (session.expiresAt < now) {
        sessionStore.delete(id);
      }
    }
  }, 60000);
}
