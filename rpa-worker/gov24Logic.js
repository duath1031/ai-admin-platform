/**
 * =============================================================================
 * 정부24 간편인증 로직 (Phase 26: iframe-aware rewrite)
 * =============================================================================
 * [핵심 변경사항]
 * - 간편인증 폼이 iframe(simpleCert.html) 안에 있음을 반영
 * - frameLocator로 iframe 내부 DOM 직접 조작
 * - PASS/카카오/네이버/토스 인증방법 지원
 *
 * [iframe 내부 필드 구조]
 * - #oacx_name: 이름
 * - #oacx_birth: 생년월일 (YYYYMMDD)
 * - select.one-third: 통신사 (SKT/KT/LGU+)
 * - select (010/011...): 전화번호 앞자리
 * - #oacx_phone2: 전화번호 뒷자리 (8자리)
 * - #totalAgree: 전체 약관 동의
 * - #oacx-request-btn-pc: 인증 요청 버튼
 * - .provider-list: 인증 제공자 선택 (PASS/카카오/네이버 등)
 */

const { v4: uuidv4 } = require('uuid');
const {
  launchStealthBrowser,
  humanClick,
  humanDelay,
  saveScreenshot: stealthScreenshot,
} = require('./src/stealthBrowser');

// 타임아웃 설정
const TIMEOUTS = {
  navigation: 30000,
  element: 10000,
  authWait: 180000,   // 인증 대기 (3분)
  polling: 3000,
  sessionTTL: 300000, // 세션 유효시간 (5분)
};

// =============================================================================
// 브라우저 세션 풀 - 인증 요청 후 세션 유지
// =============================================================================
const browserSessions = new Map();

function saveSession(taskId, sessionData) {
  browserSessions.set(taskId, { ...sessionData, createdAt: Date.now() });
  console.log(`[Session] Saved: ${taskId}`);
}

function getSession(taskId) {
  const session = browserSessions.get(taskId);
  if (!session) return null;
  if (Date.now() - session.createdAt > TIMEOUTS.sessionTTL) {
    console.log(`[Session] Expired: ${taskId}`);
    cleanupSession(taskId);
    return null;
  }
  return session;
}

async function cleanupSession(taskId) {
  const session = browserSessions.get(taskId);
  if (session) {
    try { if (session.browser) await session.browser.close().catch(() => {}); } catch {}
    browserSessions.delete(taskId);
    console.log(`[Session] Cleaned: ${taskId}`);
  }
}

// 주기적 세션 정리 (1분마다)
setInterval(() => {
  const now = Date.now();
  for (const [taskId, session] of browserSessions.entries()) {
    if (now - session.createdAt > TIMEOUTS.sessionTTL) {
      cleanupSession(taskId);
    }
  }
}, 60000);

async function saveScreenshot(page, prefix = 'screenshot') {
  return stealthScreenshot(page, prefix);
}

// =============================================================================
// 인증 제공자 이름 매핑
// =============================================================================
const AUTH_PROVIDER_MAP = {
  pass:   ['PASS', 'pass', 'SAMSUNG PASS'],
  kakao:  ['카카오', 'kakao', '카카오톡'],
  naver:  ['네이버', 'naver'],
  toss:   ['토스', 'toss'],
  kb:     ['KB국민'],
  nhbank: ['NH농협'],
};

// =============================================================================
// [Phase 26] 정부24 간편인증 요청 (iframe 대응)
// =============================================================================
async function requestGov24Auth(params) {
  const { name, rrn1, rrn2, phoneNumber, carrier, authMethod = 'pass' } = params;
  const taskId = uuidv4();
  const logs = [];
  const dialogMessages = [];

  let browser = null;
  let context = null;

  const log = (step, message, status = 'info') => {
    const entry = { step, message, status, timestamp: new Date().toISOString() };
    logs.push(entry);
    console.log(`[${taskId}] [${step}] ${message}`);
  };

  try {
    log('init', 'Phase 26: iframe-aware 간편인증 시작');

    // 스텔스 브라우저 시작
    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    context = stealth.context;
    const page = stealth.page;

    // Alert/Dialog 감지
    page.on('dialog', async (dialog) => {
      const message = dialog.message();
      dialogMessages.push(message);
      log('DIALOG', `알림창: "${message}"`);
      await dialog.dismiss();
    });

    // ═══════════════════════════════════════════════════════════════
    // Step 1: 정부24 로그인 페이지 이동
    // ═══════════════════════════════════════════════════════════════
    log('navigate', '정부24 로그인 페이지 이동');
    await page.goto('https://www.gov.kr/nlogin', {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });
    await humanDelay(2000, 3000);
    log('navigate', `현재 URL: ${page.url()}`);
    await saveScreenshot(page, `${taskId}_01_login_page`);

    // ═══════════════════════════════════════════════════════════════
    // Step 2: 간편인증 버튼 클릭 (button.login-type)
    // ═══════════════════════════════════════════════════════════════
    log('click', '간편인증 버튼 클릭');
    const simpleAuthBtn = page.locator('button.login-type').filter({ hasText: '간편인증' });
    await simpleAuthBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.element });
    await simpleAuthBtn.click();
    log('click', '간편인증 버튼 클릭 성공');
    await humanDelay(3000, 5000);
    await saveScreenshot(page, `${taskId}_02_simple_auth_clicked`);

    // ═══════════════════════════════════════════════════════════════
    // Step 3: iframe 내부 접근 (simpleCert.html)
    // ═══════════════════════════════════════════════════════════════
    log('iframe', 'simpleCert iframe 대기 중...');
    const iframeLocator = page.frameLocator('iframe.modal-iframe');

    // iframe 로드 대기 - oacx_name 필드가 보일 때까지
    await iframeLocator.locator('#oacx_name').waitFor({ state: 'visible', timeout: TIMEOUTS.element });
    log('iframe', 'iframe 내부 접근 성공');

    // ═══════════════════════════════════════════════════════════════
    // Step 4: 인증 제공자 선택 (PASS/카카오/네이버 등)
    // ═══════════════════════════════════════════════════════════════
    log('provider', `인증 제공자 선택: ${authMethod}`);
    const providerTexts = AUTH_PROVIDER_MAP[authMethod] || AUTH_PROVIDER_MAP.pass;

    // provider-list 안의 label/li/img 클릭
    let providerSelected = false;
    for (const text of providerTexts) {
      try {
        // label이나 li 내 텍스트로 찾기
        const providerEl = iframeLocator.locator('.provider-list li, .provider-list label, .provider-list div')
          .filter({ hasText: text }).first();
        if (await providerEl.isVisible({ timeout: 2000 }).catch(() => false)) {
          await providerEl.click();
          providerSelected = true;
          log('provider', `인증 제공자 선택 성공: ${text}`);
          break;
        }
      } catch { continue; }
    }

    if (!providerSelected) {
      // 이미지 alt 텍스트로 시도
      for (const text of providerTexts) {
        try {
          const img = iframeLocator.locator(`.provider-list img[alt*="${text}"]`).first();
          if (await img.isVisible({ timeout: 2000 }).catch(() => false)) {
            await img.click();
            providerSelected = true;
            log('provider', `이미지로 선택 성공: ${text}`);
            break;
          }
        } catch { continue; }
      }
    }

    if (!providerSelected) {
      log('provider', '특정 제공자 선택 실패, 기본값 사용');
    }

    await humanDelay(1000, 2000);

    // ═══════════════════════════════════════════════════════════════
    // Step 5: 개인정보 입력 (iframe 내부)
    // ═══════════════════════════════════════════════════════════════

    // 5-1. 이름 입력
    log('input', `이름 입력: ${name}`);
    const nameInput = iframeLocator.locator('#oacx_name');
    await nameInput.click();
    await nameInput.fill(name);
    await humanDelay(200, 400);

    // 5-2. 생년월일 입력 (YYYYMMDD)
    let birthDate = rrn1;
    if (rrn1.length === 6) {
      const yearPrefix = parseInt(rrn1.substring(0, 2)) > 30 ? '19' : '20';
      birthDate = yearPrefix + rrn1;
    }
    log('input', `생년월일 입력: ${birthDate}`);
    const birthInput = iframeLocator.locator('#oacx_birth');
    await birthInput.click();
    await birthInput.fill(birthDate);
    await humanDelay(200, 400);

    // 5-3. 통신사 선택 + 전화번호 앞자리 (evaluate로 처리 - hidden select 우회)
    const phonePart1 = phoneNumber.substring(0, 3);
    const phonePart2 = phoneNumber.substring(3);

    if (carrier) {
      log('input', `통신사 선택: ${carrier}`);
      const carrierValueMap = {
        'SKT': 'SKT', 'KT': 'KT', 'LGU': 'LGU+',
        'SKT_MVNO': 'SKT', 'KT_MVNO': 'KT', 'LGU_MVNO': 'LGU+',
      };
      const carrierValue = carrierValueMap[carrier.toUpperCase()] || carrier;

      // iframe 내부에서 직접 evaluate로 select 조작 (hidden/visible 모두)
      const frame = page.frames().find(f => f.url().includes('simpleCert'));
      if (frame) {
        const selectResult = await frame.evaluate(({ cv, pp }) => {
          const results = [];
          const selects = document.querySelectorAll('select');
          for (const sel of selects) {
            const opts = Array.from(sel.options).map(o => o.text || o.value);
            // 통신사 select (SKT가 있는 것)
            if (opts.some(o => o.includes('SKT'))) {
              for (const opt of sel.options) {
                if (opt.text.includes(cv) || opt.value.includes(cv)) {
                  sel.value = opt.value;
                  sel.dispatchEvent(new Event('change', { bubbles: true }));
                  results.push({ type: 'carrier', value: opt.value, success: true });
                  break;
                }
              }
            }
            // 전화번호 앞자리 select (010이 있고 SKT가 없는 것)
            if (opts.some(o => o === '010') && !opts.some(o => o.includes('SKT'))) {
              sel.value = pp;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              results.push({ type: 'phone_prefix', value: pp, success: true });
            }
          }
          return results;
        }, { cv: carrierValue, pp: phonePart1 });
        log('input', `Select 결과: ${JSON.stringify(selectResult)}`);
      }
    }
    await humanDelay(200, 400);

    log('input', `전화번호 입력: ${phonePart1}-${phonePart2}`);
    await humanDelay(200, 400);

    // 5-5. 전화번호 뒷자리 입력
    const phoneInput = iframeLocator.locator('#oacx_phone2');
    await phoneInput.click();
    await phoneInput.fill(phonePart2);
    log('input', `전화번호 뒷자리 입력: ${phonePart2}`);
    await humanDelay(200, 400);

    // ═══════════════════════════════════════════════════════════════
    // Step 6: 약관 전체 동의
    // ═══════════════════════════════════════════════════════════════
    log('terms', '약관 전체 동의');
    const totalAgree = iframeLocator.locator('#totalAgree');
    const isChecked = await totalAgree.isChecked().catch(() => false);
    if (!isChecked) {
      await totalAgree.click({ force: true });
      log('terms', '전체 동의 체크 완료');
    }
    await humanDelay(500, 800);

    // ═══════════════════════════════════════════════════════════════
    // Step 7: 증거 스크린샷
    // ═══════════════════════════════════════════════════════════════
    await saveScreenshot(page, `${taskId}_03_EVIDENCE_before_click`);

    // 입력값 확인
    const nameVal = await iframeLocator.locator('#oacx_name').inputValue().catch(() => '');
    const birthVal = await iframeLocator.locator('#oacx_birth').inputValue().catch(() => '');
    const phoneVal = await iframeLocator.locator('#oacx_phone2').inputValue().catch(() => '');
    log('evidence', `입력 확인 - 이름: ${nameVal}, 생년월일: ${birthVal}, 전화번호: ${phoneVal}`);

    // ═══════════════════════════════════════════════════════════════
    // Step 8: 인증 요청 버튼 클릭
    // ═══════════════════════════════════════════════════════════════
    log('request', '인증 요청 버튼 클릭');
    const requestBtn = iframeLocator.locator('#oacx-request-btn-pc');
    await requestBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.element });
    await requestBtn.click();
    log('request', '인증 요청 클릭 완료');

    await humanDelay(3000, 5000);
    await saveScreenshot(page, `${taskId}_04_auth_requested`);

    // 알림창 확인
    if (dialogMessages.length > 0) {
      log('ALERT', `알림창 ${dialogMessages.length}개: ${dialogMessages.join(' | ')}`);
    }

    log('success', '인증 요청 완료 - 앱에서 인증 대기');

    // 세션 저장
    saveSession(taskId, { browser, context, page });

    return {
      success: true,
      taskId,
      phase: 'waiting',
      message: '인증 요청이 전송되었습니다. 스마트폰 앱에서 인증을 완료해주세요.',
      logs,
      dialogMessages,
      inputCheck: { name: nameVal, birth: birthVal, phone: phoneVal },
      sessionData: { sessionActive: true },
    };

  } catch (error) {
    log('error', `${error.message}`, 'error');

    if (context) {
      const pages = context.pages();
      if (pages.length > 0) {
        await saveScreenshot(pages[0], `${taskId}_error`);
      }
    }

    if (browser) await browser.close().catch(() => {});

    return {
      success: false,
      taskId,
      phase: 'error',
      error: error.message,
      logs,
      dialogMessages,
    };
  }
}

// =============================================================================
// 정부24 간편인증 확인
// =============================================================================
async function confirmGov24Auth(params) {
  const { taskId } = params;
  const logs = [];

  let browser = null;
  let context = null;
  let page = null;
  let sessionReused = false;

  const log = (step, message, status = 'info') => {
    const entry = { step, message, status, timestamp: new Date().toISOString() };
    logs.push(entry);
    console.log(`[${taskId}] [${step}] ${message}`);
  };

  try {
    const savedSession = getSession(taskId);

    if (savedSession && savedSession.browser && savedSession.page) {
      log('init', '저장된 브라우저 세션 재사용');
      browser = savedSession.browser;
      context = savedSession.context;
      page = savedSession.page;
      sessionReused = true;

      try { await page.evaluate(() => true); } catch {
        log('init', '세션 만료됨, 새 브라우저 시작');
        sessionReused = false;
      }
    }

    if (!sessionReused) {
      log('init', '인증 확인 (새 브라우저)');
      const stealth = await launchStealthBrowser();
      browser = stealth.browser;
      context = stealth.context;
      page = stealth.page;

      await page.goto('https://www.gov.kr', {
        waitUntil: 'networkidle',
        timeout: TIMEOUTS.navigation,
      });
    }

    log('check', '인증 완료 여부 확인');

    // iframe 내부의 "인증 완료" 버튼 확인
    const iframeLocator = page.frameLocator('iframe.modal-iframe');

    const startTime = Date.now();
    let isAuthenticated = false;

    while (Date.now() - startTime < TIMEOUTS.authWait) {
      // 메인 페이지에서 로그인 완료 확인
      const logoutBtn = page.locator('text=로그아웃').first();
      if (await logoutBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        isAuthenticated = true;
        break;
      }

      // iframe 내부 "인증 완료" 버튼 클릭 시도
      try {
        const confirmBtn = iframeLocator.locator('button:has-text("인증 완료")').first();
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.click();
          await humanDelay(2000, 3000);
          // 클릭 후 메인 페이지 로그인 확인
          const loggedIn = await page.locator('text=로그아웃').isVisible({ timeout: 3000 }).catch(() => false);
          if (loggedIn) {
            isAuthenticated = true;
            break;
          }
        }
      } catch {}

      log('polling', '인증 대기 중...');
      await page.waitForTimeout(TIMEOUTS.polling);
    }

    if (!isAuthenticated) {
      throw new Error('인증 시간 초과 (3분)');
    }

    log('success', '인증 완료');

    const cookies = await context.cookies();
    const gov24Cookies = cookies.filter(c =>
      c.domain.includes('gov.kr') || c.domain.includes('gov24')
    );

    await saveScreenshot(page, `${taskId}_05_auth_complete`);
    await cleanupSession(taskId);

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

    await cleanupSession(taskId);

    return {
      success: false,
      taskId,
      phase: 'error',
      error: error.message,
      logs,
    };
  }
}

// =============================================================================
// 정부24 민원 제출
// =============================================================================
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

    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    context = stealth.context;

    if (cookies && cookies.length > 0) {
      await context.addCookies(cookies);
      log('cookie', '세션 쿠키 설정 완료');
    }

    const page = stealth.page;

    log('navigate', `민원 서비스 페이지 이동: ${serviceCode}`);
    await page.goto(`https://www.gov.kr/portal/service/${serviceCode}`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });

    await saveScreenshot(page, `${taskId}_service_page`);

    log('apply', '신청 버튼 클릭');
    await humanDelay(500, 1200);

    const applyBtn = page.locator('button:has-text("신청"), a:has-text("신청하기")').first();
    await applyBtn.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await humanDelay(800, 1500);

    log('fill', '신청서 작성');
    for (const [fieldName, value] of Object.entries(formData)) {
      const field = page.locator(`input[name="${fieldName}"], textarea[name="${fieldName}"]`).first();
      await field.fill(value).catch(() => {});
      await humanDelay(200, 500);
    }

    await saveScreenshot(page, `${taskId}_form_filled`);

    log('submit', '제출 버튼 클릭');
    await humanDelay(800, 1500);

    const submitBtn = page.locator('button[type="submit"], button:has-text("제출"), button:has-text("신청")').first();
    await submitBtn.click();
    await humanDelay(2000, 3500);

    await saveScreenshot(page, `${taskId}_submitted`);

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
    if (browser) await browser.close();
  }
}

module.exports = {
  requestGov24Auth,
  confirmGov24Auth,
  submitGov24Service,
  saveScreenshot,
  TIMEOUTS,
};
