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
    // Step 5: 개인정보 입력 (evaluate로 직접 DOM 조작 - 한글/인코딩 안전)
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

    // certFrame은 이미 위에서 찾아둠
    const inputFrame = certFrame || page.frames().find(f => f.url().includes('simpleCert'));
    if (inputFrame) {
      const inputResult = await inputFrame.evaluate(({ nameVal, birthVal, carrierVal, phonePrefixVal, phoneVal }) => {
        const results = {};

        // Helper: input에 값 설정 + 이벤트 발생
        function setInputValue(selector, value) {
          const el = document.querySelector(selector);
          if (!el) return { found: false, selector };

          // 기존 값 지우기
          el.value = '';

          // React/Vue 등 프레임워크 호환을 위한 native setter 사용
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(el, value);
          } else {
            el.value = value;
          }

          // 모든 관련 이벤트 발생
          el.dispatchEvent(new Event('focus', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));

          // KeyboardEvent도 시뮬레이션 (일부 사이트에서 필요)
          for (const char of value) {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
          }

          return { found: true, selector, value: el.value, expectedValue: value, match: el.value === value };
        }

        // 5-1. 이름 입력
        results.name = setInputValue('#oacx_name', nameVal);

        // 5-2. 생년월일 입력
        results.birth = setInputValue('#oacx_birth', birthVal);

        // 5-3. 통신사 + 전화번호 앞자리 select
        const selects = document.querySelectorAll('select');
        for (const sel of selects) {
          const allOpts = Array.from(sel.options).map(o => ({ text: o.text.trim(), value: o.value }));
          const hasSKT = allOpts.some(o => o.text === 'SKT' || o.text === 'KT' || o.text === 'LGU+');
          const has010 = allOpts.some(o => o.text === '010' || o.value === '010');

          if (hasSKT && carrierVal) {
            for (let i = 0; i < sel.options.length; i++) {
              const optText = sel.options[i].text.trim();
              if (optText === carrierVal || optText.includes(carrierVal)) {
                sel.selectedIndex = i;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                results.carrier = { selectedIndex: i, text: optText, value: sel.value };
                break;
              }
            }
          }

          if (has010 && !hasSKT) {
            for (let i = 0; i < sel.options.length; i++) {
              const opt = sel.options[i];
              if (opt.value === phonePrefixVal || opt.text.trim() === phonePrefixVal) {
                sel.selectedIndex = i;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                results.phonePrefix = { selectedIndex: i, value: sel.value };
                break;
              }
            }
          }
        }

        // 5-4. 전화번호 뒷자리 입력
        results.phone = setInputValue('#oacx_phone2', phoneVal);

        // 최종 확인
        const nameEl = document.querySelector('#oacx_name');
        const birthEl = document.querySelector('#oacx_birth');
        const phoneEl = document.querySelector('#oacx_phone2');
        results.verify = {
          name: nameEl?.value || '',
          birth: birthEl?.value || '',
          phone: phoneEl?.value || '',
        };

        return results;
      }, {
        nameVal: name,
        birthVal: birthDate,
        carrierVal: carrierValue,
        phonePrefixVal: phonePart1,
        phoneVal: phonePart2,
      });

      log('input', `입력 결과: ${JSON.stringify(inputResult)}`);
    } else {
      // fallback: Playwright 직접 입력
      log('input', 'certFrame 못 찾음, Playwright fill 사용');

      const nameInput = iframeLocator.locator('#oacx_name');
      await nameInput.click();
      await nameInput.fill(name);
      await humanDelay(200, 400);

      const birthInput = iframeLocator.locator('#oacx_birth');
      await birthInput.click();
      await birthInput.fill(birthDate);
      await humanDelay(200, 400);

      const phoneInput = iframeLocator.locator('#oacx_phone2');
      await phoneInput.click();
      await phoneInput.fill(phonePart2);
      log('input', 'Playwright fill 완료');
    }
    await humanDelay(500, 800);

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

        // 이름 에러인 경우 Playwright type()으로 이름 재입력
        if (postClickState.hasNameError) {
          log('retry', 'Playwright type()으로 이름 재입력');
          const nameInput = iframeLocator.locator('#oacx_name');
          await nameInput.click({ clickCount: 3 }); // 기존 텍스트 전체 선택
          await humanDelay(200, 300);
          await nameInput.type(name, { delay: 50 }); // 한 글자씩 타이핑
          await humanDelay(300, 500);

          // 확인
          const retypedName = await postClickFrame2.evaluate(() =>
            document.querySelector('#oacx_name')?.value
          ).catch(() => '');
          log('retry', `이름 재입력 결과: "${retypedName}"`);
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
