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

    // 정부24 로그인 페이지 접속 (기본 URL)
    await page.goto('https://www.gov.kr/nlogin', {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });

    await saveScreenshot(page, `${taskId}_01_login_page`);
    log('screenshot', '로그인 페이지 스크린샷 저장');

    // 팝업 닫기 (화면 가리는 팝업 제거)
    log('popup', '팝업 닫기 시도');
    const popupCloseSelectors = [
      '.layer_popup .btn_close',
      '.popup_wrap .btn_close',
      '.popup_zone .close',
      '.modal .close',
      'button[aria-label="닫기"]',
      '.dimmed_layer .btn_close',
      '.ly_pop .btn_close',
    ];
    for (const selector of popupCloseSelectors) {
      try {
        const closeBtn = await page.locator(selector).first();
        if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeBtn.click();
          log('popup', `팝업 닫기 성공: ${selector}`);
          await humanDelay(200, 400);
        }
      } catch {
        // 무시
      }
    }

    await humanDelay(500, 1000);

    // 비회원 로그인 탭 클릭 (비회원 간편인증)
    log('tab', '비회원 로그인 탭 클릭');
    const nonMemberSelectors = [
      '#tab_nonMember',
      'a[href*="nonMember"]',
      '.tab_menu a:has-text("비회원")',
      'text=비회원 로그인',
      'text=비회원',
    ];

    let tabClicked = false;
    for (const selector of nonMemberSelectors) {
      try {
        const tab = await page.locator(selector).first();
        if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(page, cursor, selector);
          tabClicked = true;
          log('tab', `비회원 탭 클릭 성공: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!tabClicked) {
      log('tab', '비회원 탭을 찾을 수 없음, 간편인증 탭 시도');
    }

    await humanDelay(800, 1500);
    await saveScreenshot(page, `${taskId}_02_nonmember_tab`);

    // 간편인증 탭/버튼 클릭 (Phase 22: Multi-Selector Strategy)
    log('tab', '간편인증 선택 (다중 셀렉터 전략)');
    const simpleAuthSelectors = [
      // 가장 정확한 셀렉터 우선
      'a[title="간편인증 로그인"]',
      'a[title*="간편인증"]',
      '#btn_SimpleAuth',
      '#simpleAuth',
      '#tabSimple',
      // 탭 내부 링크
      '.tab_cont a:has-text("간편인증")',
      '.tab_menu a:has-text("간편인증")',
      '.login_tab a:has-text("간편인증")',
      // href 기반
      'a[href*="simpleAuth"]',
      'a[href*="simple"]',
      // 이미지 버튼
      'img[alt="간편인증"]',
      'img[alt*="간편인증"]',
      // 버튼/링크 텍스트
      'button:has-text("간편인증")',
      'a:has-text("간편인증")',
      // 최후의 수단
      'text="간편인증"',
      'text=간편인증',
    ];

    let authTabClicked = false;
    for (const selector of simpleAuthSelectors) {
      try {
        const authTab = await page.locator(selector).first();
        if (await authTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(page, cursor, selector);
          authTabClicked = true;
          log('tab', `간편인증 클릭 성공: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!authTabClicked) {
      // 에러 스크린샷 저장 (Phase 22)
      await saveScreenshot(page, `${taskId}_error_simpleauth_not_found`);
      log('error', '간편인증 버튼을 찾지 못함 - 스크린샷 저장됨');

      // 현재 페이지 URL과 HTML 일부 로깅
      const currentUrl = page.url();
      const pageTitle = await page.title().catch(() => 'unknown');
      log('debug', `현재 URL: ${currentUrl}, 타이틀: ${pageTitle}`);

      throw new Error(`간편인증 버튼을 찾을 수 없습니다. (URL: ${currentUrl}) 스크린샷이 저장되었습니다. 서버 로그를 확인하세요.`);
    }

    await humanDelay(800, 1500);
    await saveScreenshot(page, `${taskId}_03_simple_auth_tab`);

    log('select_auth', `인증 방법 선택: ${authMethod}`);

    // 인증 방법 선택 (Robust Selectors)
    const authMethodSelectors = {
      kakao: ['#kakao', 'img[alt*="카카오"]', 'button:has-text("카카오")', 'a:has-text("카카오")', 'text=카카오'],
      naver: ['#naver', 'img[alt*="네이버"]', 'button:has-text("네이버")', 'a:has-text("네이버")', 'text=네이버'],
      pass: ['#pass', 'img[alt*="PASS"]', 'button:has-text("PASS")', 'a:has-text("PASS")', 'text=PASS'],
      toss: ['#toss', 'img[alt*="토스"]', 'button:has-text("토스")', 'a:has-text("토스")', 'text=토스'],
      samsung: ['#samsung', 'img[alt*="삼성"]', 'button:has-text("삼성")', 'text=삼성패스'],
    };

    const selectors = authMethodSelectors[authMethod] || authMethodSelectors.pass;
    let methodClicked = false;

    for (const selector of selectors) {
      try {
        const methodBtn = await page.locator(selector).first();
        if (await methodBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(page, cursor, selector);
          methodClicked = true;
          log('select_auth', `인증 방법 클릭 성공: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!methodClicked) {
      log('select_auth', `${authMethod} 버튼을 찾을 수 없음, 기본값으로 진행`);
    }

    await humanDelay(800, 1500);

    log('input', '개인정보 입력 (비회원 간편인증)');

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

    // 이름 입력 (다중 셀렉터)
    const nameSelectors = 'input[name*="name"], input[name*="nm"], input[id*="name"], input[placeholder*="이름"], #userName';
    await secureInput(page, nameSelectors, name);
    await humanDelay(300, 700);

    // 주민등록번호 앞자리 입력 (비회원 로그인용)
    const rrn1Selectors = 'input[name*="jumin1"], input[name*="rrn1"], input[name*="ssn1"], input[name*="ihidnum1"], input[id*="jumin1"], input[placeholder*="앞자리"], input[placeholder*="주민번호"]';
    await secureInput(page, rrn1Selectors, rrn1);
    await humanDelay(300, 700);

    // 주민등록번호 뒷자리 입력 (보안 입력 - password type)
    const rrn2Selectors = 'input[name*="jumin2"], input[name*="rrn2"], input[name*="ssn2"], input[name*="ihidnum2"], input[id*="jumin2"], input[type="password"][maxlength="7"], input[placeholder*="뒷자리"]';
    await secureInput(page, rrn2Selectors, rrn2);
    await humanDelay(300, 700);

    // 전화번호 입력
    const phoneSelectors = 'input[name*="phone"], input[name*="mobile"], input[name*="mbtlnum"], input[id*="phone"], input[placeholder*="휴대폰"], input[placeholder*="전화"]';
    await secureInput(page, phoneSelectors, phoneNumber);
    await humanDelay(300, 700);

    // 통신사 선택
    if (carrier) {
      const carrierSelectors = 'select[name*="carrier"], select[name*="telecom"], select[name*="mobileCo"], select[id*="carrier"]';
      await secureSelect(page, carrierSelectors, carrier);
      await humanDelay(300, 700);
    }

    await saveScreenshot(page, `${taskId}_04_input_complete`);

    log('request', '인증 요청 버튼 클릭');
    await humanDelay(500, 1000);

    // 인증 요청 버튼 클릭 (Robust Selectors)
    const requestBtnSelectors = [
      '#btn_request',
      '#btnRequest',
      'button[type="submit"]',
      'button:has-text("인증요청")',
      'button:has-text("인증 요청")',
      'button:has-text("본인확인")',
      'a:has-text("인증요청")',
      'input[type="button"][value*="인증"]',
    ];

    let requestClicked = false;
    for (const selector of requestBtnSelectors) {
      try {
        const btn = await page.locator(selector).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(page, cursor, selector);
          requestClicked = true;
          log('request', `인증 요청 클릭 성공: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!requestClicked) {
      await saveScreenshot(page, `${taskId}_error_request_btn_not_found`);
      log('error', '인증 요청 버튼을 찾지 못함 - 스크린샷 저장됨');
      throw new Error('인증 요청 버튼을 찾을 수 없습니다. 스크린샷이 저장되었습니다. 서버 로그를 확인하세요.');
    }

    await humanDelay(1500, 2500);
    await saveScreenshot(page, `${taskId}_05_auth_requested`);

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
