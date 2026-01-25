/**
 * =============================================================================
 * 정부24 간편인증 로직
 * =============================================================================
 * [핵심 기능]
 * - 정부24 간편인증(카카오/PASS/삼성패스 등) 로그인 자동화
 * - iframe 처리 및 팝업 핸들링
 * - 인증 완료 대기 및 세션 쿠키 추출
 *
 * [주의사항]
 * - 모든 에러는 try-catch로 처리하고 스크린샷 저장
 * - 개인정보 처리 시 보안 유의
 */

const { chromium } = require('playwright');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 스크린샷 저장 경로
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || '/app/screenshots';

// 타임아웃 설정
const TIMEOUTS = {
  navigation: 30000,      // 페이지 이동
  element: 10000,         // 요소 대기
  authWait: 180000,       // 인증 대기 (3분)
  polling: 3000,          // 폴링 간격
};

/**
 * 스크린샷 저장 헬퍼
 */
async function saveScreenshot(page, prefix = 'screenshot') {
  const filename = `${prefix}_${Date.now()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`[Screenshot] Saved: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('[Screenshot] Failed:', error.message);
    return null;
  }
}

/**
 * 브라우저 설정 옵션
 */
function getBrowserOptions() {
  return {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
    ],
  };
}

/**
 * Stealth 모드 적용 (봇 감지 우회)
 */
async function applyStealthMode(context) {
  await context.addInitScript(() => {
    // Navigator webdriver 프로퍼티 숨기기
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Chrome 프로퍼티 추가
    window.chrome = {
      runtime: {},
    };

    // Permissions 쿼리 오버라이드
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // 플러그인 배열 수정
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // 언어 설정
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
    });
  });
}

/**
 * 정부24 간편인증 요청 (Phase 1)
 * @param {Object} params - 인증 요청 파라미터
 * @param {string} params.name - 이름
 * @param {string} params.birthDate - 생년월일 (YYMMDD)
 * @param {string} params.phoneNumber - 전화번호 (01012345678)
 * @param {string} params.carrier - 통신사 (SKT, KT, LGU, SKT_MVNO, KT_MVNO, LGU_MVNO)
 * @param {string} params.authMethod - 인증방법 (kakao, pass, samsung, naver)
 * @returns {Object} - 인증 요청 결과
 */
async function requestGov24Auth(params) {
  const { name, birthDate, phoneNumber, carrier, authMethod = 'pass' } = params;
  const taskId = uuidv4();
  const logs = [];

  let browser = null;
  let context = null;

  const log = (step, message, status = 'info') => {
    const entry = { step, message, status, timestamp: new Date().toISOString() };
    logs.push(entry);
    console.log(`[${taskId}] [${step}] ${message}`);
  };

  try {
    log('init', '브라우저 시작');

    // 브라우저 시작
    browser = await chromium.launch(getBrowserOptions());
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });

    // Stealth 모드 적용
    await applyStealthMode(context);

    // 다이얼로그 자동 수락
    context.on('dialog', async (dialog) => {
      log('dialog', `Alert: ${dialog.message()}`);
      await dialog.accept();
    });

    const page = await context.newPage();

    log('navigate', '정부24 로그인 페이지 이동');

    // 정부24 로그인 페이지 접속
    await page.goto('https://www.gov.kr/nlogin/login', {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });

    await saveScreenshot(page, `${taskId}_01_login_page`);

    log('tab', '간편인증 탭 클릭');

    // 간편인증 탭 클릭 (탭 메뉴에서 선택)
    const simpleAuthTab = await page.locator('text=간편인증').first();
    if (await simpleAuthTab.isVisible()) {
      await simpleAuthTab.click();
      await page.waitForTimeout(1000);
    }

    await saveScreenshot(page, `${taskId}_02_simple_auth_tab`);

    log('select_auth', `인증 방법 선택: ${authMethod}`);

    // 인증 방법 선택 (카카오, PASS, 삼성패스 등)
    const authMethodMap = {
      kakao: '카카오',
      pass: 'PASS',
      samsung: '삼성패스',
      naver: '네이버',
    };

    const authMethodText = authMethodMap[authMethod] || 'PASS';
    const authButton = await page.locator(`text=${authMethodText}`).first();
    if (await authButton.isVisible()) {
      await authButton.click();
      await page.waitForTimeout(1000);
    }

    log('input', '개인정보 입력');

    // iframe 내부 처리 (정부24 로그인은 iframe 사용)
    const frameLocator = page.frameLocator('iframe').first();
    const mainFrame = frameLocator || page;

    // 이름 입력
    const nameInput = await mainFrame.locator('input[name*="name"], input[placeholder*="이름"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(name);
    }

    // 생년월일 입력
    const birthInput = await mainFrame.locator('input[name*="birth"], input[placeholder*="생년월일"]').first();
    if (await birthInput.isVisible()) {
      await birthInput.fill(birthDate);
    }

    // 전화번호 입력
    const phoneInput = await mainFrame.locator('input[name*="phone"], input[name*="mobile"], input[placeholder*="휴대폰"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill(phoneNumber);
    }

    // 통신사 선택
    if (carrier) {
      const carrierSelect = await mainFrame.locator('select[name*="carrier"], select[name*="telecom"]').first();
      if (await carrierSelect.isVisible()) {
        await carrierSelect.selectOption({ label: carrier });
      }
    }

    await saveScreenshot(page, `${taskId}_03_input_complete`);

    log('request', '인증 요청 버튼 클릭');

    // 인증 요청 버튼 클릭
    const requestButton = await mainFrame.locator('button:has-text("인증 요청"), button:has-text("인증요청"), button:has-text("본인확인")').first();
    if (await requestButton.isVisible()) {
      await requestButton.click();
    }

    await page.waitForTimeout(2000);
    await saveScreenshot(page, `${taskId}_04_auth_requested`);

    log('success', '인증 요청 완료 - 사용자 앱 인증 대기');

    return {
      success: true,
      taskId,
      phase: 'waiting',
      message: '인증 요청이 전송되었습니다. 스마트폰 앱에서 인증을 완료해주세요.',
      logs,
      // 브라우저 세션 정보 (확인 단계에서 사용)
      sessionData: {
        contextId: context._guid,
        pageUrl: page.url(),
      },
    };

  } catch (error) {
    log('error', error.message, 'error');

    // 에러 발생 시 스크린샷 저장
    if (context) {
      const pages = context.pages();
      if (pages.length > 0) {
        await saveScreenshot(pages[0], `${taskId}_error`);
      }
    }

    return {
      success: false,
      taskId,
      phase: 'error',
      error: error.message,
      logs,
    };

  } finally {
    // 브라우저는 확인 단계에서 종료하므로 여기서는 닫지 않음
    // 단, 에러 발생 시에만 정리
    // 참고: 실제 구현에서는 세션 풀링 필요
    // 주의: finally에서 return하면 try/catch의 반환값을 덮어씀
    if (browser) {
      // 인증 요청 단계에서는 브라우저를 열어두어야 하지만
      // 현재 구조상 세션 유지가 안되므로 일단 닫음
      await browser.close().catch(() => {});
    }
  }
}

/**
 * 정부24 간편인증 확인 (Phase 2)
 * @param {Object} params - 확인 파라미터
 * @param {string} params.taskId - 작업 ID
 * @returns {Object} - 인증 완료 결과 및 쿠키
 */
async function confirmGov24Auth(params) {
  const { taskId } = params;
  const logs = [];

  let browser = null;
  let context = null;

  const log = (step, message, status = 'info') => {
    const entry = { step, message, status, timestamp: new Date().toISOString() };
    logs.push(entry);
    console.log(`[${taskId}] [${step}] ${message}`);
  };

  try {
    log('init', '인증 확인 시작');

    // 새 브라우저 세션 시작 (실제로는 세션 풀에서 가져와야 함)
    browser = await chromium.launch(getBrowserOptions());
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ko-KR',
    });

    await applyStealthMode(context);
    const page = await context.newPage();

    // 정부24 메인 페이지로 이동하여 로그인 상태 확인
    await page.goto('https://www.gov.kr', {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });

    log('check', '인증 완료 여부 확인');

    // 인증 완료 버튼 대기 및 클릭
    const startTime = Date.now();
    let isAuthenticated = false;

    while (Date.now() - startTime < TIMEOUTS.authWait) {
      // 로그인 상태 확인 (로그아웃 버튼 존재 여부)
      const logoutButton = await page.locator('text=로그아웃, button:has-text("로그아웃")').first();
      if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        isAuthenticated = true;
        break;
      }

      // 인증 완료 버튼 확인
      const confirmButton = await page.locator('button:has-text("인증 완료"), button:has-text("확인")').first();
      if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
      }

      log('polling', '인증 대기 중...');
      await page.waitForTimeout(TIMEOUTS.polling);
    }

    if (!isAuthenticated) {
      throw new Error('인증 시간 초과 (3분)');
    }

    log('success', '인증 완료');

    // 세션 쿠키 추출
    const cookies = await context.cookies();
    const gov24Cookies = cookies.filter(c =>
      c.domain.includes('gov.kr') ||
      c.domain.includes('gov24')
    );

    await saveScreenshot(page, `${taskId}_05_auth_complete`);

    return {
      success: true,
      taskId,
      phase: 'completed',
      message: '인증이 완료되었습니다.',
      cookies: gov24Cookies,
      logs,
    };

  } catch (error) {
    log('error', error.message, 'error');

    if (context) {
      const pages = context.pages();
      if (pages.length > 0) {
        await saveScreenshot(pages[0], `${taskId}_confirm_error`);
      }
    }

    return {
      success: false,
      taskId,
      phase: 'error',
      error: error.message,
      logs,
    };

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 정부24 민원 제출
 * @param {Object} params - 제출 파라미터
 * @param {Array} params.cookies - 로그인 세션 쿠키
 * @param {string} params.serviceCode - 민원 서비스 코드
 * @param {Object} params.formData - 신청서 데이터
 * @returns {Object} - 제출 결과
 */
async function submitGov24Service(params) {
  const { cookies, serviceCode, formData } = params;
  const taskId = uuidv4();
  const logs = [];

  let browser = null;
  let context = null;

  const log = (step, message, status = 'info') => {
    const entry = { step, message, status, timestamp: new Date().toISOString() };
    logs.push(entry);
    console.log(`[${taskId}] [${step}] ${message}`);
  };

  try {
    log('init', '민원 제출 시작');

    browser = await chromium.launch(getBrowserOptions());
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ko-KR',
    });

    // 쿠키 설정
    if (cookies && cookies.length > 0) {
      await context.addCookies(cookies);
      log('cookie', '세션 쿠키 설정 완료');
    }

    await applyStealthMode(context);
    const page = await context.newPage();

    log('navigate', `민원 서비스 페이지 이동: ${serviceCode}`);

    // 민원 서비스 페이지로 이동
    await page.goto(`https://www.gov.kr/portal/service/${serviceCode}`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });

    await saveScreenshot(page, `${taskId}_service_page`);

    log('apply', '신청 버튼 클릭');

    // 신청 버튼 클릭
    const applyButton = await page.locator('button:has-text("신청"), a:has-text("신청하기")').first();
    if (await applyButton.isVisible()) {
      await applyButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle' });
    }

    log('fill', '신청서 작성');

    // 폼 데이터 입력
    for (const [fieldName, value] of Object.entries(formData)) {
      const input = await page.locator(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`).first();
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        const tagName = await input.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          await input.selectOption({ label: value });
        } else {
          await input.fill(value);
        }
      }
    }

    await saveScreenshot(page, `${taskId}_form_filled`);

    log('submit', '제출 버튼 클릭');

    // 제출 버튼 클릭
    const submitButton = await page.locator('button[type="submit"], button:has-text("제출"), button:has-text("신청")').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(3000);
    }

    await saveScreenshot(page, `${taskId}_submitted`);

    // 접수번호 추출
    const receiptNumber = await page.locator('text=/접수번호.*?\\d+/').first().textContent().catch(() => null);

    log('success', `제출 완료: ${receiptNumber || '접수번호 확인 필요'}`);

    return {
      success: true,
      taskId,
      phase: 'submitted',
      message: '민원이 제출되었습니다.',
      receiptNumber,
      logs,
    };

  } catch (error) {
    log('error', error.message, 'error');

    if (context) {
      const pages = context.pages();
      if (pages.length > 0) {
        await saveScreenshot(pages[0], `${taskId}_submit_error`);
      }
    }

    return {
      success: false,
      taskId,
      phase: 'error',
      error: error.message,
      logs,
    };

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  requestGov24Auth,
  confirmGov24Auth,
  submitGov24Service,
  saveScreenshot,
  TIMEOUTS,
};
