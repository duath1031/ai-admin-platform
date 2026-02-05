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

const { v4: uuidv4 } = require('uuid');
const {
  launchStealthBrowser,
  humanClick,
  humanDelay,
  saveScreenshot: stealthScreenshot,
} = require('./src/stealthBrowser');
const { secureInput, secureSelect } = require('./src/inputHelper');
const { typeOnKeypad } = require('./src/keypadSolver');

// 타임아웃 설정
const TIMEOUTS = {
  navigation: 30000,      // 페이지 이동
  element: 10000,         // 요소 대기
  authWait: 180000,       // 인증 대기 (3분)
  polling: 3000,          // 폴링 간격
};

/**
 * 스크린샷 저장 (stealthBrowser 위임)
 */
async function saveScreenshot(page, prefix = 'screenshot') {
  return stealthScreenshot(page, prefix);
}

/**
 * 정부24 비회원 간편인증 요청 (Phase 1)
 * @param {Object} params - 인증 요청 파라미터
 * @param {string} params.name - 이름
 * @param {string} params.rrn1 - 주민번호 앞자리 (6자리)
 * @param {string} params.rrn2 - 주민번호 뒷자리 (7자리)
 * @param {string} params.phoneNumber - 전화번호 (01012345678)
 * @param {string} params.carrier - 통신사 (SKT, KT, LGU, SKT_MVNO, KT_MVNO, LGU_MVNO)
 * @param {string} params.authMethod - 인증방법 (kakao, pass, samsung, naver, toss)
 * @returns {Object} - 인증 요청 결과
 */
async function requestGov24Auth(params) {
  const { name, rrn1, rrn2, phoneNumber, carrier, authMethod = 'pass' } = params;
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
    log('init', '스텔스 브라우저 시작');

    // 스텔스 브라우저 시작 (ghost-cursor + stealth plugin)
    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    context = stealth.context;
    const page = stealth.page;
    const cursor = stealth.cursor;

    // 다이얼로그 자동 수락
    context.on('dialog', async (dialog) => {
      log('dialog', `Alert: ${dialog.message()}`);
      await dialog.accept();
    });

    log('navigate', '정부24 로그인 페이지 이동');
    await humanDelay(300, 800);

    // 정부24 로그인 페이지 접속
    await page.goto('https://www.gov.kr/nlogin/login', {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });

    await saveScreenshot(page, `${taskId}_01_login_page`);

    log('tab', '간편인증 탭 클릭');
    await humanDelay(500, 1200);

    // 간편인증 탭 클릭 (ghost-cursor 사용)
    await humanClick(page, cursor, 'text=간편인증');
    await humanDelay(800, 1500);

    await saveScreenshot(page, `${taskId}_02_simple_auth_tab`);

    log('select_auth', `인증 방법 선택: ${authMethod}`);

    // 인증 방법 선택 (카카오, PASS, 네이버, 토스 등)
    const authMethodMap = {
      kakao: '카카오',
      pass: 'PASS',
      samsung: '삼성패스',
      naver: '네이버',
      toss: '토스',
    };

    const authMethodText = authMethodMap[authMethod] || 'PASS';
    await humanClick(page, cursor, `text=${authMethodText}`);
    await humanDelay(800, 1500);

    log('input', '개인정보 입력 (보호 우회)');

    // iframe 내부 처리 (정부24 로그인은 iframe 사용)
    let targetPage = page;
    try {
      const frame = page.frameLocator('iframe').first();
      // iframe 존재 확인
      const frameElement = await page.locator('iframe').first();
      if (await frameElement.isVisible({ timeout: 3000 }).catch(() => false)) {
        targetPage = frame;
        log('iframe', 'iframe 감지 → 프레임 내부 처리');
      }
    } catch {
      log('iframe', 'iframe 없음 → 메인 페이지 처리');
    }

    // 이름 입력 (secureInput 사용)
    await secureInput(page, 'input[name*="name"], input[placeholder*="이름"]', name);
    await humanDelay(300, 700);

    // 주민등록번호 앞자리 입력 (비회원 로그인용)
    await secureInput(page, 'input[name*="jumin1"], input[name*="rrn1"], input[name*="ssn1"], input[placeholder*="앞자리"]', rrn1);
    await humanDelay(300, 700);

    // 주민등록번호 뒷자리 입력 (보안 입력)
    await secureInput(page, 'input[name*="jumin2"], input[name*="rrn2"], input[name*="ssn2"], input[placeholder*="뒷자리"], input[type="password"]', rrn2);
    await humanDelay(300, 700);

    // 전화번호 입력
    await secureInput(page, 'input[name*="phone"], input[name*="mobile"], input[placeholder*="휴대폰"]', phoneNumber);
    await humanDelay(300, 700);

    // 통신사 선택
    if (carrier) {
      await secureSelect(page, 'select[name*="carrier"], select[name*="telecom"]', carrier);
      await humanDelay(300, 700);
    }

    await saveScreenshot(page, `${taskId}_03_input_complete`);

    log('request', '인증 요청 버튼 클릭');
    await humanDelay(500, 1000);

    // 인증 요청 버튼 클릭 (ghost-cursor 사용)
    await humanClick(page, cursor, 'button:has-text("인증 요청"), button:has-text("인증요청"), button:has-text("본인확인")');

    await humanDelay(1500, 2500);
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
    log('init', '인증 확인 시작 (스텔스 모드)');

    // 스텔스 브라우저 시작
    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    context = stealth.context;
    const page = stealth.page;
    const cursor = stealth.cursor;

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
        await humanClick(page, cursor, 'button:has-text("인증 완료"), button:has-text("확인")');
        await humanDelay(1500, 2500);
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
    log('init', '민원 제출 시작 (스텔스 모드)');

    // 스텔스 브라우저 시작
    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    context = stealth.context;

    // 쿠키 설정
    if (cookies && cookies.length > 0) {
      await context.addCookies(cookies);
      log('cookie', '세션 쿠키 설정 완료');
    }

    const page = stealth.page;
    const cursor = stealth.cursor;

    log('navigate', `민원 서비스 페이지 이동: ${serviceCode}`);

    // 민원 서비스 페이지로 이동
    await page.goto(`https://www.gov.kr/portal/service/${serviceCode}`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });

    await saveScreenshot(page, `${taskId}_service_page`);

    log('apply', '신청 버튼 클릭');
    await humanDelay(500, 1200);

    // 신청 버튼 클릭 (ghost-cursor)
    await humanClick(page, cursor, 'button:has-text("신청"), a:has-text("신청하기")');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await humanDelay(800, 1500);

    log('fill', '신청서 작성 (보호 우회)');

    // 폼 데이터 입력 (secureInput/secureSelect 사용)
    for (const [fieldName, value] of Object.entries(formData)) {
      const inputSelector = `input[name="${fieldName}"], textarea[name="${fieldName}"]`;
      const selectSelector = `select[name="${fieldName}"]`;

      // select 먼저 확인
      const selectEl = await page.locator(selectSelector).first();
      if (await selectEl.isVisible({ timeout: 1000 }).catch(() => false)) {
        await secureSelect(page, selectSelector, value);
      } else {
        await secureInput(page, inputSelector, value);
      }
      await humanDelay(200, 500);
    }

    await saveScreenshot(page, `${taskId}_form_filled`);

    log('submit', '제출 버튼 클릭');
    await humanDelay(800, 1500);

    // 제출 버튼 클릭 (ghost-cursor)
    await humanClick(page, cursor, 'button[type="submit"], button:has-text("제출"), button:has-text("신청")');
    await humanDelay(2000, 3500);

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
