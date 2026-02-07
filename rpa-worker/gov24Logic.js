/**
 * =============================================================================
 * 정부24 간편인증 로직 (Phase 25: Force Injection Rewrite)
 * =============================================================================
 * [핵심 변경사항]
 * 1. Force Value Injection - page.evaluate()로 DOM 직접 주입
 * 2. Alert/Dialog Catch - 경고창 메시지 감지 및 로깅
 * 3. Final Evidence Screenshot - 버튼 클릭 직전 증거 스크린샷
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

// 타임아웃 설정
const TIMEOUTS = {
  navigation: 30000,      // 페이지 이동
  element: 10000,         // 요소 대기
  authWait: 180000,       // 인증 대기 (3분)
  polling: 3000,          // 폴링 간격
  sessionTTL: 300000,     // 세션 유효시간 (5분)
};

// =============================================================================
// [HOTFIX] 브라우저 세션 풀 - 인증 요청 후 세션 유지
// =============================================================================
const browserSessions = new Map();

function saveSession(taskId, sessionData) {
  browserSessions.set(taskId, {
    ...sessionData,
    createdAt: Date.now(),
  });
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
    try {
      if (session.browser) await session.browser.close().catch(() => {});
    } catch {}
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
// [Phase 25] 💉 Force Value Injection 헬퍼 함수
// page.type()을 믿지 않고 DOM에 직접 값을 강제 주입
// =============================================================================

/**
 * 강제 입력 - DOM에 직접 값을 주입하고 모든 이벤트 발생
 * @param {Page} page - Playwright Page
 * @param {string} selector - CSS 셀렉터
 * @param {string} value - 입력할 값
 * @returns {Promise<boolean>} 성공 여부
 */
async function forceInput(page, selector, value) {
  try {
    const result = await page.evaluate(({ sel, val }) => {
      const el = document.querySelector(sel);
      if (!el) return { success: false, error: 'Element not found', selector: sel };

      // 값 직접 할당
      el.value = val;

      // 모든 필요한 이벤트 발생
      el.dispatchEvent(new Event('focus', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));

      // 값이 실제로 설정되었는지 확인
      return {
        success: el.value === val,
        actualValue: el.value,
        selector: sel
      };
    }, { sel: selector, val: value });

    console.log(`[ForceInput] ${selector}: ${JSON.stringify(result)}`);
    return result.success;
  } catch (err) {
    console.error(`[ForceInput] Error: ${err.message}`);
    return false;
  }
}

/**
 * 다중 셀렉터로 강제 입력 시도
 * @param {Page} page - Playwright Page
 * @param {string[]} selectors - 시도할 셀렉터 배열
 * @param {string} value - 입력할 값
 * @param {string} fieldName - 필드 이름 (로깅용)
 * @returns {Promise<boolean>} 성공 여부
 */
async function forceInputMultiple(page, selectors, value, fieldName) {
  for (const selector of selectors) {
    const exists = await page.evaluate((sel) => !!document.querySelector(sel), selector);
    if (exists) {
      const result = await forceInput(page, selector, value);
      if (result) {
        console.log(`[ForceInput] ✅ ${fieldName} 성공: ${selector}`);
        return true;
      }
    }
  }
  console.log(`[ForceInput] ❌ ${fieldName} 모든 셀렉터 실패`);
  return false;
}

/**
 * 강제 Select 선택
 * @param {Page} page - Playwright Page
 * @param {string} selector - CSS 셀렉터
 * @param {string} value - 선택할 값
 * @returns {Promise<boolean>} 성공 여부
 */
async function forceSelect(page, selector, value) {
  try {
    const result = await page.evaluate(({ sel, val }) => {
      const el = document.querySelector(sel);
      if (!el) return { success: false, error: 'Element not found' };

      // value로 직접 선택
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));

      // 선택 확인
      return { success: el.value === val, actualValue: el.value };
    }, { sel: selector, val: value });

    console.log(`[ForceSelect] ${selector}: ${JSON.stringify(result)}`);
    return result.success;
  } catch (err) {
    console.error(`[ForceSelect] Error: ${err.message}`);
    return false;
  }
}

/**
 * 강제 체크박스 체크
 * @param {Page} page - Playwright Page
 * @param {string} selector - CSS 셀렉터
 * @returns {Promise<boolean>} 성공 여부
 */
async function forceCheck(page, selector) {
  try {
    const result = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { success: false, error: 'Element not found' };

      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('click', { bubbles: true }));

      return { success: el.checked, selector: sel };
    }, selector);

    return result.success;
  } catch (err) {
    return false;
  }
}

// =============================================================================
// [Phase 25] 정부24 비회원 간편인증 요청 (완전 재작성)
// =============================================================================

async function requestGov24Auth(params) {
  const { name, rrn1, rrn2, phoneNumber, carrier, authMethod = 'pass' } = params;
  const taskId = uuidv4();
  const logs = [];
  const dialogMessages = []; // 🚨 알림창 메시지 수집

  let browser = null;
  let context = null;

  const log = (step, message, status = 'info') => {
    const entry = { step, message, status, timestamp: new Date().toISOString() };
    logs.push(entry);
    console.log(`[${taskId}] [${step}] ${message}`);
  };

  try {
    log('init', '🚀 Phase 25: Force Injection 방식으로 스텔스 브라우저 시작');

    // 스텔스 브라우저 시작
    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    context = stealth.context;
    const page = stealth.page;
    const cursor = stealth.cursor;

    // ═══════════════════════════════════════════════════════════════
    // [Phase 25] 🚨 Alert & Dialog Catch - 모든 경고창 감지
    // ═══════════════════════════════════════════════════════════════
    page.on('dialog', async (dialog) => {
      const message = dialog.message();
      dialogMessages.push(message);
      log('🚨 DIALOG', `알림창 감지: "${message}"`);
      console.log(`🚨🚨🚨 알림창 감지: ${message}`);
      await dialog.dismiss();
    });

    log('navigate', '정부24 로그인 페이지 이동');
    await humanDelay(300, 800);

    // 정부24 로그인 페이지 접속
    await page.goto('https://www.gov.kr/nlogin', {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });

    await saveScreenshot(page, `${taskId}_01_login_page`);

    // 팝업 닫기
    log('popup', '팝업 닫기 시도');
    await page.evaluate(() => {
      const closeButtons = document.querySelectorAll('.btn_close, .close, [aria-label="닫기"]');
      closeButtons.forEach(btn => btn.click());
    });
    await humanDelay(500, 1000);

    // ═══════════════════════════════════════════════════════════════
    // Step 1: 비회원 로그인 탭 클릭
    // ═══════════════════════════════════════════════════════════════
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
      } catch { continue; }
    }

    await humanDelay(800, 1500);
    await saveScreenshot(page, `${taskId}_02_nonmember_tab`);

    // ═══════════════════════════════════════════════════════════════
    // Step 2: 간편인증 탭 클릭
    // ═══════════════════════════════════════════════════════════════
    log('tab', '간편인증 선택');
    const simpleAuthSelectors = [
      'a[title="간편인증 로그인"]',
      'a[title*="간편인증"]',
      '#btn_SimpleAuth',
      'button:has-text("간편인증")',
      'a:has-text("간편인증")',
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
      } catch { continue; }
    }

    if (!authTabClicked) {
      await saveScreenshot(page, `${taskId}_error_simpleauth_not_found`);
      const currentUrl = page.url();
      throw new Error(`간편인증 버튼을 찾을 수 없습니다. (URL: ${currentUrl})`);
    }

    await humanDelay(1000, 1500);
    await saveScreenshot(page, `${taskId}_03_simple_auth_tab`);

    // ═══════════════════════════════════════════════════════════════
    // Step 3: 인증 방법 선택 (PASS/카카오 등)
    // ═══════════════════════════════════════════════════════════════
    log('select_auth', `인증 방법 선택: ${authMethod}`);

    const authMethodMap = {
      kakao: ['카카오', 'kakao'],
      pass: ['PASS', 'pass', '통신사'],
      naver: ['네이버', 'naver'],
      toss: ['토스', 'toss'],
    };

    const methodTexts = authMethodMap[authMethod] || authMethodMap.pass;

    // 클릭 가능한 요소 찾아서 클릭
    for (const text of methodTexts) {
      const clicked = await page.evaluate((searchText) => {
        const elements = document.querySelectorAll('button, a, img, div, span, label');
        for (const el of elements) {
          const elText = (el.textContent || el.alt || el.title || '').toLowerCase();
          if (elText.includes(searchText.toLowerCase())) {
            el.click();
            return true;
          }
        }
        return false;
      }, text);

      if (clicked) {
        log('select_auth', `✅ 인증 방법 클릭 성공: ${text}`);
        break;
      }
    }

    await humanDelay(1000, 1500);

    // ═══════════════════════════════════════════════════════════════
    // [Phase 25] 💉 Force Value Injection - 개인정보 입력
    // page.type()을 믿지 않고 DOM에 직접 값을 꽂아 넣는다!
    // ═══════════════════════════════════════════════════════════════
    log('input', '💉 Force Injection 방식으로 개인정보 입력 시작');

    // 현재 페이지의 모든 input 필드 분석
    const inputAnalysis = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
      return Array.from(inputs).map((input, idx) => ({
        index: idx,
        id: input.id,
        name: input.name,
        placeholder: input.placeholder,
        type: input.type,
        className: input.className,
        parentText: input.parentElement?.textContent?.substring(0, 50),
      }));
    });
    log('debug', `입력 필드 분석: ${JSON.stringify(inputAnalysis)}`);

    // 1. 이름 입력
    log('input', `이름 입력: ${name}`);
    const nameSelectors = [
      'input[placeholder*="홍길동"]',
      'input[placeholder*="이름"]',
      'input[name*="name"]',
      'input[name*="nm"]',
      'input[id*="name"]',
      'input[id*="nm"]',
      '#userName',
      '#userNm',
    ];

    let nameSuccess = await forceInputMultiple(page, nameSelectors, name, '이름');

    if (!nameSuccess) {
      // 최후의 수단: 첫 번째 text input에 이름 입력
      nameSuccess = await page.evaluate((val) => {
        const inputs = document.querySelectorAll('input[type="text"]');
        if (inputs[0]) {
          inputs[0].value = val;
          inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
          inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
          inputs[0].dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }
        return false;
      }, name);
      log('input', `이름 최후의 수단 입력: ${nameSuccess}`);
    }
    await humanDelay(200, 400);

    // 2. 생년월일 입력 (YYYYMMDD 형식)
    let birthDate = rrn1;
    if (rrn1.length === 6) {
      const yearPrefix = parseInt(rrn1.substring(0, 2)) > 30 ? '19' : '20';
      birthDate = yearPrefix + rrn1;
    }

    log('input', `생년월일 입력: ${birthDate}`);
    const birthSelectors = [
      'input[placeholder*="19900101"]',
      'input[placeholder*="생년월일"]',
      'input[placeholder*="YYYYMMDD"]',
      'input[name*="birth"]',
      'input[id*="birth"]',
      'input[name*="brdt"]',
    ];

    let birthSuccess = await forceInputMultiple(page, birthSelectors, birthDate, '생년월일');

    if (!birthSuccess) {
      birthSuccess = await page.evaluate((val) => {
        const inputs = document.querySelectorAll('input[type="text"]');
        if (inputs[1]) {
          inputs[1].value = val;
          inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
          inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
          inputs[1].dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }
        return false;
      }, birthDate);
      log('input', `생년월일 최후의 수단 입력: ${birthSuccess}`);
    }
    await humanDelay(200, 400);

    // 3. 휴대폰 번호 입력
    const phonePart1 = phoneNumber.substring(0, 3); // 010
    const phonePart2 = phoneNumber.substring(3);    // 12345678

    log('input', `휴대폰 번호 입력: ${phonePart1}-${phonePart2}`);

    // 3-1. 통신사 앞자리 Select
    const phoneSelectSuccess = await page.evaluate((val) => {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = Array.from(select.options);
        if (options.some(opt => opt.value === '010' || opt.text.includes('010'))) {
          select.value = val;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, phonePart1);
    log('input', `전화번호 앞자리 Select: ${phoneSelectSuccess}`);

    // 3-2. 전화번호 뒷자리 입력
    const phoneSelectors = [
      'input[placeholder*="1234"]',
      'input[placeholder*="전화"]',
      'input[placeholder*="휴대폰"]',
      'input[name*="phone"]',
      'input[name*="mobile"]',
      'input[id*="phone"]',
      'input[type="tel"]',
    ];

    let phoneSuccess = await forceInputMultiple(page, phoneSelectors, phonePart2, '전화번호');

    if (!phoneSuccess) {
      phoneSuccess = await page.evaluate((val) => {
        const inputs = document.querySelectorAll('input[type="text"], input[type="tel"]');
        // 마지막 input이 전화번호일 가능성 높음
        const lastInput = inputs[inputs.length - 1];
        if (lastInput) {
          lastInput.value = val;
          lastInput.dispatchEvent(new Event('input', { bubbles: true }));
          lastInput.dispatchEvent(new Event('change', { bubbles: true }));
          lastInput.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }
        return false;
      }, phonePart2);
      log('input', `전화번호 최후의 수단 입력: ${phoneSuccess}`);
    }
    await humanDelay(200, 400);

    // 4. 통신사 선택
    if (carrier) {
      log('carrier', `통신사 선택: ${carrier}`);

      const carrierMap = {
        'SKT': ['SKT', 'SK텔레콤'],
        'KT': ['KT', '케이티'],
        'LGU': ['LG U+', 'LGU+', 'LG유플러스'],
        'SKT_MVNO': ['SKT 알뜰폰', 'SK알뜰'],
        'KT_MVNO': ['KT 알뜰폰', 'KT알뜰'],
        'LGU_MVNO': ['LG 알뜰폰', 'LG알뜰'],
      };

      const carrierTexts = carrierMap[carrier] || [carrier];

      const carrierSelected = await page.evaluate((texts) => {
        // 라디오 버튼 찾기
        const radios = document.querySelectorAll('input[type="radio"]');
        for (const radio of radios) {
          const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`);
          const text = (label?.textContent || radio.value || '').toUpperCase();

          for (const searchText of texts) {
            if (text.includes(searchText.toUpperCase())) {
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              radio.dispatchEvent(new Event('click', { bubbles: true }));
              return true;
            }
          }
        }

        // 라벨 클릭 시도
        const labels = document.querySelectorAll('label, span, div');
        for (const label of labels) {
          for (const searchText of texts) {
            if (label.textContent?.includes(searchText)) {
              label.click();
              return true;
            }
          }
        }

        return false;
      }, carrierTexts);

      log('carrier', `통신사 선택 결과: ${carrierSelected}`);
    }
    await humanDelay(300, 500);

    // ═══════════════════════════════════════════════════════════════
    // [Phase 25] 약관 동의 강제 체크
    // ═══════════════════════════════════════════════════════════════
    log('terms', '약관 동의 강제 체크');

    await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          cb.dispatchEvent(new Event('click', { bubbles: true }));
        }
      });
    });
    await humanDelay(300, 500);

    // ═══════════════════════════════════════════════════════════════
    // [Phase 25] 📸 Final Evidence Screenshot - 버튼 클릭 직전 증거
    // ═══════════════════════════════════════════════════════════════
    log('evidence', '📸 버튼 클릭 직전 증거 스크린샷 저장');
    await saveScreenshot(page, `${taskId}_04_EVIDENCE_before_click`);

    // 입력값 최종 확인 (스크린샷에 캡처되도록)
    const finalInputCheck = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])');
      return Array.from(inputs).map(input => ({
        name: input.name || input.id || 'unknown',
        value: input.value,
        placeholder: input.placeholder,
      }));
    });
    log('evidence', `📸 입력값 확인: ${JSON.stringify(finalInputCheck)}`);

    // ═══════════════════════════════════════════════════════════════
    // [Phase 25] 인증 요청 버튼 클릭
    // ═══════════════════════════════════════════════════════════════
    log('request', '🔥 인증 요청 버튼 클릭');

    const requestBtnSelectors = [
      'button:has-text("인증 요청")',
      'button:has-text("인증요청")',
      'button:has-text("요청하기")',
      'button:has-text("본인확인")',
      'a:has-text("인증 요청")',
      '#btn_request',
      '#btnRequest',
      'button[type="submit"]',
    ];

    let requestClicked = false;
    for (const selector of requestBtnSelectors) {
      try {
        const btn = await page.locator(selector).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(page, cursor, selector);
          requestClicked = true;
          log('request', `✅ 인증 요청 클릭 성공: ${selector}`);
          break;
        }
      } catch { continue; }
    }

    // JavaScript 강제 클릭
    if (!requestClicked) {
      log('request', 'Playwright 클릭 실패, JavaScript 강제 클릭 시도');

      const jsClickResult = await page.evaluate(() => {
        const buttonTexts = ['인증 요청', '인증요청', '요청하기', '본인확인', '확인'];

        // 버튼 텍스트로 찾기
        const buttons = document.querySelectorAll('button, a, input[type="submit"], input[type="button"]');
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').trim();
          for (const searchText of buttonTexts) {
            if (text.includes(searchText)) {
              btn.click();
              return { success: true, method: 'textContent', text };
            }
          }
        }

        // submit 버튼 찾기
        const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
          return { success: true, method: 'submit button' };
        }

        // 폼 제출
        const form = document.querySelector('form');
        if (form) {
          form.submit();
          return { success: true, method: 'form.submit()' };
        }

        return { success: false };
      });

      if (jsClickResult.success) {
        requestClicked = true;
        log('request', `✅ JavaScript 강제 클릭 성공: ${JSON.stringify(jsClickResult)}`);
      }
    }

    if (!requestClicked) {
      await saveScreenshot(page, `${taskId}_error_request_btn_not_found`);
      throw new Error('인증 요청 버튼을 찾을 수 없습니다.');
    }

    await humanDelay(2000, 3000);
    await saveScreenshot(page, `${taskId}_05_auth_requested`);

    // 알림창이 발생했는지 확인
    if (dialogMessages.length > 0) {
      log('🚨 ALERT', `총 ${dialogMessages.length}개의 알림창 발생: ${dialogMessages.join(' | ')}`);
    }

    log('success', '✅ 인증 요청 완료 - 사용자 앱 인증 대기');

    // 브라우저 세션 저장
    saveSession(taskId, {
      browser,
      context,
      page,
      cursor,
    });

    return {
      success: true,
      taskId,
      phase: 'waiting',
      message: '인증 요청이 전송되었습니다. 스마트폰 앱에서 인증을 완료해주세요.',
      logs,
      dialogMessages,
      inputCheck: finalInputCheck,
      sessionData: {
        sessionActive: true,
      },
    };

  } catch (error) {
    log('error', `❌ ${error.message}`, 'error');

    if (context) {
      const pages = context.pages();
      if (pages.length > 0) {
        await saveScreenshot(pages[0], `${taskId}_error`);
      }
    }

    if (browser) {
      await browser.close().catch(() => {});
    }

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
// 정부24 간편인증 확인 (Phase 2)
// =============================================================================
async function confirmGov24Auth(params) {
  const { taskId } = params;
  const logs = [];

  let browser = null;
  let context = null;
  let page = null;
  let cursor = null;
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
      cursor = savedSession.cursor;
      sessionReused = true;

      try {
        await page.evaluate(() => true);
      } catch {
        log('init', '세션 만료됨, 새 브라우저 시작');
        sessionReused = false;
      }
    }

    if (!sessionReused) {
      log('init', '인증 확인 시작 (새 스텔스 브라우저)');
      const stealth = await launchStealthBrowser();
      browser = stealth.browser;
      context = stealth.context;
      page = stealth.page;
      cursor = stealth.cursor;

      await page.goto('https://www.gov.kr', {
        waitUntil: 'networkidle',
        timeout: TIMEOUTS.navigation,
      });
    }

    log('check', '인증 완료 여부 확인');

    const startTime = Date.now();
    let isAuthenticated = false;

    while (Date.now() - startTime < TIMEOUTS.authWait) {
      const logoutButton = await page.locator('text=로그아웃, button:has-text("로그아웃")').first();
      if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        isAuthenticated = true;
        break;
      }

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
    log('init', '민원 제출 시작 (스텔스 모드)');

    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    context = stealth.context;

    if (cookies && cookies.length > 0) {
      await context.addCookies(cookies);
      log('cookie', '세션 쿠키 설정 완료');
    }

    const page = stealth.page;
    const cursor = stealth.cursor;

    log('navigate', `민원 서비스 페이지 이동: ${serviceCode}`);

    await page.goto(`https://www.gov.kr/portal/service/${serviceCode}`, {
      waitUntil: 'networkidle',
      timeout: TIMEOUTS.navigation,
    });

    await saveScreenshot(page, `${taskId}_service_page`);

    log('apply', '신청 버튼 클릭');
    await humanDelay(500, 1200);

    await humanClick(page, cursor, 'button:has-text("신청"), a:has-text("신청하기")');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await humanDelay(800, 1500);

    log('fill', '신청서 작성 (Force Injection)');

    for (const [fieldName, value] of Object.entries(formData)) {
      await forceInput(page, `input[name="${fieldName}"], textarea[name="${fieldName}"]`, value);
      await humanDelay(200, 500);
    }

    await saveScreenshot(page, `${taskId}_form_filled`);

    log('submit', '제출 버튼 클릭');
    await humanDelay(800, 1500);

    await humanClick(page, cursor, 'button[type="submit"], button:has-text("제출"), button:has-text("신청")');
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
