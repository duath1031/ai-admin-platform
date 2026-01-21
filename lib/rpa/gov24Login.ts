/**
 * =============================================================================
 * [Patent Technology] Government24 Simple Authentication RPA Module
 * =============================================================================
 *
 * AI-Powered Government24 Authentication Automation
 *
 * [Technical Innovation Points]
 * 1. User-Agent Stealth - Bot detection bypass
 * 2. Session Cookie Extraction - Login session capture
 * 3. KakaoTalk Simple Auth Flow - Mobile authentication handling
 * 4. Volatile Memory Security - No PII stored in database
 *
 * [Security Considerations]
 * - 주민번호/개인정보는 메모리에서만 휘발성으로 사용
 * - DB 저장 절대 금지
 * - 세션은 5분 단기 만료
 *
 * @author AI Admin Platform
 * @version 1.0.0
 * =============================================================================
 */

import { chromium, Browser, Page, BrowserContext, Cookie } from 'playwright';
import { randomUUID } from 'crypto';

// =============================================================================
// Type Definitions
// =============================================================================

export type AuthCarrier = 'SKT' | 'KT' | 'LGU' | 'SKT_MVNO' | 'KT_MVNO' | 'LGU_MVNO';

export interface AuthRequestInput {
  name: string;
  birthDate: string; // YYYYMMDD 형식
  phoneNumber: string;
  carrier: AuthCarrier;
}

export interface AuthSession {
  sessionId: string;
  status: 'pending' | 'waiting_auth' | 'authenticated' | 'failed' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  cookies?: Cookie[];
  errorMessage?: string;
}

export interface Gov24AuthResult {
  success: boolean;
  sessionId: string;
  status: AuthSession['status'];
  message: string;
  cookies?: Cookie[];
}

// =============================================================================
// Constants
// =============================================================================

const GOV24_URLS = {
  main: 'https://www.gov.kr',
  login: 'https://www.gov.kr/nlogin',
  simpleAuth: 'https://www.gov.kr/nlogin?authType=simple',
  myPage: 'https://www.gov.kr/portal/mypage',
};

const SESSION_TTL_MS = 5 * 60 * 1000; // 5분

// User-Agent Stealth 설정
const STEALTH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

// =============================================================================
// In-Memory Session Store (휘발성 - 서버 재시작시 초기화)
// =============================================================================

const sessionStore = new Map<string, AuthSession>();

// 만료된 세션 자동 정리 (1분마다)
setInterval(() => {
  const now = new Date();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (session.expiresAt < now) {
      sessionStore.delete(sessionId);
      console.log(`[Gov24Auth] Session expired and removed: ${sessionId}`);
    }
  }
}, 60 * 1000);

// =============================================================================
// [Patent] Gov24 Authentication Class
// =============================================================================

export class Gov24Authenticator {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionId: string;

  constructor() {
    this.sessionId = randomUUID();
  }

  /**
   * [Patent] Initialize Stealth Browser
   * 봇 탐지를 우회하기 위한 브라우저 설정
   */
  private async initStealthBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: STEALTH_USER_AGENT,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      permissions: ['geolocation'],
      extraHTTPHeaders: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    // WebDriver 감지 우회
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Chrome 속성 추가
      Object.defineProperty(window, 'chrome', {
        value: {
          runtime: {},
        },
      });

      // Permissions 우회
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(30000);

    console.log(`[Gov24Auth] Stealth browser initialized for session: ${this.sessionId}`);
  }

  /**
   * [Patent] Request Simple Authentication
   * 간편인증(카카오톡) 요청을 시작
   */
  async requestAuth(input: AuthRequestInput): Promise<Gov24AuthResult> {
    const session: AuthSession = {
      sessionId: this.sessionId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    };
    sessionStore.set(this.sessionId, session);

    try {
      await this.initStealthBrowser();

      if (!this.page) {
        throw new Error('Browser page not initialized');
      }

      // 정부24 로그인 페이지 이동
      console.log(`[Gov24Auth] Navigating to login page...`);
      await this.page.goto(GOV24_URLS.simpleAuth, {
        waitUntil: 'networkidle',
      });

      // 페이지 로드 대기
      await this.page.waitForTimeout(2000);

      // 간편인증 탭/버튼 클릭 (카카오톡)
      const authMethodSelectors = [
        'button:has-text("카카오톡")',
        'a:has-text("카카오톡")',
        '[data-auth-type="kakao"]',
        '#kakao-auth-btn',
        '.auth-kakao',
      ];

      let authMethodFound = false;
      for (const selector of authMethodSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            await element.click();
            authMethodFound = true;
            console.log(`[Gov24Auth] Clicked auth method: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!authMethodFound) {
        console.log(`[Gov24Auth] Auth method button not found, continuing with form fill`);
      }

      await this.page.waitForTimeout(1000);

      // 이름 입력
      await this.fillInputField(['input[name="userName"]', 'input[name="name"]', '#userName'], input.name);

      // 생년월일 입력
      await this.fillInputField(
        ['input[name="birthDate"]', 'input[name="birth"]', '#birthDate'],
        input.birthDate
      );

      // 휴대폰 번호 입력
      await this.fillInputField(
        ['input[name="phoneNo"]', 'input[name="phone"]', '#phoneNo'],
        input.phoneNumber
      );

      // 통신사 선택
      await this.selectCarrier(input.carrier);

      // 인증 요청 버튼 클릭
      const submitSelectors = [
        'button:has-text("인증요청")',
        'button:has-text("인증 요청")',
        'button[type="submit"]',
        '#auth-submit-btn',
        '.btn-auth-request',
      ];

      let submitClicked = false;
      for (const selector of submitSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            await element.click();
            submitClicked = true;
            console.log(`[Gov24Auth] Clicked submit button: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!submitClicked) {
        // 폼 제출 시도
        await this.page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) form.submit();
        });
      }

      // 상태 업데이트
      session.status = 'waiting_auth';
      sessionStore.set(this.sessionId, session);

      console.log(`[Gov24Auth] Auth request sent, waiting for user authentication`);

      return {
        success: true,
        sessionId: this.sessionId,
        status: 'waiting_auth',
        message: '카카오톡에서 인증을 완료해주세요. 인증 완료 후 confirm API를 호출하세요.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Gov24Auth] Auth request failed:`, errorMessage);

      session.status = 'failed';
      session.errorMessage = errorMessage;
      sessionStore.set(this.sessionId, session);

      return {
        success: false,
        sessionId: this.sessionId,
        status: 'failed',
        message: `인증 요청 실패: ${errorMessage}`,
      };
    }
  }

  /**
   * [Patent] Confirm Authentication
   * 사용자가 카카오톡에서 인증을 완료한 후 세션 확인
   */
  async confirmAuth(sessionId: string): Promise<Gov24AuthResult> {
    const session = sessionStore.get(sessionId);

    if (!session) {
      return {
        success: false,
        sessionId,
        status: 'failed',
        message: '세션을 찾을 수 없습니다. 인증 요청을 다시 시작해주세요.',
      };
    }

    if (session.expiresAt < new Date()) {
      sessionStore.delete(sessionId);
      return {
        success: false,
        sessionId,
        status: 'expired',
        message: '세션이 만료되었습니다. 인증 요청을 다시 시작해주세요.',
      };
    }

    if (session.status === 'authenticated' && session.cookies) {
      return {
        success: true,
        sessionId,
        status: 'authenticated',
        message: '이미 인증이 완료되었습니다.',
        cookies: session.cookies,
      };
    }

    try {
      if (!this.page) {
        throw new Error('Browser session not found');
      }

      // 인증 완료 여부 확인 (페이지 상태 체크)
      const authCompleted = await this.checkAuthCompletion();

      if (authCompleted) {
        // 쿠키 추출
        const cookies = await this.context?.cookies() || [];

        session.status = 'authenticated';
        session.cookies = cookies;
        sessionStore.set(sessionId, session);

        console.log(`[Gov24Auth] Authentication confirmed for session: ${sessionId}`);

        // 브라우저 정리 (쿠키는 보관)
        await this.cleanup();

        return {
          success: true,
          sessionId,
          status: 'authenticated',
          message: '인증이 완료되었습니다.',
          cookies,
        };
      } else {
        return {
          success: false,
          sessionId,
          status: 'waiting_auth',
          message: '아직 인증이 완료되지 않았습니다. 카카오톡에서 인증을 완료해주세요.',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Gov24Auth] Confirm auth failed:`, errorMessage);

      return {
        success: false,
        sessionId,
        status: 'failed',
        message: `인증 확인 실패: ${errorMessage}`,
      };
    }
  }

  /**
   * 인증 완료 여부 체크
   */
  private async checkAuthCompletion(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // 다양한 인증 완료 신호 체크
      const completionIndicators = [
        // URL 변화 체크
        async () => {
          const url = this.page!.url();
          return url.includes('mypage') || url.includes('main') || url.includes('success');
        },
        // 로그인 완료 요소 체크
        async () => {
          const logoutBtn = await this.page!.$('button:has-text("로그아웃")');
          return logoutBtn !== null;
        },
        // 마이페이지 링크 체크
        async () => {
          const myPageLink = await this.page!.$('a:has-text("마이페이지")');
          return myPageLink !== null;
        },
        // 사용자 정보 요소 체크
        async () => {
          const userInfo = await this.page!.$('.user-info, .member-info, #user-name');
          return userInfo !== null;
        },
      ];

      for (const check of completionIndicators) {
        if (await check()) {
          return true;
        }
      }

      // 페이지 새로고침 후 재확인
      await this.page.reload({ waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);

      for (const check of completionIndicators) {
        if (await check()) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 입력 필드 채우기 헬퍼
   */
  private async fillInputField(selectors: string[], value: string): Promise<void> {
    if (!this.page) return;

    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          // JavaScript injection으로 값 입력 (보안 키보드 우회)
          await this.page.evaluate(
            ({ sel, val }) => {
              const el = document.querySelector(sel) as HTMLInputElement;
              if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            },
            { sel: selector, val: value }
          );
          console.log(`[Gov24Auth] Filled field: ${selector}`);
          return;
        }
      } catch {
        continue;
      }
    }
    console.warn(`[Gov24Auth] Could not find input field for: ${selectors.join(', ')}`);
  }

  /**
   * 통신사 선택 헬퍼
   */
  private async selectCarrier(carrier: AuthCarrier): Promise<void> {
    if (!this.page) return;

    const carrierMap: Record<AuthCarrier, string[]> = {
      SKT: ['SKT', 'SK텔레콤', '에스케이텔레콤'],
      KT: ['KT', '케이티'],
      LGU: ['LGU+', 'LG유플러스', 'LG U+'],
      SKT_MVNO: ['SKT 알뜰폰', 'SK 알뜰'],
      KT_MVNO: ['KT 알뜰폰', 'KT 알뜰'],
      LGU_MVNO: ['LGU+ 알뜰폰', 'LG 알뜰'],
    };

    const carrierTexts = carrierMap[carrier];

    // Select 드롭다운 시도
    const selectSelectors = ['select[name="carrier"]', 'select[name="telecom"]', '#carrier-select'];
    for (const selector of selectSelectors) {
      try {
        const select = await this.page.$(selector);
        if (select) {
          await select.selectOption({ label: carrierTexts[0] });
          console.log(`[Gov24Auth] Selected carrier from dropdown: ${carrier}`);
          return;
        }
      } catch {
        continue;
      }
    }

    // 라디오 버튼 또는 버튼 클릭 시도
    for (const text of carrierTexts) {
      try {
        const element = await this.page.$(`input[value*="${text}"], label:has-text("${text}"), button:has-text("${text}")`);
        if (element) {
          await element.click();
          console.log(`[Gov24Auth] Clicked carrier option: ${text}`);
          return;
        }
      } catch {
        continue;
      }
    }

    console.warn(`[Gov24Auth] Could not select carrier: ${carrier}`);
  }

  /**
   * 리소스 정리
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      console.log(`[Gov24Auth] Browser resources cleaned up for session: ${this.sessionId}`);
    } catch (error) {
      console.error(`[Gov24Auth] Cleanup error:`, error);
    }
  }

  /**
   * 세션 ID getter
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// =============================================================================
// Session Management Functions
// =============================================================================

/**
 * 세션 조회
 */
export function getSession(sessionId: string): AuthSession | undefined {
  return sessionStore.get(sessionId);
}

/**
 * 세션 삭제
 */
export function deleteSession(sessionId: string): boolean {
  return sessionStore.delete(sessionId);
}

/**
 * 활성 세션 수 조회
 */
export function getActiveSessionCount(): number {
  return sessionStore.size;
}

// =============================================================================
// Export Helper Functions
// =============================================================================

/**
 * 간편인증 요청 시작
 */
export async function requestGov24Auth(input: AuthRequestInput): Promise<Gov24AuthResult> {
  const authenticator = new Gov24Authenticator();
  return authenticator.requestAuth(input);
}

/**
 * 간편인증 완료 확인
 */
export async function confirmGov24Auth(sessionId: string): Promise<Gov24AuthResult> {
  const session = sessionStore.get(sessionId);

  if (!session) {
    return {
      success: false,
      sessionId,
      status: 'failed',
      message: '세션을 찾을 수 없습니다.',
    };
  }

  // 이미 인증된 경우
  if (session.status === 'authenticated' && session.cookies) {
    return {
      success: true,
      sessionId,
      status: 'authenticated',
      message: '인증이 완료되었습니다.',
      cookies: session.cookies,
    };
  }

  // 새 authenticator로 확인 시도
  const authenticator = new Gov24Authenticator();
  return authenticator.confirmAuth(sessionId);
}

/**
 * 인증된 세션으로 민원 접수 실행
 */
export async function submitCivilServiceWithAuth(
  sessionId: string,
  serviceId: string,
  formData: Record<string, string>
): Promise<{
  success: boolean;
  message: string;
  applicationId?: string;
}> {
  const session = sessionStore.get(sessionId);

  if (!session || session.status !== 'authenticated' || !session.cookies) {
    return {
      success: false,
      message: '유효한 인증 세션이 없습니다. 먼저 간편인증을 완료해주세요.',
    };
  }

  // 세션 만료 체크
  if (session.expiresAt < new Date()) {
    sessionStore.delete(sessionId);
    return {
      success: false,
      message: '세션이 만료되었습니다. 인증을 다시 진행해주세요.',
    };
  }

  // TODO: 실제 민원 접수 로직 구현
  // 현재는 성공 시뮬레이션
  console.log(`[Gov24Auth] Submitting civil service: ${serviceId} with session: ${sessionId}`);

  return {
    success: true,
    message: '민원 접수가 완료되었습니다.',
    applicationId: `GOV24-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
}
