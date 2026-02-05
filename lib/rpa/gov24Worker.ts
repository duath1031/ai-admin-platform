/**
 * =============================================================================
 * Phase 10: Gov24 RPA Worker (The Runner)
 * =============================================================================
 *
 * Playwright + StorageState 방식으로 정부24에 파일을 업로드하는 RPA 엔진.
 *
 * [핵심 설계]
 * 1. Session Persistence: 최초 로그인 시 StorageState를 auth.json으로 저장,
 *    이후 재사용하여 로그인을 건너뜀.
 * 2. File Upload: 생성된 HWPX 파일을 정부24 신청 페이지의 input[type="file"]에 투입.
 * 3. Safety: "제출" 클릭 전 스크린샷을 찍어 사용자에게 컨펌 요청.
 * 4. Session Lock: 동시 RPA 작업을 방지하는 Queue 시스템.
 *
 * @module lib/rpa/gov24Worker
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

export type WorkerStatus = 'idle' | 'busy' | 'error';
export type SubmissionStep = 'generate' | 'login_check' | 'navigate' | 'upload' | 'verify' | 'submitted' | 'failed';

export type FileType = 'hwpx' | 'pdf' | 'jpg' | 'jpeg' | 'png';

export interface SubmissionRequest {
  /** 제출할 파일 경로 */
  filePath: string;
  /** 파일 형식 (자동 감지됨) */
  fileType?: FileType;
  /** 정부24 서비스 URL */
  serviceUrl: string;
  /** 서비스명 */
  serviceName: string;
  /** 사용자 ID */
  userId: string;
  /** 자동 제출 여부 (false이면 스크린샷 확인 후 대기) */
  autoSubmit?: boolean;
}

export interface SubmissionResult {
  success: boolean;
  step: SubmissionStep;
  message: string;
  screenshotPath?: string;
  applicationNumber?: string;
  error?: string;
}

export interface SessionStatus {
  valid: boolean;
  expiresAt?: Date;
  message: string;
}

// =============================================================================
// Constants
// =============================================================================

const TEMP_BASE = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'temp');
const AUTH_STATE_PATH = path.join(TEMP_BASE, 'auth.json');
const SCREENSHOTS_DIR = path.join(TEMP_BASE, 'screenshots');
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30분

const GOV24_URLS = {
  main: 'https://www.gov.kr',
  login: 'https://www.gov.kr/nlogin',
  myPage: 'https://www.gov.kr/portal/mypage',
};

const STEALTH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

// =============================================================================
// Session Lock (Singleton)
// =============================================================================

class SessionLock {
  private locked = false;
  private lockedBy: string | null = null;
  private lockedAt: Date | null = null;

  acquire(userId: string): boolean {
    if (this.locked) {
      // 5분 이상 잠긴 상태면 강제 해제 (좀비 방지)
      if (this.lockedAt && Date.now() - this.lockedAt.getTime() > 5 * 60 * 1000) {
        console.warn(`[Gov24Worker] 좀비 락 해제: ${this.lockedBy}`);
        this.release();
      } else {
        return false;
      }
    }
    this.locked = true;
    this.lockedBy = userId;
    this.lockedAt = new Date();
    return true;
  }

  release(): void {
    this.locked = false;
    this.lockedBy = null;
    this.lockedAt = null;
  }

  getStatus(): { locked: boolean; lockedBy: string | null } {
    return { locked: this.locked, lockedBy: this.lockedBy };
  }
}

const sessionLock = new SessionLock();

// =============================================================================
// Gov24Worker Class
// =============================================================================

export class Gov24Worker {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private status: WorkerStatus = 'idle';

  // ---------------------------------------------------------------------------
  // Browser Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Playwright 브라우저를 초기화한다.
   * 저장된 세션(auth.json)이 있으면 자동 로드.
   */
  private async initBrowser(loadSession: boolean = true): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    const contextOptions: any = {
      viewport: { width: 1920, height: 1080 },
      userAgent: STEALTH_USER_AGENT,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      extraHTTPHeaders: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    };

    // 세션 파일이 있고 유효하면 로드
    if (loadSession && fs.existsSync(AUTH_STATE_PATH)) {
      const stat = fs.statSync(AUTH_STATE_PATH);
      const ageMs = Date.now() - stat.mtimeMs;

      if (ageMs < SESSION_MAX_AGE_MS) {
        contextOptions.storageState = AUTH_STATE_PATH;
        console.log(`[Gov24Worker] 저장된 세션 로드 (${Math.round(ageMs / 1000)}초 전)`);
      } else {
        console.log(`[Gov24Worker] 세션 만료됨 (${Math.round(ageMs / 60000)}분 전) - 새 세션 필요`);
        fs.unlinkSync(AUTH_STATE_PATH);
      }
    }

    this.context = await this.browser.newContext(contextOptions);

    // WebDriver 감지 우회
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(window, 'chrome', { value: { runtime: {} } });
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(30000);
  }

  /**
   * 브라우저 리소스 정리
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) await this.page.close().catch(() => {});
      if (this.context) await this.context.close().catch(() => {});
      if (this.browser) await this.browser.close().catch(() => {});
    } catch (error) {
      console.error('[Gov24Worker] Cleanup error:', error);
    }
    this.page = null;
    this.context = null;
    this.browser = null;
    this.status = 'idle';
  }

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  /**
   * 현재 세션이 유효한지 확인한다.
   * 정부24 마이페이지에 접근 가능하면 세션 유효.
   */
  async checkSession(): Promise<SessionStatus> {
    try {
      if (!fs.existsSync(AUTH_STATE_PATH)) {
        return { valid: false, message: '저장된 세션이 없습니다. 로그인이 필요합니다.' };
      }

      const stat = fs.statSync(AUTH_STATE_PATH);
      const ageMs = Date.now() - stat.mtimeMs;

      if (ageMs > SESSION_MAX_AGE_MS) {
        fs.unlinkSync(AUTH_STATE_PATH);
        return { valid: false, message: '세션이 만료되었습니다. 재로그인이 필요합니다.' };
      }

      await this.initBrowser(true);
      if (!this.page) {
        return { valid: false, message: '브라우저 초기화 실패' };
      }

      // 마이페이지 접근 시도
      await this.page.goto(GOV24_URLS.myPage, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.page.waitForTimeout(2000);

      const currentUrl = this.page.url();
      const isLoggedIn = !currentUrl.includes('nlogin') && !currentUrl.includes('login');

      await this.cleanup();

      if (isLoggedIn) {
        const expiresAt = new Date(stat.mtimeMs + SESSION_MAX_AGE_MS);
        return { valid: true, expiresAt, message: '세션이 유효합니다.' };
      }

      // 세션 파일은 있지만 실제로는 만료됨
      fs.unlinkSync(AUTH_STATE_PATH);
      return { valid: false, message: '세션이 서버에서 만료되었습니다. 재로그인이 필요합니다.' };
    } catch (error) {
      await this.cleanup();
      return { valid: false, message: `세션 확인 실패: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * 현재 브라우저 세션을 auth.json으로 저장한다.
   */
  async saveSession(): Promise<void> {
    if (!this.context) return;

    const tempDir = path.dirname(AUTH_STATE_PATH);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    await this.context.storageState({ path: AUTH_STATE_PATH });
    console.log(`[Gov24Worker] 세션 저장 완료: ${AUTH_STATE_PATH}`);
  }

  // ---------------------------------------------------------------------------
  // Screenshot
  // ---------------------------------------------------------------------------

  /**
   * 현재 페이지의 스크린샷을 저장한다.
   */
  private async takeScreenshot(stepName: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    const fileName = `gov24_${stepName}_${Date.now()}.png`;
    const filePath = path.join(SCREENSHOTS_DIR, fileName);

    await this.page.screenshot({ path: filePath, fullPage: true });
    console.log(`[Gov24Worker] 스크린샷 저장: ${filePath}`);
    return filePath;
  }

  // ---------------------------------------------------------------------------
  // Core: Initiate Login (간편인증 요청)
  // ---------------------------------------------------------------------------

  /**
   * 정부24 로그인 페이지에 접속하여 간편인증 버튼을 클릭한다.
   * 사용자가 카카오톡/네이버 앱에서 인증을 승인하도록 안내한다.
   */
  async initiateLogin(): Promise<{ success: boolean; message: string; screenshotPath?: string }> {
    try {
      // 이미 유효한 세션이 있으면 바로 성공
      if (Gov24Worker.hasStoredSession()) {
        const session = await this.checkSession();
        if (session.valid) {
          return {
            success: true,
            message: '정부24 로그인 세션이 유효합니다. 바로 접수를 진행할 수 있습니다.',
          };
        }
      }

      // 브라우저 초기화 (세션 없이)
      await this.initBrowser(false);
      if (!this.page) {
        return { success: false, message: '브라우저 초기화 실패' };
      }

      // 정부24 로그인 페이지 접속
      console.log('[Gov24Worker] 정부24 로그인 페이지 접속 중...');
      await this.page.goto(GOV24_URLS.login, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.page.waitForTimeout(2000);

      // 간편인증 탭/버튼 클릭 시도
      const easyAuthSelectors = [
        'button:has-text("간편인증")',
        'a:has-text("간편인증")',
        'li:has-text("간편인증")',
        '[data-tab="simple"]',
        '#easyAuthTab',
        '.tab-item:has-text("간편인증")',
      ];

      let clicked = false;
      for (const selector of easyAuthSelectors) {
        try {
          const btn = await this.page.$(selector);
          if (btn) {
            await btn.click();
            clicked = true;
            console.log(`[Gov24Worker] 간편인증 탭 클릭: ${selector}`);
            await this.page.waitForTimeout(1500);
            break;
          }
        } catch {
          continue;
        }
      }

      const screenshot = await this.takeScreenshot('login_initiate');
      await this.cleanup();

      if (clicked) {
        return {
          success: true,
          message: '📱 정부24 간편인증을 진행해주세요. 카카오톡 또는 네이버 앱에서 인증 요청을 확인하고 승인해주세요. 승인 완료 후 [확인] 버튼을 눌러주세요.',
          screenshotPath: screenshot,
        };
      }

      return {
        success: true,
        message: '📱 정부24 로그인 페이지에 접속했습니다. 간편인증(카카오톡/네이버)으로 로그인해주세요. 인증 완료 후 [확인] 버튼을 눌러주세요.',
        screenshotPath: screenshot,
      };
    } catch (error) {
      await this.cleanup();
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Gov24Worker] initiateLogin 오류:', msg);
      return {
        success: false,
        message: `정부24 접속 중 오류가 발생했습니다: ${msg}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Core: Upload Document (파일 업로드 전담)
  // ---------------------------------------------------------------------------

  /**
   * 파일을 현재 페이지에 업로드한다.
   * 파일 확장자를 자동 감지하여 적절한 input에 매칭한다.
   *
   * @param filePath - 업로드할 파일의 절대 경로
   * @returns 업로드 성공 여부
   */
  async submitDocument(filePath: string): Promise<{ success: boolean; message: string }> {
    if (!this.page) {
      return { success: false, message: 'Page not initialized' };
    }

    const fileType = Gov24Worker.detectFileType(filePath);
    console.log(`[Gov24Worker] submitDocument: ${path.basename(filePath)} (${fileType})`);

    // 파일 확장자별 input selector 우선순위 분기
    const selectorsByType: Record<string, string[]> = {
      hwpx: [
        'input[type="file"]',
        'input[accept*=".hwp"]',
        'input[accept*=".hwpx"]',
        'input[name*="file"]',
        'input[name*="attach"]',
      ],
      pdf: [
        'input[type="file"]',
        'input[accept*=".pdf"]',
        'input[name*="file"]',
        'input[name*="attach"]',
      ],
      default: [
        'input[type="file"]',
        'input[name*="file"]',
        'input[name*="attach"]',
      ],
    };

    const selectors = selectorsByType[fileType] || selectorsByType.default;

    // 1단계: 직접 file input 찾기
    let uploaded = false;
    for (const selector of selectors) {
      try {
        const fileInput = await this.page.$(selector);
        if (fileInput) {
          await fileInput.setInputFiles(filePath);
          uploaded = true;
          console.log(`[Gov24Worker] 파일 업로드 성공: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    // 2단계: 첨부 버튼 클릭 → 숨겨진 input 찾기
    if (!uploaded) {
      const attachBtnSelectors = [
        'button:has-text("첨부")',
        'button:has-text("파일")',
        'a:has-text("첨부파일")',
        'a:has-text("파일찾기")',
        '.btn-attach',
        '#attachBtn',
        '[class*="attach"]',
        '[class*="upload"]',
      ];

      for (const selector of attachBtnSelectors) {
        try {
          const btn = await this.page.$(selector);
          if (btn) {
            await btn.click();
            await this.page.waitForTimeout(1500);

            const fileInput = await this.page.$('input[type="file"]');
            if (fileInput) {
              await fileInput.setInputFiles(filePath);
              uploaded = true;
              console.log(`[Gov24Worker] 첨부 버튼 클릭 후 업로드 성공: ${selector}`);
              break;
            }
          }
        } catch {
          continue;
        }
      }
    }

    if (!uploaded) {
      return { success: false, message: '파일 업로드 input을 찾을 수 없습니다.' };
    }

    // 3단계: 업로드 확인 대기 (UI 변화 감지)
    console.log(`[Gov24Worker] 업로드 확인 대기 중...`);
    const uploadConfirmed = await this.waitForUploadConfirmation();

    if (uploadConfirmed) {
      console.log(`[Gov24Worker] 업로드 확인됨`);
      return { success: true, message: `파일 업로드 완료 (${fileType})` };
    }

    // 확인 못해도 업로드 자체는 성공한 것이므로 성공 반환
    console.log(`[Gov24Worker] 업로드 확인 UI 미감지 (파일은 전송됨)`);
    return { success: true, message: `파일 전송됨 (확인 UI 미감지, ${fileType})` };
  }

  /**
   * 업로드 후 "첨부 완료" 등의 UI 변화를 감지한다.
   * 정부24에서 파일 업로드 후 나타나는 다양한 확인 패턴을 대기한다.
   */
  private async waitForUploadConfirmation(): Promise<boolean> {
    if (!this.page) return false;

    const confirmSelectors = [
      // 파일명이 표시되는 영역
      '.file-name',
      '.attach-file-name',
      '.uploaded-file',
      '[class*="file-list"] li',
      '[class*="attach-list"] li',
      // 첨부 완료 텍스트
      'span:has-text("첨부완료")',
      'span:has-text("업로드완료")',
      'div:has-text("첨부되었습니다")',
      // 삭제 버튼 (파일이 첨부되면 삭제 버튼이 나타남)
      'button:has-text("삭제")',
      'a:has-text("삭제")',
      '[class*="file-delete"]',
      '[class*="btn-del"]',
    ];

    try {
      // 최대 8초간 대기하며 확인 UI 감지 시도
      const result = await Promise.race([
        ...confirmSelectors.map(selector =>
          this.page!.waitForSelector(selector, { timeout: 8000, state: 'visible' })
            .then(() => selector)
            .catch(() => null)
        ),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
      ]);

      if (result) {
        console.log(`[Gov24Worker] 업로드 확인 UI 감지: ${result}`);
        return true;
      }
    } catch {
      // 타임아웃 - 확인 UI 없음
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Core: Submit File to Gov24 (Full Pipeline)
  // ---------------------------------------------------------------------------

  /**
   * 파일을 정부24에 업로드한다.
   *
   * Flow:
   * 1. 세션 확인 (login_check)
   * 2. 서비스 페이지 이동 (navigate)
   * 3. 파일 업로드 - submitDocument() (upload)
   * 4. 스크린샷 확인 (verify)
   * 5. (선택) 제출 (submitted)
   */
  async submitFile(request: SubmissionRequest): Promise<SubmissionResult> {
    // Session Lock 획득
    if (!sessionLock.acquire(request.userId)) {
      const lockStatus = sessionLock.getStatus();
      return {
        success: false,
        step: 'failed',
        message: `RPA가 작업 중입니다. (사용자: ${lockStatus.lockedBy}) 잠시 후 다시 시도해주세요.`,
      };
    }

    this.status = 'busy';

    try {
      // 파일 존재 확인
      if (!fs.existsSync(request.filePath)) {
        return {
          success: false,
          step: 'failed',
          message: `업로드할 파일을 찾을 수 없습니다: ${request.filePath}`,
        };
      }

      // Step 1: Login Check
      console.log(`[Gov24Worker] Step 1: 세션 확인`);
      const sessionStatus = await this.checkSession();

      if (!sessionStatus.valid) {
        return {
          success: false,
          step: 'login_check',
          message: sessionStatus.message,
          error: 'SESSION_EXPIRED',
        };
      }

      // Step 2: Navigate to service page
      console.log(`[Gov24Worker] Step 2: 서비스 페이지 이동 - ${request.serviceUrl}`);
      await this.initBrowser(true);

      if (!this.page) {
        throw new Error('Browser initialization failed');
      }

      await this.page.goto(request.serviceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(3000);

      // 로그인 페이지로 리다이렉트되었는지 확인
      if (this.page.url().includes('nlogin') || this.page.url().includes('login')) {
        await this.cleanup();
        if (fs.existsSync(AUTH_STATE_PATH)) {
          fs.unlinkSync(AUTH_STATE_PATH);
        }
        return {
          success: false,
          step: 'login_check',
          message: '세션이 만료되었습니다. 간편인증을 다시 진행해주세요.',
          error: 'SESSION_EXPIRED',
        };
      }

      await this.takeScreenshot('navigate');

      // Step 3: Upload file via submitDocument
      console.log(`[Gov24Worker] Step 3: 파일 업로드 - ${request.filePath}`);
      const uploadResult = await this.submitDocument(request.filePath);

      if (!uploadResult.success) {
        const errorScreenshot = await this.takeScreenshot('upload_error');
        await this.cleanup();
        return {
          success: false,
          step: 'upload',
          message: uploadResult.message + ' 수동으로 업로드해주세요.',
          screenshotPath: errorScreenshot,
        };
      }

      // Step 4: Verify (스크린샷으로 사용자 컨펌 요청)
      console.log(`[Gov24Worker] Step 4: 제출 전 확인`);
      const verifyScreenshot = await this.takeScreenshot('verify');

      if (!request.autoSubmit) {
        await this.saveSession();
        await this.cleanup();

        return {
          success: true,
          step: 'verify',
          message: '파일 업로드 완료. 제출 전 스크린샷을 확인해주세요.',
          screenshotPath: verifyScreenshot,
        };
      }

      // Step 5: Auto Submit
      console.log(`[Gov24Worker] Step 5: 자동 제출`);
      const submitResult = await this.clickSubmit();

      await this.saveSession();
      const finalScreenshot = await this.takeScreenshot('submitted');
      await this.cleanup();

      if (submitResult.success) {
        return {
          success: true,
          step: 'submitted',
          message: '정부24 신청이 완료되었습니다.',
          screenshotPath: finalScreenshot,
          applicationNumber: submitResult.applicationNumber,
        };
      }

      return {
        success: false,
        step: 'failed',
        message: submitResult.message,
        screenshotPath: finalScreenshot,
      };
    } catch (error) {
      this.status = 'error';
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Gov24Worker] 제출 실패:`, msg);

      try {
        const errScreenshot = await this.takeScreenshot('error');
        await this.cleanup();
        return {
          success: false,
          step: 'failed',
          message: `RPA 오류: ${msg}`,
          screenshotPath: errScreenshot,
          error: msg,
        };
      } catch {
        await this.cleanup();
        return {
          success: false,
          step: 'failed',
          message: `RPA 오류: ${msg}`,
          error: msg,
        };
      }
    } finally {
      sessionLock.release();
      this.status = 'idle';
    }
  }

  // ---------------------------------------------------------------------------
  // Submit Button Click
  // ---------------------------------------------------------------------------

  /**
   * 제출 버튼을 찾아 클릭한다.
   */
  private async clickSubmit(): Promise<{ success: boolean; message: string; applicationNumber?: string }> {
    if (!this.page) {
      return { success: false, message: 'Page not initialized' };
    }

    const submitSelectors = [
      'button:has-text("신청")',
      'button:has-text("제출")',
      'button:has-text("접수")',
      'button[type="submit"]',
      'a:has-text("신청하기")',
      'a:has-text("제출하기")',
      '#submitBtn',
      '.btn-submit',
    ];

    for (const selector of submitSelectors) {
      try {
        const btn = await this.page.$(selector);
        if (btn) {
          await btn.click();
          console.log(`[Gov24Worker] 제출 버튼 클릭: ${selector}`);

          // 제출 후 대기
          await this.page.waitForTimeout(5000);

          // 접수번호 추출 시도
          const applicationNumber = await this.extractApplicationNumber();

          return {
            success: true,
            message: '제출 완료',
            applicationNumber: applicationNumber || undefined,
          };
        }
      } catch {
        continue;
      }
    }

    return { success: false, message: '제출 버튼을 찾을 수 없습니다.' };
  }

  /**
   * 제출 후 접수번호를 추출한다.
   */
  private async extractApplicationNumber(): Promise<string | null> {
    if (!this.page) return null;

    try {
      // 다양한 패턴의 접수번호 추출 시도
      const patterns = [
        // 텍스트에서 접수번호 패턴 찾기
        async () => {
          const text = await this.page!.textContent('body');
          if (!text) return null;
          const match = text.match(/접수번호\s*[:\s]*([A-Z0-9\-]+)/);
          return match ? match[1] : null;
        },
        // 특정 요소에서 찾기
        async () => {
          const el = await this.page!.$('.receipt-number, .application-number, #receiptNo');
          if (el) return await el.textContent();
          return null;
        },
      ];

      for (const pattern of patterns) {
        const result = await pattern();
        if (result) return result.trim();
      }
    } catch {
      // 접수번호 추출 실패는 critical하지 않음
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Static Helpers
  // ---------------------------------------------------------------------------

  /**
   * 현재 워커 상태 조회
   */
  static getWorkerStatus(): { status: WorkerStatus; lock: { locked: boolean; lockedBy: string | null } } {
    return {
      status: 'idle',
      lock: sessionLock.getStatus(),
    };
  }

  /**
   * 세션 파일 존재 여부
   */
  static hasStoredSession(): boolean {
    if (!fs.existsSync(AUTH_STATE_PATH)) return false;
    const stat = fs.statSync(AUTH_STATE_PATH);
    return Date.now() - stat.mtimeMs < SESSION_MAX_AGE_MS;
  }

  /**
   * 세션 파일 강제 삭제
   */
  static clearSession(): void {
    if (fs.existsSync(AUTH_STATE_PATH)) {
      fs.unlinkSync(AUTH_STATE_PATH);
      console.log('[Gov24Worker] 세션 파일 삭제 완료');
    }
  }

  /**
   * 파일 경로에서 FileType을 자동 감지한다.
   */
  static detectFileType(filePath: string): FileType {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const validTypes: FileType[] = ['hwpx', 'pdf', 'jpg', 'jpeg', 'png'];
    if (validTypes.includes(ext as FileType)) {
      return ext as FileType;
    }
    return 'pdf'; // 기본값
  }

  /**
   * 파일 형식에 따른 MIME type 반환
   */
  static getMimeType(fileType: FileType): string {
    const mimeMap: Record<FileType, string> = {
      hwpx: 'application/vnd.hancom.hwpx',
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };
    return mimeMap[fileType] || 'application/octet-stream';
  }
}
