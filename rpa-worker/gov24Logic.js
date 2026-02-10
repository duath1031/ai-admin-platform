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
  pass:   ['통신사PASS', '통신사패스', 'PASS 휴대전화'],
  kakao:  ['카카오톡', '카카오'],
  naver:  ['네이버', 'naver'],
  toss:   ['토스', 'toss'],
  samsung: ['삼성패스', 'SAMSUNG PASS'],
  kb:     ['국민인증서', 'KB국민'],
  nhbank: ['NH인증서', 'NH농협'],
  kakaobank: ['카카오뱅크'],
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
    // Step 4: 인증 제공자 선택 (PASS/카카오/네이버 등) - evaluate로 확실하게
    // ═══════════════════════════════════════════════════════════════
    log('provider', `인증 제공자 선택: ${authMethod}`);
    const providerTexts = AUTH_PROVIDER_MAP[authMethod] || AUTH_PROVIDER_MAP.pass;

    // iframe frame을 미리 찾아둠
    const certFrame = page.frames().find(f => f.url().includes('simpleCert'));

    if (certFrame) {
      // evaluate로 provider 내부 구조를 분석하고 올바르게 클릭
      const providerResult = await certFrame.evaluate((searchTexts) => {
        const result = { searched: searchTexts, found: false, method: '', debug: {} };

        // provider-list 내부 구조 분석
        const providerList = document.querySelector('.provider-list');
        if (!providerList) {
          result.debug.noProviderList = true;
          return result;
        }

        // 모든 provider 아이템 수집
        const items = providerList.querySelectorAll('li, label, a, div[class*="item"], button');
        const itemTexts = [];
        for (const item of items) {
          itemTexts.push({
            tag: item.tagName,
            text: item.textContent?.trim(),
            className: item.className,
            hasInput: !!item.querySelector('input'),
            inputType: item.querySelector('input')?.type,
            inputName: item.querySelector('input')?.name,
            inputChecked: item.querySelector('input')?.checked,
          });
        }
        result.debug.allItems = itemTexts;

        // 검색 텍스트와 매칭되는 아이템 찾기
        for (const searchText of searchTexts) {
          for (const item of items) {
            const text = item.textContent?.trim() || '';
            if (text.includes(searchText)) {
              // 1. 내부에 input(radio/checkbox)이 있으면 직접 체크
              const input = item.querySelector('input');
              if (input) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('click', { bubbles: true }));
                result.found = true;
                result.method = 'input-check';
                result.inputId = input.id;
                result.inputName = input.name;
                result.inputValue = input.value;
              }

              // 2. 아이템 자체도 클릭 (JS 이벤트 핸들러 트리거)
              item.click();
              result.found = true;
              result.method = result.method ? result.method + '+click' : 'click';
              result.matchedText = text;

              // 3. label 내부라면 label도 클릭
              const parentLabel = item.closest('label') || item.querySelector('label');
              if (parentLabel && parentLabel !== item) {
                parentLabel.click();
                result.method += '+label';
              }

              // 4. a 태그는 클릭하지 않음 (navigation 방지)
              // const aTag = item.querySelector('a');
              // a 태그 클릭은 폼 리셋을 유발할 수 있음

              return result;
            }
          }
        }

        // img alt 텍스트로도 시도
        const imgs = providerList.querySelectorAll('img');
        for (const searchText of searchTexts) {
          for (const img of imgs) {
            const alt = img.alt || '';
            if (alt.includes(searchText)) {
              const parentLi = img.closest('li') || img.parentElement;
              if (parentLi) {
                const input = parentLi.querySelector('input');
                if (input) {
                  input.checked = true;
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                parentLi.click();
                result.found = true;
                result.method = 'img-alt-click';
                result.matchedText = alt;
                return result;
              }
            }
          }
        }

        return result;
      }, providerTexts);

      log('provider', `제공자 선택 결과: ${JSON.stringify(providerResult)}`);

      if (!providerResult.found) {
        log('provider', '제공자 선택 실패 - Playwright click 재시도');
        // fallback: Playwright locator 클릭
        for (const text of providerTexts) {
          try {
            const el = iframeLocator.locator(`.provider-list li`).filter({ hasText: text }).first();
            if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
              await el.click();
              log('provider', `Playwright 클릭 성공: ${text}`);
              break;
            }
          } catch { continue; }
        }
      }
    } else {
      log('provider', 'simpleCert frame 못 찾음, locator로 시도');
      for (const text of providerTexts) {
        try {
          const el = iframeLocator.locator(`.provider-list li`).filter({ hasText: text }).first();
          if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
            await el.click();
            log('provider', `제공자 선택 성공: ${text}`);
            break;
          }
        } catch { continue; }
      }
    }

    await humanDelay(1000, 2000);

    // ═══════════════════════════════════════════════════════════════
    // Step 5: 개인정보 입력 (클립보드 붙여넣기로 한글 입력 처리)
    // ═══════════════════════════════════════════════════════════════

    let birthDate = rrn1;
    if (rrn1.length === 6) {
      const yearPrefix = parseInt(rrn1.substring(0, 2)) > 30 ? '19' : '20';
      birthDate = yearPrefix + rrn1;
    }

    const phonePart1 = phoneNumber.substring(0, 3);
    const phonePart2 = phoneNumber.substring(3);

    const carrierValueMap = {
      'SKT': 'SKT', 'KT': 'KT', 'LGU': 'LGU+',
      'SKT_MVNO': 'SKT', 'KT_MVNO': 'KT', 'LGU_MVNO': 'LGU+',
    };
    const carrierValue = carrier ? (carrierValueMap[carrier.toUpperCase()] || carrier) : '';

    log('input', `입력 시작 - 이름: ${name}, 생년월일: ${birthDate}, 통신사: ${carrierValue}, 전화번호: ${phonePart1}-${phonePart2}`);

    // 5-1. 이름 입력 (execCommand insertText 방식)
    log('input', `이름 입력: ${name}`);
    const nameInputField = iframeLocator.locator('#oacx_name');
    await nameInputField.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await humanDelay(100, 200);
    // execCommand insertText는 contentEditable/input에서 동작하며 input 이벤트도 자동 발생
    await nameInputField.evaluate((el, val) => {
      el.focus();
      el.value = '';
      document.execCommand('insertText', false, val);
    }, name);
    await humanDelay(300, 500);

    // 이름 값 확인
    const nameCheck = await nameInputField.inputValue().catch(() => '');
    log('input', `이름 확인: "${nameCheck}" (길이: ${nameCheck.length})`);

    // execCommand가 안 되면 fill로 다시 시도
    if (!nameCheck || nameCheck.length === 0) {
      log('input', 'execCommand 실패, fill 시도');
      await nameInputField.fill(name);
      await humanDelay(200, 400);
    }

    // 5-2. 생년월일 입력 (숫자만이므로 fill 사용 가능)
    log('input', `생년월일 입력: ${birthDate}`);
    const birthInputField = iframeLocator.locator('#oacx_birth');
    await birthInputField.click();
    await birthInputField.fill(birthDate);
    await humanDelay(200, 400);

    // 5-3. 통신사 선택 + 전화번호 앞자리 (evaluate로 처리)
    if (carrierValue) {
      log('input', `통신사 선택: ${carrierValue}`);
      const selectFrame = certFrame || page.frames().find(f => f.url().includes('simpleCert'));
      if (selectFrame) {
        const selectResult = await selectFrame.evaluate(({ cv, pp }) => {
          const results = [];
          const selects = document.querySelectorAll('select');
          for (const sel of selects) {
            const allOpts = Array.from(sel.options).map(o => ({ text: o.text.trim(), value: o.value }));
            const hasSKT = allOpts.some(o => o.text === 'SKT' || o.text === 'KT' || o.text === 'LGU+');
            const has010 = allOpts.some(o => o.text === '010' || o.value === '010');

            if (hasSKT) {
              for (let i = 0; i < sel.options.length; i++) {
                const optText = sel.options[i].text.trim();
                if (optText === cv || optText.includes(cv)) {
                  sel.selectedIndex = i;
                  sel.dispatchEvent(new Event('change', { bubbles: true }));
                  results.push({ type: 'carrier', selectedIndex: i, text: optText, value: sel.value });
                  break;
                }
              }
            }

            if (has010 && !hasSKT) {
              for (let i = 0; i < sel.options.length; i++) {
                const opt = sel.options[i];
                if (opt.value === pp || opt.text.trim() === pp) {
                  sel.selectedIndex = i;
                  sel.dispatchEvent(new Event('change', { bubbles: true }));
                  results.push({ type: 'phone_prefix', selectedIndex: i, value: sel.value });
                  break;
                }
              }
            }
          }
          return results;
        }, { cv: carrierValue, pp: phonePart1 });
        log('input', `Select 결과: ${JSON.stringify(selectResult)}`);
      }
    }
    await humanDelay(200, 400);

    // 5-4. 전화번호 뒷자리 입력 (숫자만이므로 fill 사용)
    log('input', `전화번호 뒷자리 입력: ${phonePart2}`);
    const phoneInputField = iframeLocator.locator('#oacx_phone2');
    await phoneInputField.click();
    await phoneInputField.fill(phonePart2);
    await humanDelay(200, 400);

    // ═══════════════════════════════════════════════════════════════
    // Step 6: 약관 전체 동의 (evaluate로 모든 체크박스 처리)
    // ═══════════════════════════════════════════════════════════════
    log('terms', '약관 전체 동의');

    // frame.evaluate로 모든 체크박스를 직접 체크하고 이벤트 발생
    const frame = page.frames().find(f => f.url().includes('simpleCert'));
    if (frame) {
      const checkResult = await frame.evaluate(() => {
        const results = [];
        // 모든 체크박스를 찾아서 체크
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of checkboxes) {
          const wasChecked = cb.checked;
          if (!cb.checked) {
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            cb.dispatchEvent(new Event('click', { bubbles: true }));
          }
          results.push({ id: cb.id, name: cb.name, checked: cb.checked, wasChecked });
        }

        // totalAgree 라벨도 클릭 시도 (JavaScript 핸들러 트리거)
        const totalAgreeLabel = document.querySelector('label[for="totalAgree"]');
        if (totalAgreeLabel) {
          totalAgreeLabel.click();
          // 이미 체크되어 있으면 다시 클릭해서 되돌리기 방지
          const totalAgree = document.getElementById('totalAgree');
          if (totalAgree && !totalAgree.checked) {
            totalAgree.checked = true;
            totalAgree.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // 최종 상태 확인
        const finalState = [];
        const allCbs = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of allCbs) {
          finalState.push({ id: cb.id, name: cb.name, checked: cb.checked });
        }
        return { initial: results, final: finalState };
      });
      log('terms', `체크박스 상태: ${JSON.stringify(checkResult.final)}`);
    } else {
      // fallback: iframeLocator 사용
      const totalAgree = iframeLocator.locator('#totalAgree');
      const isChecked = await totalAgree.isChecked().catch(() => false);
      if (!isChecked) {
        // label 클릭 시도 (JS 핸들러 트리거를 위해)
        const label = iframeLocator.locator('label[for="totalAgree"]');
        if (await label.isVisible({ timeout: 2000 }).catch(() => false)) {
          await label.click();
        } else {
          await totalAgree.click({ force: true });
        }
      }
      log('terms', '전체 동의 체크 완료 (fallback)');
    }
    await humanDelay(500, 800);

    // ═══════════════════════════════════════════════════════════════
    // Step 7: 증거 스크린샷
    // ═══════════════════════════════════════════════════════════════
    await saveScreenshot(page, `${taskId}_03_EVIDENCE_before_click`);

    // 입력값 확인 (evaluate로 확인)
    const verifyFrame = page.frames().find(f => f.url().includes('simpleCert'));
    let nameVal = '', birthVal2 = '', phoneVal = '';
    if (verifyFrame) {
      const verify = await verifyFrame.evaluate(() => {
        return {
          name: document.querySelector('#oacx_name')?.value || '',
          birth: document.querySelector('#oacx_birth')?.value || '',
          phone: document.querySelector('#oacx_phone2')?.value || '',
        };
      }).catch(() => ({}));
      nameVal = verify.name || '';
      birthVal2 = verify.birth || '';
      phoneVal = verify.phone || '';
    } else {
      nameVal = await iframeLocator.locator('#oacx_name').inputValue().catch(() => '');
      birthVal2 = await iframeLocator.locator('#oacx_birth').inputValue().catch(() => '');
      phoneVal = await iframeLocator.locator('#oacx_phone2').inputValue().catch(() => '');
    }
    log('evidence', `입력 확인 - 이름: ${nameVal}, 생년월일: ${birthVal2}, 전화번호: ${phoneVal}`);

    // 이름이 비어있으면 재입력 시도
    if (!nameVal || nameVal.trim() === '') {
      log('evidence', '이름이 비어있음! 재입력 시도');
      if (verifyFrame) {
        await verifyFrame.evaluate((nameValue) => {
          const el = document.querySelector('#oacx_name');
          if (el) {
            el.focus();
            el.value = nameValue;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, name);
      } else {
        const nameInput = iframeLocator.locator('#oacx_name');
        await nameInput.click();
        await nameInput.fill(name);
      }
      await humanDelay(300, 500);
      // 다시 확인
      const recheckName = verifyFrame
        ? await verifyFrame.evaluate(() => document.querySelector('#oacx_name')?.value).catch(() => '')
        : await iframeLocator.locator('#oacx_name').inputValue().catch(() => '');
      log('evidence', `이름 재입력 후: ${recheckName}`);
      nameVal = recheckName || '';
    }

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

    // ═══════════════════════════════════════════════════════════════
    // Step 9: 인증 요청 후 상태 진단 + 에러 시 재시도
    // ═══════════════════════════════════════════════════════════════
    const postClickFrame2 = page.frames().find(f => f.url().includes('simpleCert'));
    let authRequestSuccess = false;

    if (postClickFrame2) {
      const postClickState = await postClickFrame2.evaluate(() => {
        const state = {};

        // 에러/안내 팝업 찾기
        const alertLayers = document.querySelectorAll('.layer_pop, .pop_wrap, .popup, [class*="alert"], [class*="layer"], [role="alertdialog"]');
        state.popupMessages = [];
        for (const el of alertLayers) {
          const text = el.textContent?.trim();
          if (text && el.offsetHeight > 0 && text.length < 200) {
            state.popupMessages.push(text);
          }
        }

        // "인증서비스를 선택" 에러 확인
        const allText = document.body?.innerText || '';
        state.hasServiceError = allText.includes('인증서비스를 선택');
        state.hasNameError = allText.includes('이름') && (allText.includes('입력') || allText.includes('확인'));

        // 인증 요청 버튼 상태
        const reqBtn = document.getElementById('oacx-request-btn-pc');
        state.requestBtnDisabled = reqBtn?.disabled || false;

        // 대기 화면
        const waitEls = document.querySelectorAll('[class*="wait"], [class*="loading"], .layer_waiting');
        state.waitingVisible = Array.from(waitEls).some(el => el.offsetHeight > 0);

        // 타이머
        const timerEls = document.querySelectorAll('[class*="timer"], [class*="count"], [class*="time"]');
        state.timerVisible = Array.from(timerEls).some(el => el.offsetHeight > 0);
        state.timerText = Array.from(timerEls).map(el => el.textContent?.trim()).filter(Boolean);

        // provider 선택 상태 (radio/input)
        const providerInputs = document.querySelectorAll('.provider-list input');
        state.providerInputs = Array.from(providerInputs).map(inp => ({
          type: inp.type, name: inp.name, value: inp.value,
          checked: inp.checked, id: inp.id
        }));

        // selected/active 클래스가 있는 provider
        const activeProviders = document.querySelectorAll('.provider-list .active, .provider-list .selected, .provider-list .on, .provider-list [class*="active"], .provider-list [class*="select"]');
        state.activeProviders = Array.from(activeProviders).map(el => el.textContent?.trim());

        // 보이는 텍스트 (처음 500자)
        state.visibleText = allText.substring(0, 500);

        return state;
      }).catch(err => ({ evalError: err.message }));

      log('postClick', `인증 요청 후 상태: ${JSON.stringify(postClickState)}`);

      // 에러가 있으면 팝업 닫고 재시도
      if (postClickState.hasServiceError || postClickState.hasNameError) {
        log('retry', `에러 감지 (service: ${postClickState.hasServiceError}, name: ${postClickState.hasNameError}) - 재시도`);

        // 팝업 닫기 (확인 버튼 클릭)
        await postClickFrame2.evaluate(() => {
          const confirmBtns = document.querySelectorAll('button, a, input[type="button"]');
          for (const btn of confirmBtns) {
            const text = btn.textContent?.trim() || btn.value || '';
            if (text === '확인' || text === 'OK') {
              btn.click();
              break;
            }
          }
        }).catch(() => {});
        await humanDelay(1000, 1500);

        // 이름 에러인 경우 여러 방식으로 재입력
        if (postClickState.hasNameError) {
          log('retry', 'execCommand + evaluate로 이름 재입력');
          const nameRetry = iframeLocator.locator('#oacx_name');

          // 방법 1: evaluate로 직접 값 설정 + 이벤트 발생
          await nameRetry.evaluate((el, val) => {
            el.focus();
            el.value = '';
            // execCommand insertText 시도
            const inserted = document.execCommand('insertText', false, val);
            if (!inserted || el.value !== val) {
              // 직접 value 설정 + 이벤트
              el.value = val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            el.dispatchEvent(new Event('blur', { bubbles: true }));
          }, name);
          await humanDelay(300, 500);

          // 확인
          const retypedName = await nameRetry.inputValue().catch(() => '');
          log('retry', `이름 재입력 결과: "${retypedName}" (길이: ${retypedName.length})`);

          // 방법 2: 여전히 안 되면 Playwright fill 시도
          if (!retypedName || retypedName.length === 0) {
            log('retry', 'Playwright fill로 이름 재시도');
            await nameRetry.click();
            await nameRetry.fill(name);
            await humanDelay(300, 500);
            const fillName = await nameRetry.inputValue().catch(() => '');
            log('retry', `fill 결과: "${fillName}"`);
          }
        }

        // provider 재선택 - 더 강력한 방식으로
        const retryResult = await postClickFrame2.evaluate((searchTexts) => {
          const result = { found: false };

          // 1. provider-list의 모든 li 안에서 텍스트 매칭 후 다양한 방식 시도
          const providerList = document.querySelector('.provider-list');
          if (!providerList) return result;

          // 전체 DOM 구조 확인
          const allLis = providerList.querySelectorAll('li');
          result.totalProviders = allLis.length;
          result.providerDetails = [];

          for (let i = 0; i < allLis.length; i++) {
            const li = allLis[i];
            const detail = {
              index: i,
              text: li.textContent?.trim(),
              className: li.className,
              innerHTML: li.innerHTML.substring(0, 200),
              hasRadio: !!li.querySelector('input[type="radio"]'),
              hasCheckbox: !!li.querySelector('input[type="checkbox"]'),
              hasAnchor: !!li.querySelector('a'),
              hasLabel: !!li.querySelector('label'),
              dataAttrs: {},
            };
            // data-* 속성 수집
            for (const attr of li.attributes) {
              if (attr.name.startsWith('data-')) {
                detail.dataAttrs[attr.name] = attr.value;
              }
            }
            result.providerDetails.push(detail);

            // 매칭 확인
            for (const searchText of searchTexts) {
              if (li.textContent?.trim().includes(searchText)) {
                result.matchIndex = i;
                result.matchText = li.textContent?.trim();

                // 모든 가능한 클릭 대상을 시도
                // a. radio input
                const radio = li.querySelector('input[type="radio"]');
                if (radio) {
                  radio.checked = true;
                  radio.dispatchEvent(new Event('change', { bubbles: true }));
                  radio.dispatchEvent(new Event('input', { bubbles: true }));
                  result.radioClicked = true;
                }

                // b. label 클릭
                const label = li.querySelector('label');
                if (label) {
                  label.click();
                  result.labelClicked = true;
                }

                // c. a 태그 클릭
                const anchor = li.querySelector('a');
                if (anchor) {
                  anchor.click();
                  result.anchorClicked = true;
                }

                // d. li 자체 클릭
                li.click();
                result.liClicked = true;

                // e. active/selected 클래스 추가
                li.classList.add('active', 'selected', 'on');

                // f. mousedown + mouseup + click 이벤트 시뮬레이션
                li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                li.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                li.dispatchEvent(new MouseEvent('click', { bubbles: true }));

                result.found = true;
                break;
              }
            }
            if (result.found) break;
          }

          return result;
        }, providerTexts).catch(err => ({ evalError: err.message }));

        log('retry', `Provider 재선택 결과: ${JSON.stringify(retryResult)}`);
        await humanDelay(1000, 2000);

        // 인증 요청 버튼 재클릭
        log('retry', '인증 요청 버튼 재클릭');
        await requestBtn.click();
        log('retry', '재클릭 완료');
        await humanDelay(3000, 5000);
        await saveScreenshot(page, `${taskId}_05_retry_auth`);

        // 재시도 후 상태 다시 확인
        const retryState = await postClickFrame2.evaluate(() => {
          const allText = document.body?.innerText || '';
          return {
            hasServiceError: allText.includes('인증서비스를 선택'),
            waitingVisible: Array.from(document.querySelectorAll('[class*="wait"], [class*="loading"]')).some(el => el.offsetHeight > 0),
            timerVisible: Array.from(document.querySelectorAll('[class*="timer"], [class*="count"]')).some(el => el.offsetHeight > 0),
          };
        }).catch(() => ({}));

        log('retry', `재시도 후 상태: ${JSON.stringify(retryState)}`);
        authRequestSuccess = !retryState.hasServiceError;
      } else {
        authRequestSuccess = true;
      }
    }

    log('success', `인증 요청 ${authRequestSuccess ? '성공' : '실패 가능성 있음'} - 앱에서 인증 대기`);

    // 세션 저장
    saveSession(taskId, { browser, context, page });

    return {
      success: true,
      taskId,
      phase: 'waiting',
      message: '인증 요청이 전송되었습니다. 스마트폰 앱에서 인증을 완료해주세요.',
      logs,
      dialogMessages,
      inputCheck: { name: nameVal, birth: birthVal2, phone: phoneVal },
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
  const { taskId, timeout, clickConfirm = false } = params;
  const confirmTimeout = timeout || TIMEOUTS.authWait;
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

    // 다이얼로그 자동 처리 (alert/confirm 팝업)
    page.on('dialog', async (dialog) => {
      log('dialog', `팝업 감지: ${dialog.message()}`);
      await dialog.accept();
    });

    const startTime = Date.now();
    let isAuthenticated = false;
    let clickAttempts = 0;

    // 현재 페이지 상태 진단
    const currentUrl = page.url();
    const frameCount = page.frames().length;
    log('diag', `현재 URL: ${currentUrl}, 프레임 수: ${frameCount}`);

    while (Date.now() - startTime < confirmTimeout) {
      // 1. 메인 페이지에서 로그인 완료 확인 (로그아웃 버튼 존재)
      try {
        const logoutBtn = page.locator('text=로그아웃').first();
        if (await logoutBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          log('success', '로그아웃 버튼 발견 - 인증 완료');
          isAuthenticated = true;
          break;
        }
      } catch {}

      // 2. URL 변경 확인 (로그인 페이지에서 벗어났는지)
      try {
        const nowUrl = page.url();
        if (nowUrl.includes('gov.kr') && !nowUrl.includes('login') && !nowUrl.includes('simpleCert')) {
          log('success', `URL 변경으로 인증 완료 감지: ${nowUrl}`);
          isAuthenticated = true;
          break;
        }
      } catch {}

      // 3. iframe에서 "인증 완료" 버튼 클릭 (clickConfirm=true일 때만)
      //    유저가 앱에서 인증 완료 후 프론트엔드에서 "인증 완료" 클릭 시에만 실행
      if (clickConfirm) {
        try {
          const frames = page.frames();
          for (const frame of frames) {
            if (frame === page.mainFrame()) continue;
            try {
              const confirmBtn = frame.locator('button:has-text("인증 완료")').first();
              if (await confirmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                await confirmBtn.click({ timeout: 3000 });
                clickAttempts++;
                log('click', `인증 완료 버튼 클릭 (시도 #${clickAttempts})`);

                // 클릭 후 페이지 변화 대기
                await page.waitForTimeout(3000);

                // 로그인 완료 확인
                const loggedIn = await page.locator('text=로그아웃').isVisible({ timeout: 5000 }).catch(() => false);
                if (loggedIn) {
                  log('success', '인증 완료 후 로그인 확인');
                  isAuthenticated = true;
                  break;
                }

                const afterUrl = page.url();
                if (!afterUrl.includes('login')) {
                  log('success', `URL 변경 확인: ${afterUrl}`);
                  isAuthenticated = true;
                  break;
                }

                log('check', `클릭 후 URL: ${afterUrl} (아직 로그인 안됨 - 다시 시도)`);
              } else {
                log('diag', 'iframe에 인증 완료 버튼 없음');
              }
            } catch (e) {
              log('debug', `iframe 클릭 오류: ${e.message}`);
            }
          }

          if (isAuthenticated) break;
        } catch (e) {
          log('debug', `iframe 확인 오류: ${e.message}`);
        }
      }

      log('polling', '인증 대기 중...');
      await page.waitForTimeout(TIMEOUTS.polling);
    }

    if (!isAuthenticated) {
      // 짧은 타임아웃(프론트엔드 폴링)이면 세션 유지하고 waiting 반환
      if (timeout && timeout < TIMEOUTS.authWait) {
        log('waiting', '아직 인증 대기 중 - 세션 유지');
        return {
          success: false,
          taskId,
          phase: 'waiting',
          message: '앱에서 인증을 완료해주세요.',
          logs,
        };
      }
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
// 정부24 민원 제출 (Phase 25.5: Real Submission)
// =============================================================================
const fs = require('fs');
const path = require('path');

async function submitGov24Service(params, onProgress = () => {}) {
  const { cookies, serviceCode, serviceUrl, formData = {}, files = [] } = params;
  const taskId = uuidv4();
  const logs = [];
  const tmpFiles = []; // 정리할 임시 파일 목록

  let browser = null;
  let context = null;

  const log = (step, message, status = 'info') => {
    const entry = { step, message, status, timestamp: new Date().toISOString() };
    logs.push(entry);
    console.log(`[Submit][${taskId}] [${step}] ${message}`);
  };

  try {
    log('init', `민원 제출 시작 (파일 ${files.length}개)`);
    onProgress(20);

    // =========================================================================
    // Step 1: base64 파일 → /tmp 저장
    // =========================================================================
    const localFilePaths = [];
    for (const file of files) {
      const { fileName, fileBase64, mimeType } = file;
      if (!fileBase64 || !fileName) continue;

      const tmpDir = '/tmp/gov24-submit';
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      const safeName = fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
      const tmpPath = path.join(tmpDir, `${taskId}_${safeName}`);
      fs.writeFileSync(tmpPath, Buffer.from(fileBase64, 'base64'));
      localFilePaths.push(tmpPath);
      tmpFiles.push(tmpPath);
      log('file', `파일 저장: ${safeName} (${Math.round(fileBase64.length * 0.75 / 1024)}KB)`);
    }

    // =========================================================================
    // Step 2: 브라우저 + 쿠키 설정
    // =========================================================================
    onProgress(30);
    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    context = stealth.context;

    if (cookies && cookies.length > 0) {
      // Playwright requires domain+path or url for each cookie
      const safeCookies = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '.gov.kr',
        path: c.path || '/',
        ...(c.httpOnly !== undefined && { httpOnly: c.httpOnly }),
        ...(c.secure !== undefined && { secure: c.secure }),
        ...(c.sameSite && { sameSite: c.sameSite }),
        ...(c.expires && { expires: c.expires }),
      }));
      await context.addCookies(safeCookies);
      log('cookie', `세션 쿠키 ${safeCookies.length}개 설정`);
    }

    const page = stealth.page;

    // 다이얼로그(alert/confirm) 자동 처리
    page.on('dialog', async (dialog) => {
      log('dialog', `${dialog.type()}: ${dialog.message()}`);
      await dialog.accept();
    });

    // =========================================================================
    // Step 3: 서비스 페이지 이동
    // =========================================================================
    const targetUrl = serviceUrl || `https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A09002&CappBizCD=${serviceCode}`;
    onProgress(40);
    log('navigate', `서비스 페이지 이동: ${targetUrl}`);

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await humanDelay(1000, 2000);
    await saveScreenshot(page, `${taskId}_01_service_page`);

    // 현재 URL과 페이지 제목 기록
    const currentUrl = page.url();
    const pageTitle = await page.title();
    log('navigate', `현재 페이지: ${pageTitle} (${currentUrl})`);

    // =========================================================================
    // Step 4: 페이지 구조 분석 + "신청" 버튼 찾기 및 클릭
    // =========================================================================
    // 페이지에 있는 모든 클릭 가능한 요소 수집 (디버그)
    const pageElements = await page.evaluate(() => {
      const elements = [];
      // 모든 a, button, input[type=button/submit] 요소
      const clickables = document.querySelectorAll('a, button, input[type="button"], input[type="submit"], [onclick]');
      clickables.forEach((el, i) => {
        const text = (el.textContent || el.value || '').trim().substring(0, 60);
        if (!text) return;
        const tag = el.tagName;
        const className = el.className || '';
        const href = el.href || '';
        const onclick = el.getAttribute('onclick') || '';
        const id = el.id || '';
        // 신청/제출/접수 관련 키워드만 필터
        const keywords = ['신청', '제출', '접수', '확인', '첨부', '업로드', '등록', '작성', 'submit', 'apply'];
        const isRelevant = keywords.some(k => text.includes(k) || onclick.includes(k) || className.includes(k));
        if (isRelevant || i < 30) { // 처음 30개 + 관련 키워드
          elements.push({ tag, text: text.substring(0, 40), className: className.substring(0, 50), id, href: href.substring(0, 80), onclick: onclick.substring(0, 80) });
        }
      });
      return elements.slice(0, 50);
    }).catch(() => []);
    log('debug', `페이지 요소 분석: ${JSON.stringify(pageElements)}`);

    onProgress(50);
    log('apply', '신청 버튼 탐색');
    const applySelectors = [
      // 정부24 실제 패턴 (디버그로 확인됨)
      '#applyBtn',                          // SPAN#applyBtn "신고하기" (onclick: applyConfirm)
      '#memberApplyBtn',                    // "회원 신청하기"
      '#nonMemberApplyBtn',                 // "비회원 신청하기"
      '#onlyMemberApplyBtn',                // "회원 신청하기" (회원전용)
      '[onclick*="applyConfirm"]',          // applyConfirm(...) 호출 요소
      // 텍스트 기반 (정확한 매칭)
      'span.btn_L:has-text("신고하기")',
      'span.btn_L:has-text("신청하기")',
      'a:has-text("신청하기")',
      'button:has-text("신청하기")',
      'a:has-text("인터넷으로 신청")',
      'a:has-text("인터넷신청")',
      'button:has-text("인터넷신청")',
      'a:has-text("온라인 신청")',
      'a:has-text("민원신청")',
      'button:has-text("민원신청")',
      ':has-text("신고하기"):not(a[href*="InfoCapp"])',  // 탭 링크 제외
      // 클래스 기반
      'a.btn_apply',
      'a.btn_blue_l',
      'a.btn_blue:has-text("신청")',
      // onclick 기반
      '[onclick*="doApply"]',
      '[onclick*="applyService"]',
      '[onclick*="fn_apply"]',
      '[onclick*="goApply"]',
      // input 기반
      'input[type="button"][value*="신청"]',
      'input[type="button"][value*="신고"]',
    ];

    let applyClicked = false;
    for (const sel of applySelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          const btnText = await btn.textContent().catch(() => '');
          log('apply', `신청 버튼 발견: ${sel} (text: "${btnText.trim().substring(0, 30)}")`);
          await humanDelay(300, 800);
          await btn.click();
          applyClicked = true;
          break;
        }
      } catch (e) {
        // 잘못된 셀렉터는 무시
      }
    }

    // 추가: 텍스트 기반 broad 검색 (span, a, button 포함)
    if (!applyClicked) {
      const allLinks = page.locator('a, button, span[onclick], span.btn_L, [id*="pplyBtn"]');
      const count = await allLinks.count();
      for (let i = 0; i < count; i++) {
        try {
          const el = allLinks.nth(i);
          const text = await el.textContent().catch(() => '');
          const trimmed = text.trim();
          // "신청작성예시", "신청 방법" 등 제외
          const excludeTexts = ['신청작성예시', '신청 방법', '회원 신청', '비회원 신청'];
          if (excludeTexts.some(ex => trimmed.includes(ex))) continue;

          if (trimmed && (
            trimmed === '신청하기' || trimmed === '신고하기' ||
            trimmed === '인터넷으로 신청하기' ||
            trimmed === '민원신청하기' || trimmed === '민원신청' ||
            /^인터넷.*신청/.test(trimmed) || /^온라인.*신청/.test(trimmed)
          )) {
            const isVisible = await el.isVisible().catch(() => false);
            if (isVisible) {
              log('apply', `신청 버튼 발견 (텍스트 탐색): "${trimmed}"`);
              await humanDelay(300, 800);
              await el.click();
              applyClicked = true;
              break;
            }
          }
        } catch (e) {
          // skip
        }
      }
    }

    if (!applyClicked) {
      // 신청 버튼을 못 찾으면 현재 페이지가 이미 신청 폼일 수 있음
      log('apply', '신청 버튼 미발견 - 현재 페이지가 신청 폼인지 확인');
      // 폼 요소가 있는지 확인
      const hasForm = await page.locator('form, input[type="text"], textarea, input[type="file"]').count();
      log('apply', `폼 요소 수: ${hasForm}`);
    }

    if (applyClicked) {
      // 신청 버튼 클릭 후 잠시 대기 (모달이 뜰 수 있음)
      await humanDelay(1500, 2500);

      // ========= 회원/비회원 선택 모달 처리 =========
      // 정부24는 신청 버튼 클릭 시 "회원 신청하기" / "비회원 신청하기" 팝업을 띄움
      const memberBtn = page.locator('#memberApplyBtn');
      const nonMemberBtn = page.locator('#nonMemberApplyBtn');
      const memberVisible = await memberBtn.isVisible({ timeout: 2000 }).catch(() => false);
      const nonMemberVisible = await nonMemberBtn.isVisible({ timeout: 1000 }).catch(() => false);

      if (memberVisible || nonMemberVisible) {
        log('apply', `로그인 선택 모달 발견 (회원: ${memberVisible}, 비회원: ${nonMemberVisible})`);
        // 인증 쿠키가 있으므로 "회원 신청하기" 클릭
        if (memberVisible) {
          await humanDelay(300, 800);
          await memberBtn.click();
          log('apply', '회원 신청하기 클릭');
        } else if (nonMemberVisible) {
          await humanDelay(300, 800);
          await nonMemberBtn.click();
          log('apply', '비회원 신청하기 클릭');
        }
      }

      // 페이지 전환 대기
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await humanDelay(2000, 3000);
    } else {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await humanDelay(1000, 2000);
    }
    await saveScreenshot(page, `${taskId}_02_apply_page`);

    // 신청 버튼 클릭 후 새 페이지 URL/제목 기록
    const afterApplyUrl = page.url();
    const afterApplyTitle = await page.title();
    log('apply', `신청 후 페이지: ${afterApplyTitle} (${afterApplyUrl})`);

    // 로그인 페이지로 리디렉트된 경우 → 인증 쿠키가 유효하지 않음
    if (afterApplyUrl.includes('/login') || afterApplyUrl.includes('nlogin')) {
      log('apply', '로그인 페이지로 리디렉트됨 - 인증 세션이 만료되었거나 유효하지 않음', 'warning');
      await saveScreenshot(page, `${taskId}_02_login_redirect`);
      return {
        success: false,
        taskId,
        phase: 'error',
        error: '인증 세션이 만료되었습니다. 다시 인증을 진행해주세요.',
        logs,
        screenshots: [`${taskId}_02_login_redirect`],
      };
    }

    // =========================================================================
    // Step 5: 파일 업로드
    // =========================================================================
    onProgress(60);
    if (localFilePaths.length > 0) {
      log('upload', `파일 업로드 시도 (${localFilePaths.length}개)`);

      // 방법 1: input[type="file"] 직접 찾기
      const fileInputSelectors = [
        'input[type="file"]',
        'input[type="file"][name*="file"]',
        'input[type="file"][name*="attach"]',
        'input[type="file"][id*="file"]',
        'input[type="file"][id*="attach"]',
      ];

      let fileUploaded = false;
      for (const sel of fileInputSelectors) {
        const fileInputs = page.locator(sel);
        const count = await fileInputs.count();

        if (count > 0) {
          // hidden input이면 visible 제거 후 사용
          const fileInput = fileInputs.first();
          await fileInput.setInputFiles(localFilePaths);
          log('upload', `파일 업로드 완료 (${sel})`);
          fileUploaded = true;
          break;
        }
      }

      // 방법 2: "첨부" 버튼 클릭 → 파일 다이얼로그
      if (!fileUploaded) {
        const attachSelectors = [
          'button:has-text("파일첨부")',
          'button:has-text("파일 첨부")',
          'a:has-text("파일첨부")',
          'button:has-text("첨부파일")',
          'button:has-text("첨부")',
          'a:has-text("첨부")',
          'input[type="button"][value*="첨부"]',
          'label[for*="file"]',
        ];

        for (const sel of attachSelectors) {
          const attachBtn = page.locator(sel).first();
          if (await attachBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            log('upload', `첨부 버튼 발견: ${sel}`);

            // 파일 선택 다이얼로그 가로채기
            const [fileChooser] = await Promise.all([
              page.waitForEvent('filechooser', { timeout: 5000 }),
              attachBtn.click(),
            ]).catch(() => [null]);

            if (fileChooser) {
              await fileChooser.setFiles(localFilePaths);
              log('upload', '파일 선택 완료 (filechooser)');
              fileUploaded = true;
            }
            break;
          }
        }
      }

      if (!fileUploaded) {
        log('upload', '파일 업로드 요소를 찾지 못함 - 수동 업로드 필요', 'warning');
      }

      await humanDelay(1000, 2000);
      await saveScreenshot(page, `${taskId}_03_file_uploaded`);
    }

    // =========================================================================
    // Step 6: 폼 필드 채우기
    // =========================================================================
    if (formData && Object.keys(formData).length > 0) {
      log('fill', `폼 필드 ${Object.keys(formData).length}개 입력`);

      for (const [fieldName, value] of Object.entries(formData)) {
        // name, id, placeholder 등으로 필드 탐색
        const fieldSelectors = [
          `input[name="${fieldName}"]`,
          `textarea[name="${fieldName}"]`,
          `select[name="${fieldName}"]`,
          `input[id="${fieldName}"]`,
          `textarea[id="${fieldName}"]`,
          `input[placeholder*="${fieldName}"]`,
        ];

        for (const sel of fieldSelectors) {
          const field = page.locator(sel).first();
          if (await field.isVisible({ timeout: 1000 }).catch(() => false)) {
            const tagName = await field.evaluate(el => el.tagName).catch(() => '');
            if (tagName === 'SELECT') {
              await field.selectOption(value).catch(() => {});
            } else {
              await field.fill(value).catch(() => {});
            }
            log('fill', `필드 입력: ${fieldName} = ${value.substring(0, 20)}...`);
            break;
          }
        }
        await humanDelay(200, 500);
      }

      await saveScreenshot(page, `${taskId}_04_form_filled`);
    }

    // =========================================================================
    // Step 7: 제출 버튼 클릭
    // =========================================================================
    // 제출 페이지 요소 분석 (디버그)
    const submitPageElements = await page.evaluate(() => {
      const elements = [];
      const clickables = document.querySelectorAll('a, button, input[type="button"], input[type="submit"], [onclick]');
      clickables.forEach((el) => {
        const text = (el.textContent || el.value || '').trim().substring(0, 60);
        if (!text) return;
        const keywords = ['신청', '제출', '접수', '확인', '등록', '완료', 'submit', 'save', '저장', '다음'];
        const className = el.className || '';
        const onclick = el.getAttribute('onclick') || '';
        if (keywords.some(k => text.includes(k) || onclick.includes(k) || className.includes(k))) {
          elements.push({
            tag: el.tagName,
            text: text.substring(0, 40),
            className: className.substring(0, 50),
            id: el.id || '',
            onclick: onclick.substring(0, 80),
            visible: el.offsetParent !== null,
          });
        }
      });
      return elements;
    }).catch(() => []);
    log('debug', `제출 페이지 요소: ${JSON.stringify(submitPageElements)}`);

    onProgress(80);
    log('submit', '제출 버튼 탐색');
    const submitSelectors = [
      // onclick 기반 (가장 정확함)
      '[onclick*="doSubmit"]',
      '[onclick*="fnSubmit"]',
      '[onclick*="fn_submit"]',
      '[onclick*="goSubmit"]',
      '[onclick*="doSave"]',
      '[onclick*="fnSave"]',
      // submit 타입
      'button[type="submit"]',
      'input[type="submit"]',
      // 정부24 폼 내 제출 버튼 (정확한 텍스트 매칭)
      'button:has-text("민원신청하기")',
      'a:has-text("민원신청하기")',
      'span:has-text("민원신청하기")',
      'button:has-text("신청하기")',
      'a:has-text("신청하기"):not([href*="InfoCapp"])',  // 정보페이지 링크 제외
      'button:has-text("제출하기")',
      'a:has-text("제출하기")',
      // input 버튼
      'input[type="button"][value*="신청하기"]',
      'input[type="button"][value*="제출하기"]',
      'input[type="button"][value*="신고하기"]',
      // 클래스 기반
      'a.btn_blue_l:has-text("신청")',
      'button[class*="btn"]:has-text("신청하기")',
      // 다음 단계 (다단계 폼)
      'button:has-text("다음")',
      'a:has-text("다음 단계")',
      'button:has-text("다음 단계")',
    ];

    let submitClicked = false;
    for (const sel of submitSelectors) {
      try {
        const submitBtn = page.locator(sel).first();
        if (await submitBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          const btnText = await submitBtn.textContent().catch(() => '');
          log('submit', `제출 버튼 발견: ${sel} (text: "${btnText.trim().substring(0, 30)}")`);
          await humanDelay(500, 1000);
          await submitBtn.click();
          submitClicked = true;
          break;
        }
      } catch (e) {
        // 잘못된 셀렉터는 무시
      }
    }

    // 텍스트 기반 broad 검색 (제출) - "제출 서류" 같은 섹션 링크 제외
    if (!submitClicked) {
      const allBtns = page.locator('a, button, span, input[type="button"], input[type="submit"]');
      const btnCount = await allBtns.count();
      for (let i = 0; i < btnCount; i++) {
        try {
          const el = allBtns.nth(i);
          const text = (await el.textContent().catch(() => '') || await el.getAttribute('value').catch(() => '') || '').trim();
          // "제출 서류", "신청 방법" 등 섹션 제목은 제외
          const excludeTexts = ['제출 서류', '신청 방법', '신청작성예시', '신청 방법 및 절차'];
          if (excludeTexts.some(ex => text.includes(ex))) continue;

          if (text && (
            text === '민원신청하기' || text === '민원신청' ||
            text === '신청하기' || text === '제출하기' ||
            text === '접수하기' || text === '신고하기' ||
            /^민원.*신청$/.test(text) || /^제출.*하기$/.test(text) ||
            /^신고.*하기$/.test(text)
          )) {
            const isVisible = await el.isVisible().catch(() => false);
            if (isVisible) {
              log('submit', `제출 버튼 발견 (텍스트 탐색): "${text}"`);
              await humanDelay(500, 1000);
              await el.click();
              submitClicked = true;
              break;
            }
          }
        } catch (e) {
          // skip
        }
      }
    }

    if (!submitClicked) {
      await saveScreenshot(page, `${taskId}_05_no_submit_btn`);
      log('submit', '제출 버튼을 찾지 못함', 'warning');
      return {
        success: false,
        taskId,
        phase: 'error',
        error: '제출 버튼을 찾지 못했습니다. 페이지 구조를 확인해주세요.',
        logs,
        screenshots: [`${taskId}_05_no_submit_btn`],
      };
    }

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await humanDelay(2000, 4000);
    await saveScreenshot(page, `${taskId}_06_after_submit`);

    // =========================================================================
    // Step 8: 접수번호 추출
    // =========================================================================
    onProgress(90);
    log('receipt', '접수번호 추출 시도');

    const pageText = await page.textContent('body').catch(() => '');
    const finalUrl = page.url();
    log('receipt', `제출 후 URL: ${finalUrl}`);

    // 접수번호 패턴 여러 개 시도 (키워드 앞에 반드시 "접수/신청/처리" 라벨이 있어야 함)
    const receiptPatterns = [
      /접수번호\s*[:\s]+([A-Za-z0-9\-]{5,})/,
      /신청번호\s*[:\s]+([A-Za-z0-9\-]{5,})/,
      /처리번호\s*[:\s]+([A-Za-z0-9\-]{5,})/,
      /접수\s*번호\s*[:\s]+(\d[\d\-]+\d)/,
      /신청\s*번호\s*[:\s]+(\d[\d\-]+\d)/,
      /(\d{4,5}-\d{4}-\d{4,})/,             // 12345-2024-123456 형태 (접수번호 고유 패턴)
    ];

    let receiptNumber = null;
    for (const pattern of receiptPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        receiptNumber = match[1];
        log('receipt', `접수번호 추출 성공: ${receiptNumber}`);
        break;
      }
    }

    // DOM 요소에서도 시도
    if (!receiptNumber) {
      const receiptSelectors = [
        '.receipt-number',
        '#receiptNo',
        '[class*="receipt"]',
        'td:has-text("접수번호") + td',
        'th:has-text("접수번호") + td',
        'span:has-text("접수번호")',
      ];

      for (const sel of receiptSelectors) {
        const el = page.locator(sel).first();
        const text = await el.textContent().catch(() => '');
        if (text && /\d/.test(text)) {
          receiptNumber = text.trim().replace(/접수번호\s*:?\s*/, '');
          log('receipt', `DOM에서 접수번호 추출: ${receiptNumber}`);
          break;
        }
      }
    }

    // 접수 완료 여부 확인 (단순 "접수" 포함이 아닌, 실제 완료 메시지 확인)
    // 제출 후 URL이 변경되었거나, 명확한 완료 메시지가 있어야 함
    const urlChanged = finalUrl !== afterApplyUrl;
    const isCompleted = (
      pageText.includes('접수가 완료되었습니다') ||
      pageText.includes('신청이 완료되었습니다') ||
      pageText.includes('민원이 접수되었습니다') ||
      pageText.includes('정상적으로 접수') ||
      pageText.includes('정상적으로 신청') ||
      pageText.includes('처리가 완료되었습니다') ||
      // URL에 result/complete 등이 포함된 경우
      finalUrl.includes('result') ||
      finalUrl.includes('complete') ||
      finalUrl.includes('finish')
    );
    log('receipt', `URL 변경: ${urlChanged}, 완료 메시지: ${isCompleted}`);

    await saveScreenshot(page, `${taskId}_07_final`);

    if (receiptNumber || isCompleted) {
      log('success', `민원 제출 완료 (접수번호: ${receiptNumber || '확인필요'})`);
      return {
        success: true,
        taskId,
        phase: 'submitted',
        message: receiptNumber
          ? `민원이 접수되었습니다. 접수번호: ${receiptNumber}`
          : '민원이 접수되었습니다.',
        receiptNumber,
        finalUrl,
        logs,
      };
    }

    // 제출은 했지만 접수번호를 못 찾은 경우
    log('warning', '제출 후 접수 확인 페이지를 찾지 못함', 'warning');
    return {
      success: true,
      taskId,
      phase: 'submitted',
      message: '제출 버튼을 클릭했습니다. 접수 결과를 정부24에서 확인해주세요.',
      receiptNumber: null,
      finalUrl,
      logs,
    };

  } catch (error) {
    log('error', error.message, 'error');

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
    // 임시 파일 정리
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
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
