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
  sessionTTL: 300000,     // 세션 유효시간 (5분)
};

// =============================================================================
// [HOTFIX] 브라우저 세션 풀 - 인증 요청 후 세션 유지
// =============================================================================
const browserSessions = new Map();

/**
 * 세션 저장
 */
function saveSession(taskId, sessionData) {
  browserSessions.set(taskId, {
    ...sessionData,
    createdAt: Date.now(),
  });
  console.log(`[Session] Saved: ${taskId}`);
}

/**
 * 세션 조회
 */
function getSession(taskId) {
  const session = browserSessions.get(taskId);
  if (!session) return null;

  // 만료 확인
  if (Date.now() - session.createdAt > TIMEOUTS.sessionTTL) {
    console.log(`[Session] Expired: ${taskId}`);
    cleanupSession(taskId);
    return null;
  }
  return session;
}

/**
 * 세션 정리
 */
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

    // ═══════════════════════════════════════════════════════════════
    // [Phase 24.6] 새로운 정부24 모달 폼 지원
    // 2024년 변경된 UI: 모달 팝업 형태의 간편인증 폼
    // ═══════════════════════════════════════════════════════════════

    // 모달이 열릴 때까지 대기
    await humanDelay(1000, 1500);

    // 1. 통신사PASS 또는 인증서 선택 (왼쪽 아이콘)
    log('auth_provider', '인증 제공자 선택 (PASS)');
    const passSelectors = [
      'img[alt*="PASS"]',
      'img[alt*="통신사"]',
      'button:has-text("PASS")',
      'div:has-text("통신사PASS")',
      '[class*="pass"]',
      'span:has-text("PASS")',
    ];

    for (const sel of passSelectors) {
      try {
        const elem = await page.locator(sel).first();
        if (await elem.isVisible({ timeout: 1000 }).catch(() => false)) {
          await elem.click();
          log('auth_provider', `PASS 선택 성공: ${sel}`);
          await humanDelay(500, 800);
          break;
        }
      } catch { continue; }
    }

    // 2. 이름 입력 (새 UI: 모달 내 input)
    log('input', '이름 입력');
    const nameSelectors = [
      // 모달 내 입력 필드 (라벨 기반)
      'input[placeholder*="홍길동"]',
      'input[placeholder*="이름"]',
      'div:has-text("이름") + input',
      'label:has-text("이름") ~ input',
      'td:has-text("이름") ~ td input',
      // 기존 셀렉터
      'input[name*="name"]',
      'input[name*="nm"]',
      'input[id*="name"]',
      '#userName',
    ].join(', ');

    const nameResult = await secureInput(page, nameSelectors, name);
    if (!nameResult) {
      // JavaScript 직접 입력 시도
      await page.evaluate((val) => {
        const inputs = document.querySelectorAll('input[type="text"]');
        for (const input of inputs) {
          const label = input.closest('tr')?.querySelector('td')?.textContent || '';
          if (label.includes('이름') || input.placeholder?.includes('홍길동')) {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }, name);
      log('input', '이름 JS 직접 입력');
    }
    await humanDelay(300, 500);

    // 3. 생년월일 입력 (rrn1 = YYMMDD → 변환: 19YYMMDD 또는 20YYMMDD)
    log('input', '생년월일 입력');
    // rrn1이 6자리면 앞에 19 또는 20 추가
    let birthDate = rrn1;
    if (rrn1.length === 6) {
      const yearPrefix = parseInt(rrn1.substring(0, 2)) > 30 ? '19' : '20';
      birthDate = yearPrefix + rrn1;
    }

    const birthSelectors = [
      'input[placeholder*="19900101"]',
      'input[placeholder*="생년월일"]',
      'div:has-text("생년월일") + input',
      'label:has-text("생년월일") ~ input',
      'td:has-text("생년월일") ~ td input',
      'input[name*="birth"]',
      'input[id*="birth"]',
    ].join(', ');

    const birthResult = await secureInput(page, birthSelectors, birthDate);
    if (!birthResult) {
      await page.evaluate((val) => {
        const inputs = document.querySelectorAll('input[type="text"]');
        for (const input of inputs) {
          const label = input.closest('tr')?.querySelector('td')?.textContent || '';
          if (label.includes('생년월일') || input.placeholder?.includes('19900101')) {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }, birthDate);
      log('input', '생년월일 JS 직접 입력');
    }
    await humanDelay(300, 500);

    // 4. 휴대폰 번호 입력 (010-XXXX-XXXX 형식 또는 분리)
    log('input', '휴대폰 번호 입력');

    // 전화번호 분리 (01012345678 → 010, 1234, 5678 또는 010, 12345678)
    const phonePart1 = phoneNumber.substring(0, 3); // 010
    const phonePart2 = phoneNumber.substring(3); // 나머지

    // Select 드롭다운 (010, 011 등)
    const phoneSelectSelectors = 'select:has(option[value="010"]), select[name*="phone"], select[id*="phone"]';
    try {
      const phoneSelect = await page.locator(phoneSelectSelectors).first();
      if (await phoneSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await phoneSelect.selectOption(phonePart1);
        log('input', `전화번호 앞자리 선택: ${phonePart1}`);
      }
    } catch {}

    // 전화번호 뒷자리 입력
    const phoneInputSelectors = [
      'input[placeholder*="12341234"]',
      'input[placeholder*="전화"]',
      'input[placeholder*="휴대폰"]',
      'td:has-text("휴대폰") ~ td input[type="text"]:not([readonly])',
      'div:has-text("휴대폰") input[type="text"]',
      'input[name*="phone"]:not([type="hidden"])',
      'input[id*="phone"]',
    ].join(', ');

    const phoneResult = await secureInput(page, phoneInputSelectors, phonePart2);
    if (!phoneResult) {
      await page.evaluate((val) => {
        const inputs = document.querySelectorAll('input[type="text"], input[type="tel"]');
        for (const input of inputs) {
          const label = input.closest('tr')?.querySelector('td')?.textContent || '';
          if (label.includes('휴대폰') || label.includes('전화') || input.placeholder?.includes('1234')) {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }, phonePart2);
      log('input', '전화번호 JS 직접 입력');
    }
    await humanDelay(300, 500);

    // ═══════════════════════════════════════════════════════════════
    // [Phase 24.5] 통신사 선택 강화 (라디오 버튼/탭 클릭)
    // ═══════════════════════════════════════════════════════════════
    if (carrier) {
      log('carrier', `통신사 선택: ${carrier}`);

      // 통신사 매핑 (다양한 텍스트 패턴)
      const carrierTextMap = {
        'SKT': ['SKT', 'SK텔레콤', 'SK 텔레콤', 'skt'],
        'KT': ['KT', '케이티', 'kt'],
        'LGU': ['LG U+', 'LGU+', 'LG유플러스', 'LG 유플러스', 'lgu'],
        'SKT_MVNO': ['SKT 알뜰폰', 'SK 알뜰', '알뜰폰(SKT)'],
        'KT_MVNO': ['KT 알뜰폰', 'KT 알뜰', '알뜰폰(KT)'],
        'LGU_MVNO': ['LG 알뜰폰', 'LGU+ 알뜰', '알뜰폰(LG)'],
      };

      const carrierTexts = carrierTextMap[carrier] || [carrier];
      let carrierSelected = false;

      // 1순위: 라디오 버튼/라벨 클릭
      for (const text of carrierTexts) {
        const radioSelectors = [
          `label:has-text("${text}")`,
          `input[type="radio"][value*="${text}"]`,
          `span:has-text("${text}")`,
          `.radio-item:has-text("${text}")`,
          `div[role="radio"]:has-text("${text}")`,
        ];

        for (const sel of radioSelectors) {
          try {
            const elem = await page.locator(sel).first();
            if (await elem.isVisible({ timeout: 1000 }).catch(() => false)) {
              await humanClick(page, cursor, sel);
              log('carrier', `통신사 클릭 성공: ${sel}`);
              carrierSelected = true;
              break;
            }
          } catch { continue; }
        }
        if (carrierSelected) break;
      }

      // 2순위: Select 드롭다운
      if (!carrierSelected) {
        const selectSelectors = 'select[name*="carrier"], select[name*="telecom"], select[name*="mobileCo"], select[id*="carrier"]';
        const selectResult = await secureSelect(page, selectSelectors, carrier);
        if (selectResult) {
          log('carrier', `통신사 Select 성공: ${carrier}`);
          carrierSelected = true;
        }
      }

      // 3순위: JavaScript로 강제 선택
      if (!carrierSelected) {
        const jsResult = await page.evaluate((carrierValue) => {
          // 라디오 버튼 찾기
          const radios = document.querySelectorAll('input[type="radio"]');
          for (const radio of radios) {
            const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`);
            const text = (label?.textContent || radio.value || '').toLowerCase();
            if (text.includes(carrierValue.toLowerCase())) {
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              radio.dispatchEvent(new Event('click', { bubbles: true }));
              return true;
            }
          }
          return false;
        }, carrier);

        if (jsResult) {
          log('carrier', `통신사 JS 강제 선택 성공: ${carrier}`);
          carrierSelected = true;
        }
      }

      if (!carrierSelected) {
        log('carrier', `통신사 선택 실패: ${carrier}`, 'warn');
      }

      await humanDelay(300, 700);
    }

    await saveScreenshot(page, `${taskId}_04_input_complete`);

    // ═══════════════════════════════════════════════════════════════
    // [Phase 24.6] 약관 동의 자동 체크 (새 UI)
    // ═══════════════════════════════════════════════════════════════
    log('terms', '약관 동의 자동 체크 시작');

    // 전체동의 체크박스 클릭 (새 UI)
    const allAgreeSelectors = [
      'label:has-text("전체동의")',
      'span:has-text("전체동의")',
      'input[type="checkbox"] + label:has-text("전체")',
      '#chkAll',
      '#checkAll',
      '#allAgree',
      '.check_all input[type="checkbox"]',
      'input[name="allAgree"]',
      'input[name="agreeAll"]',
    ];

    for (const selector of allAgreeSelectors) {
      try {
        const elem = await page.locator(selector).first();
        if (await elem.isVisible({ timeout: 1000 }).catch(() => false)) {
          await elem.click();
          log('terms', `전체동의 클릭: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    // JavaScript로 모든 동의 체크박스 체크
    await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((cb) => {
        const checkbox = cb;
        const id = (checkbox.id || '').toLowerCase();
        const name = (checkbox.name || '').toLowerCase();
        const title = (checkbox.title || '').toLowerCase();
        const labelText = checkbox.closest('label')?.textContent?.toLowerCase() || '';
        const parentText = (checkbox.parentElement?.textContent || '').toLowerCase();

        if (
          id.includes('agree') || id.includes('chk') || id.includes('all') ||
          name.includes('agree') || name.includes('consent') ||
          title.includes('동의') ||
          labelText.includes('동의') || labelText.includes('전체') ||
          parentText.includes('동의') || parentText.includes('약관')
        ) {
          if (!checkbox.checked) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            checkbox.dispatchEvent(new Event('click', { bubbles: true }));
          }
        }
      });
    });

    await humanDelay(500, 800);

    log('request', '인증 요청 버튼 클릭');
    await humanDelay(500, 1000);

    // ═══════════════════════════════════════════════════════════════
    // [Phase 24.6] 인증 요청 버튼 클릭 (새 UI)
    // ═══════════════════════════════════════════════════════════════
    const requestBtnSelectors = [
      // 새 UI - 모달 내 파란색 버튼 "인증 요청"
      'button:has-text("인증 요청")',
      'button:has-text("인증요청")',
      'a:has-text("인증 요청")',
      // 스크린샷에서 확인된 버튼 스타일
      'button.btn-primary:has-text("인증")',
      'button[class*="primary"]:has-text("인증")',
      'button[style*="background"]:has-text("인증")',
      // 기존 셀렉터
      'button:has-text("인증 요청 시작")',
      'button:has-text("요청하기")',
      'button:has-text("본인확인")',
      // ID/Class 기반
      '#btn_request',
      '#btnRequest',
      '#btn_request_auth',
      '#btnRequestAuth',
      '.btn_submit',
      '.btn-auth-request',
      'button[type="submit"]',
      'input[type="button"][value*="인증"]',
    ];

    let requestClicked = false;
    for (const selector of requestBtnSelectors) {
      try {
        const btn = await page.locator(selector).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isEnabled = await btn.isEnabled().catch(() => true);
          if (isEnabled) {
            await humanClick(page, cursor, selector);
            requestClicked = true;
            log('request', `인증 요청 클릭 성공: ${selector}`);
            break;
          } else {
            log('request', `버튼 비활성화됨: ${selector}`);
          }
        }
      } catch {
        continue;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // [HOTFIX Phase 24] Step 3: JavaScript 강제 클릭 (Last Resort)
    // ═══════════════════════════════════════════════════════════════
    if (!requestClicked) {
      log('request', 'Playwright 클릭 실패, JavaScript 강제 클릭 시도');

      const jsClickResult = await page.evaluate(() => {
        const buttonTexts = ['인증 요청 시작', '인증요청', '인증 요청', '요청하기', '본인확인'];

        for (const text of buttonTexts) {
          const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"], span[role="button"]'));
          for (const btn of buttons) {
            if (btn.textContent?.includes(text) || btn.value?.includes(text)) {
              btn.click();
              return { success: true, text };
            }
          }
        }

        // ID로 시도
        const idSelectors = ['btn_request', 'btnRequest', 'btn_request_auth', 'btnRequestAuth', 'authSubmit'];
        for (const id of idSelectors) {
          const btn = document.getElementById(id);
          if (btn) {
            btn.click();
            return { success: true, id };
          }
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
        log('request', `JavaScript 강제 클릭 성공: ${JSON.stringify(jsClickResult)}`);
      }
    }

    if (!requestClicked) {
      await saveScreenshot(page, `${taskId}_error_request_btn_not_found`);
      log('error', '인증 요청 버튼을 찾지 못함 - 스크린샷 저장됨');

      // 디버그 정보 수집
      const debugInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
        return buttons.slice(0, 10).map(b => ({
          tag: b.tagName,
          text: b.textContent?.substring(0, 50),
          id: b.id,
          class: b.className,
        }));
      });
      log('debug', `페이지 버튼 목록: ${JSON.stringify(debugInfo)}`);

      throw new Error('인증 요청 버튼을 찾을 수 없습니다. 스크린샷이 저장되었습니다. 서버 로그를 확인하세요.');
    }

    await humanDelay(1500, 2500);
    await saveScreenshot(page, `${taskId}_05_auth_requested`);

    log('success', '인증 요청 완료 - 사용자 앱 인증 대기');

    // [HOTFIX] 브라우저 세션 저장 (confirmGov24Auth에서 재사용)
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
      sessionData: {
        contextId: context._guid,
        pageUrl: page.url(),
        sessionActive: true,
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

    // 에러 시에만 브라우저 종료
    if (browser) {
      await browser.close().catch(() => {});
    }

    return {
      success: false,
      taskId,
      phase: 'error',
      error: error.message,
      logs,
    };
  }
  // [HOTFIX] finally 제거 - 성공 시 브라우저 유지
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
  let page = null;
  let cursor = null;
  let sessionReused = false;

  const log = (step, message, status = 'info') => {
    const entry = { step, message, status, timestamp: new Date().toISOString() };
    logs.push(entry);
    console.log(`[${taskId}] [${step}] ${message}`);
  };

  try {
    // [HOTFIX] 저장된 세션 조회
    const savedSession = getSession(taskId);

    if (savedSession && savedSession.browser && savedSession.page) {
      log('init', '저장된 브라우저 세션 재사용');
      browser = savedSession.browser;
      context = savedSession.context;
      page = savedSession.page;
      cursor = savedSession.cursor;
      sessionReused = true;

      // 페이지가 아직 열려있는지 확인
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

      // 정부24 메인 페이지로 이동
      await page.goto('https://www.gov.kr', {
        waitUntil: 'networkidle',
        timeout: TIMEOUTS.navigation,
      });
    }

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

    // [HOTFIX] 인증 완료 후 세션 정리
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

    // [HOTFIX] 에러 시에도 세션 정리
    await cleanupSession(taskId);

    return {
      success: false,
      taskId,
      phase: 'error',
      error: error.message,
      logs,
    };
  }
  // [HOTFIX] finally 제거 - cleanupSession에서 브라우저 종료 처리
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
