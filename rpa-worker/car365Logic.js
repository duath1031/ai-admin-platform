/**
 * =============================================================================
 * 자동차365 이전등록 RPA 봇 (car365.go.kr)
 * =============================================================================
 *
 * [플로우]
 * 1. car365.go.kr 접속 → 이전등록 메뉴
 * 2. 비회원 본인인증 (휴대폰 인증)
 * 3. 양도인/양수인/차량 정보 입력
 * 4. 이전등록 신청 제출
 * 5. 양도인 동의 요청 알림 → 양도인 동의 → 이전 완료
 *
 * [2단계 세션 방식]
 * - startTransfer(): 사이트 접속 → 본인인증 요청 (브라우저 세션 유지)
 * - confirmTransfer(): 인증 완료 후 → 폼 입력 → 제출
 *
 * [참고]
 * - 자동차365 URL: https://www.car365.go.kr
 * - 이전등록: 자동차 > 이전등록
 * - 비회원 로그인 후 휴대폰 인증으로 본인확인
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
  navigation: 60000,    // 해외 서버→한국 gov 사이트 60초
  element: 15000,
  authWait: 180000,     // 본인인증 대기 3분
  polling: 3000,
  sessionTTL: 600000,   // 세션 유효시간 10분
};

// =============================================================================
// 브라우저 세션 풀 - 인증 후 세션 유지
// =============================================================================
const browserSessions = new Map();

function saveSession(taskId, sessionData) {
  browserSessions.set(taskId, { ...sessionData, createdAt: Date.now() });
  console.log(`[Car365 Session] Saved: ${taskId}`);
}

function getSession(taskId) {
  const session = browserSessions.get(taskId);
  if (!session) return null;
  if (Date.now() - session.createdAt > TIMEOUTS.sessionTTL) {
    console.log(`[Car365 Session] Expired: ${taskId}`);
    cleanupSession(taskId);
    return null;
  }
  return session;
}

async function cleanupSession(taskId) {
  const session = browserSessions.get(taskId);
  if (session) {
    try {
      if (session.browser) await session.browser.close();
    } catch (e) {
      console.error(`[Car365 Session] Cleanup error: ${e.message}`);
    }
    browserSessions.delete(taskId);
    console.log(`[Car365 Session] Cleaned: ${taskId}`);
  }
}

// 주기적 세션 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [taskId, session] of browserSessions.entries()) {
    if (now - session.createdAt > TIMEOUTS.sessionTTL) {
      cleanupSession(taskId);
    }
  }
}, 300000);

// =============================================================================
// Step 1: 이전등록 시작 - 사이트 접속 + 본인인증 요청
// =============================================================================
async function startTransfer(data) {
  const {
    name,           // 양수인(매수인) 이름
    phoneNumber,    // 양수인 전화번호 (010-xxxx-xxxx)
    carrier,        // 통신사 (SKT, KT, LGU+, SKT_MVNO, KT_MVNO, LGU+_MVNO)
    birthDate,      // 생년월일 6자리
  } = data;

  const taskId = uuidv4();
  const logs = [];
  const log = (msg) => { console.log(`[Car365 ${taskId.slice(0, 8)}] ${msg}`); logs.push(msg); };

  let browser = null;

  try {
    log('브라우저 시작...');
    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    const page = stealth.page;

    // 다이얼로그 자동 수락
    page.on('dialog', async (dialog) => {
      log(`다이얼로그: ${dialog.type()} - ${dialog.message()}`);
      await dialog.accept();
    });

    // Step 1: car365.go.kr 접속
    log('자동차365 접속 중...');
    await page.goto('https://www.car365.go.kr', {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });
    await humanDelay(2000, 3000);

    // 스크린샷 (초기 페이지)
    await stealthScreenshot(page, `car365_start_${taskId.slice(0, 8)}`);
    log(`현재 URL: ${page.url()}`);

    // Step 2: 이전등록 메뉴 찾기 및 클릭
    log('이전등록 메뉴 탐색 중...');

    // 메인 페이지에서 이전등록 관련 링크/버튼 찾기
    const transferMenuFound = await page.evaluate(() => {
      // 다양한 셀렉터로 이전등록 메뉴 찾기
      const selectors = [
        'a[href*="transfer"]',
        'a[href*="이전"]',
        'a:has-text("이전등록")',
        'button:has-text("이전등록")',
        '[onclick*="transfer"]',
        '[onclick*="이전"]',
      ];

      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            el.click();
            return { found: true, selector: sel, text: el.textContent?.trim()?.substring(0, 50) };
          }
        } catch (e) { /* continue */ }
      }

      // 텍스트 기반 검색
      const allLinks = document.querySelectorAll('a, button');
      for (const link of allLinks) {
        const text = link.textContent?.trim() || '';
        if (text.includes('이전등록') || text.includes('명의이전')) {
          link.click();
          return { found: true, selector: 'text-search', text: text.substring(0, 50) };
        }
      }

      return { found: false };
    });

    if (transferMenuFound.found) {
      log(`이전등록 메뉴 발견: ${transferMenuFound.text} (${transferMenuFound.selector})`);
    } else {
      log('이전등록 메뉴를 직접 찾지 못함, URL 직접 접근 시도...');
      // 이전등록 관련 직접 URL 시도
      const possibleUrls = [
        'https://www.car365.go.kr/web/contents/transfer.do',
        'https://www.car365.go.kr/web/transfer/transferReqList.do',
        'https://www.car365.go.kr/web/contents/biz_ntransferregist.do',
      ];

      let urlFound = false;
      for (const url of possibleUrls) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const title = await page.title();
          if (!title.includes('404') && !title.includes('오류')) {
            log(`직접 URL 접근 성공: ${url}`);
            urlFound = true;
            break;
          }
        } catch (e) {
          log(`URL 시도 실패: ${url}`);
        }
      }

      if (!urlFound) {
        log('이전등록 페이지를 찾을 수 없음');
      }
    }

    await humanDelay(2000, 3000);
    await stealthScreenshot(page, `car365_transfer_page_${taskId.slice(0, 8)}`);
    log(`이전등록 페이지 URL: ${page.url()}`);

    // Step 3: 페이지 구조 덤프 (디버깅용)
    const pageDump = await page.evaluate(() => {
      const body = document.body;
      if (!body) return { error: 'no body' };

      // 모든 input, select, button 수집
      const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(e => ({
        tag: e.tagName, id: e.id, name: e.name, type: e.type || '',
        placeholder: e.placeholder || '', cls: e.className?.substring(0, 80) || '',
        visible: e.offsetParent !== null,
      }));

      const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]')).map(e => ({
        tag: e.tagName, id: e.id, cls: e.className?.substring(0, 80) || '',
        text: (e.textContent || e.value || '').trim().substring(0, 60),
        href: e.href || '', onclick: e.getAttribute('onclick')?.substring(0, 100) || '',
      }));

      // iframe 확인
      const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
        id: f.id, name: f.name, src: f.src, visible: f.offsetParent !== null,
      }));

      // 본인인증 관련 요소
      const authKeywords = ['인증', '본인', '휴대폰', 'phone', 'auth', 'verify', '비회원', 'login'];
      const authElements = Array.from(document.querySelectorAll('*')).filter(e => {
        const text = (e.textContent || '').toLowerCase();
        return authKeywords.some(k => text.includes(k)) && e.children.length < 3;
      }).slice(0, 20).map(e => ({
        tag: e.tagName, id: e.id, cls: e.className?.substring(0, 60) || '',
        text: e.textContent?.trim()?.substring(0, 80) || '',
      }));

      return {
        title: document.title,
        url: window.location.href,
        inputs: inputs.filter(i => i.visible),
        buttons: buttons.filter(b => b.text || b.id),
        iframes,
        authElements,
        bodySnippet: body.innerText?.substring(0, 2000) || '',
      };
    });

    log(`페이지 제목: ${pageDump.title}`);
    log(`입력 필드: ${pageDump.inputs?.length || 0}개`);
    log(`버튼: ${pageDump.buttons?.length || 0}개`);
    log(`iframe: ${pageDump.iframes?.length || 0}개`);

    // Step 4: 본인인증 영역 찾기 (비회원 / 휴대폰 인증)
    // 본인인증이 필요한 경우, 이름/생년월일/전화번호 입력 후 인증 요청
    let authTriggered = false;

    // 비회원 인증 버튼 찾기 및 클릭
    const nonMemberBtn = await page.evaluate(() => {
      const keywords = ['비회원', '본인인증', '휴대폰 인증', '인증하기'];
      const allEls = document.querySelectorAll('button, a, input[type="button"]');
      for (const el of allEls) {
        const text = (el.textContent || el.value || '').trim();
        for (const kw of keywords) {
          if (text.includes(kw)) {
            el.click();
            return { found: true, text: text.substring(0, 50) };
          }
        }
      }
      return { found: false };
    });

    if (nonMemberBtn.found) {
      log(`비회원 인증 버튼 클릭: ${nonMemberBtn.text}`);
      await humanDelay(2000, 3000);
    }

    // 이름, 생년월일, 전화번호 입력 시도
    // (실제 사이트 셀렉터에 맞게 조정 필요 - 디버그 데이터 기반)
    const authInputResult = await fillAuthForm(page, {
      name,
      birthDate,
      phoneNumber,
      carrier,
    }, log);

    if (authInputResult.success) {
      authTriggered = true;
      log('본인인증 정보 입력 완료, 인증 요청 버튼 클릭...');
    }

    await stealthScreenshot(page, `car365_auth_${taskId.slice(0, 8)}`);

    // 세션 저장 (브라우저 세션 유지)
    saveSession(taskId, {
      browser,
      page,
      transferData: data,
      authTriggered,
    });

    return {
      success: true,
      taskId,
      status: authTriggered ? 'auth_requested' : 'page_loaded',
      message: authTriggered
        ? '본인인증 요청이 발송되었습니다. 휴대폰에서 인증을 완료해 주세요.'
        : '페이지 로딩 완료. 디버그 데이터를 확인하세요.',
      pageDump,
      logs,
    };

  } catch (error) {
    log(`오류 발생: ${error.message}`);

    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }

    return {
      success: false,
      taskId,
      error: error.message,
      logs,
    };
  }
}

// =============================================================================
// 본인인증 폼 입력 헬퍼
// =============================================================================
async function fillAuthForm(page, authData, log) {
  const { name, birthDate, phoneNumber, carrier } = authData;

  try {
    // 이름 입력 필드 탐색 (다양한 셀렉터)
    const nameSelectors = [
      'input[name*="name" i]',
      'input[name*="nm" i]',
      'input[id*="name" i]',
      'input[id*="nm" i]',
      'input[placeholder*="이름"]',
      'input[placeholder*="성명"]',
      '#userName', '#userNm', '#aplcntNm',
    ];

    for (const sel of nameSelectors) {
      const el = await page.$(sel);
      if (el && await el.isVisible()) {
        await el.fill('');
        await el.type(name, { delay: 80 });
        log(`이름 입력 완료: ${sel}`);
        break;
      }
    }

    // 생년월일 입력
    const birthSelectors = [
      'input[name*="birth" i]',
      'input[name*="brdt" i]',
      'input[id*="birth" i]',
      'input[placeholder*="생년월일"]',
      '#birthDate', '#brdt',
    ];

    for (const sel of birthSelectors) {
      const el = await page.$(sel);
      if (el && await el.isVisible()) {
        await el.fill('');
        await el.type(birthDate, { delay: 80 });
        log(`생년월일 입력 완료: ${sel}`);
        break;
      }
    }

    // 전화번호 입력
    const phone = phoneNumber.replace(/-/g, '');
    const phoneSelectors = [
      'input[name*="phone" i]',
      'input[name*="hp" i]',
      'input[name*="mobile" i]',
      'input[name*="telno" i]',
      'input[id*="phone" i]',
      'input[id*="hp" i]',
      'input[placeholder*="전화"]',
      'input[placeholder*="휴대폰"]',
      '#phoneNumber', '#hpno', '#mbtlnum',
    ];

    for (const sel of phoneSelectors) {
      const el = await page.$(sel);
      if (el && await el.isVisible()) {
        await el.fill('');
        await el.type(phone, { delay: 80 });
        log(`전화번호 입력 완료: ${sel}`);
        break;
      }
    }

    // 통신사 선택 (select 또는 radio)
    if (carrier) {
      const carrierMap = {
        'SKT': ['SKT', 'SK텔레콤', '01'],
        'KT': ['KT', 'KT', '02'],
        'LGU+': ['LGU+', 'LG유플러스', '03'],
        'SKT_MVNO': ['SKT알뜰폰', 'SK알뜰', '04'],
        'KT_MVNO': ['KT알뜰폰', 'KT알뜰', '05'],
        'LGU+_MVNO': ['LG알뜰폰', 'LG알뜰', '06'],
      };

      const carrierValues = carrierMap[carrier] || [carrier];

      // select 방식
      const selectEls = await page.$$('select');
      for (const sel of selectEls) {
        const options = await sel.evaluate(el => {
          return Array.from(el.options).map(o => ({ value: o.value, text: o.textContent?.trim() }));
        });

        const match = options.find(o =>
          carrierValues.some(cv => o.text?.includes(cv) || o.value === cv)
        );

        if (match) {
          await sel.selectOption(match.value);
          log(`통신사 선택: ${match.text} (${match.value})`);
          break;
        }
      }
    }

    await humanDelay(500, 1000);

    // 약관 동의 체크박스
    const agreeSelectors = [
      'input[type="checkbox"][id*="agree" i]',
      'input[type="checkbox"][id*="all" i]',
      'input[type="checkbox"][name*="agree" i]',
      '#totalAgree', '#allAgree', '#agreeAll',
      'label:has-text("전체 동의") input[type="checkbox"]',
      'label:has-text("약관") input[type="checkbox"]',
    ];

    for (const sel of agreeSelectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) {
          const checked = await el.isChecked();
          if (!checked) {
            await el.check();
            log(`약관 동의 체크: ${sel}`);
          }
        }
      } catch (e) { /* continue */ }
    }

    await humanDelay(500, 1000);

    // 인증 요청 버튼 클릭
    const authBtnSelectors = [
      'button:has-text("인증요청")',
      'button:has-text("인증 요청")',
      'button:has-text("본인인증")',
      'button:has-text("인증하기")',
      'button:has-text("확인")',
      'input[type="submit"][value*="인증"]',
      '#btnAuth', '#authBtn', '#reqAuthBtn',
    ];

    let authBtnClicked = false;
    for (const sel of authBtnSelectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) {
          await el.click();
          log(`인증 요청 버튼 클릭: ${sel}`);
          authBtnClicked = true;
          break;
        }
      } catch (e) { /* continue */ }
    }

    await humanDelay(2000, 3000);

    return { success: authBtnClicked };

  } catch (error) {
    log(`인증 폼 입력 오류: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// Step 2: 인증 완료 후 - 이전등록 폼 작성 및 제출
// =============================================================================
async function confirmTransfer(data) {
  const { taskId } = data;
  const logs = [];
  const log = (msg) => { console.log(`[Car365 Confirm ${taskId?.slice(0, 8)}] ${msg}`); logs.push(msg); };

  const session = getSession(taskId);
  if (!session) {
    return {
      success: false,
      error: '세션이 만료되었거나 존재하지 않습니다. 처음부터 다시 시도해 주세요.',
      logs,
    };
  }

  const { page, browser, transferData } = session;

  try {
    log('세션 복원됨, 인증 상태 확인 중...');

    await stealthScreenshot(page, `car365_confirm_start_${taskId.slice(0, 8)}`);
    const currentUrl = page.url();
    log(`현재 URL: ${currentUrl}`);

    // 인증 완료 여부 확인
    const pageState = await page.evaluate(() => {
      const bodyText = document.body?.innerText || '';
      const hasForm = document.querySelectorAll('input, select, textarea').length > 5;
      const hasError = bodyText.includes('인증 실패') || bodyText.includes('인증에 실패');
      const hasSuccess = bodyText.includes('인증 완료') || bodyText.includes('인증이 완료');
      return { hasForm, hasError, hasSuccess, bodySnippet: bodyText.substring(0, 1000) };
    });

    if (pageState.hasError) {
      log('본인인증 실패 감지');
      await cleanupSession(taskId);
      return { success: false, error: '본인인증에 실패했습니다.', logs };
    }

    log(`인증 상태: ${pageState.hasSuccess ? '완료' : '진행 중'}, 폼 존재: ${pageState.hasForm}`);

    // 이전등록 폼 입력
    if (transferData) {
      log('이전등록 정보 입력 시작...');
      await fillTransferForm(page, transferData, log);
    }

    await stealthScreenshot(page, `car365_form_filled_${taskId.slice(0, 8)}`);

    // 신청 버튼 클릭 (실제 제출은 autoSubmit 옵션에 따라)
    const autoSubmit = data.autoSubmit !== false; // 기본: 자동제출
    let submitResult = null;

    if (autoSubmit) {
      log('신청 버튼 클릭 시도...');
      submitResult = await clickSubmitButton(page, log);
      await humanDelay(3000, 5000);
      await stealthScreenshot(page, `car365_submitted_${taskId.slice(0, 8)}`);

      // 접수 결과 확인
      const result = await page.evaluate(() => {
        const bodyText = document.body?.innerText || '';
        const hasSuccess = bodyText.includes('접수') || bodyText.includes('신청 완료') || bodyText.includes('완료');
        const hasNumber = bodyText.match(/접수[번호]*\s*[:：]?\s*([A-Za-z0-9-]+)/);
        return {
          success: hasSuccess,
          receiptNumber: hasNumber ? hasNumber[1] : null,
          bodySnippet: bodyText.substring(0, 1000),
        };
      });

      log(`접수 결과: ${result.success ? '성공' : '미확인'}`);
      if (result.receiptNumber) {
        log(`접수번호: ${result.receiptNumber}`);
      }

      await cleanupSession(taskId);

      return {
        success: true,
        taskId,
        status: 'submitted',
        receiptNumber: result.receiptNumber,
        message: result.receiptNumber
          ? `이전등록 신청이 완료되었습니다. 접수번호: ${result.receiptNumber}`
          : '이전등록 신청이 제출되었습니다. 결과를 확인해 주세요.',
        logs,
      };

    } else {
      log('자동제출 비활성화 - 미리보기 상태');
      return {
        success: true,
        taskId,
        status: 'preview',
        message: '폼 입력이 완료되었습니다. 직접 확인 후 제출해 주세요.',
        logs,
      };
    }

  } catch (error) {
    log(`오류 발생: ${error.message}`);
    await cleanupSession(taskId);
    return { success: false, taskId, error: error.message, logs };
  }
}

// =============================================================================
// 이전등록 폼 입력 헬퍼
// =============================================================================
async function fillTransferForm(page, data, log) {
  const {
    sellerName, sellerPhone, sellerIdNumber,
    buyerName, buyerPhone, buyerIdNumber, buyerAddress,
    vehicleName, plateNumber, modelYear, mileage,
    salePrice, transferDate, region,
  } = data;

  // 일반적인 필드 매핑 (셀렉터 → 값)
  const fieldMappings = [
    // 양도인 정보
    { selectors: ['input[name*="seller" i]', 'input[name*="trnsfr" i]', 'input[id*="sellerNm" i]', 'input[placeholder*="양도인"]'], value: sellerName, label: '양도인 성명' },
    { selectors: ['input[name*="sellerPhone" i]', 'input[name*="trnsfrTelno" i]', 'input[id*="sellerPhone" i]'], value: sellerPhone?.replace(/-/g, ''), label: '양도인 전화번호' },

    // 양수인 정보
    { selectors: ['input[name*="buyer" i]', 'input[name*="acquir" i]', 'input[id*="buyerNm" i]', 'input[placeholder*="양수인"]'], value: buyerName, label: '양수인 성명' },
    { selectors: ['input[name*="buyerPhone" i]', 'input[name*="acquirTelno" i]', 'input[id*="buyerPhone" i]'], value: buyerPhone?.replace(/-/g, ''), label: '양수인 전화번호' },
    { selectors: ['input[name*="buyerAddr" i]', 'input[name*="acquirAddr" i]', 'input[placeholder*="주소"]'], value: buyerAddress, label: '양수인 주소' },

    // 차량 정보
    { selectors: ['input[name*="vhcle" i]', 'input[name*="carNm" i]', 'input[id*="vhcleNm" i]', 'input[placeholder*="차명"]'], value: vehicleName, label: '차량명' },
    { selectors: ['input[name*="plate" i]', 'input[name*="vhcleNo" i]', 'input[id*="plateNo" i]', 'input[placeholder*="차량번호"]'], value: plateNumber, label: '차량번호' },
    { selectors: ['input[name*="year" i]', 'input[name*="mdlYear" i]'], value: modelYear?.toString(), label: '연식' },
    { selectors: ['input[name*="mileage" i]', 'input[name*="drvDstanc" i]', 'input[placeholder*="주행"]'], value: mileage?.toString(), label: '주행거리' },

    // 거래 정보
    { selectors: ['input[name*="price" i]', 'input[name*="amt" i]', 'input[name*="salePc" i]', 'input[placeholder*="금액"]'], value: salePrice?.toString(), label: '매매금액' },
    { selectors: ['input[name*="date" i][type="date"]', 'input[name*="trnsfrDe" i]', 'input[id*="transferDate" i]'], value: transferDate, label: '양도일자' },
  ];

  for (const mapping of fieldMappings) {
    if (!mapping.value) continue;

    for (const sel of mapping.selectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) {
          await el.fill('');
          if (sel.includes('type="date"')) {
            await el.fill(mapping.value);
          } else {
            await el.type(mapping.value, { delay: 60 });
          }
          log(`${mapping.label} 입력: ${sel}`);
          break;
        }
      } catch (e) { /* continue */ }
    }
  }

  // 지역 선택 (select)
  if (region) {
    const selectEls = await page.$$('select');
    for (const sel of selectEls) {
      const options = await sel.evaluate(el => {
        return Array.from(el.options).map(o => ({ value: o.value, text: o.textContent?.trim() }));
      });

      const match = options.find(o => o.text?.includes(region));
      if (match) {
        await sel.selectOption(match.value);
        log(`지역 선택: ${region}`);
        break;
      }
    }
  }

  await humanDelay(1000, 2000);
}

// =============================================================================
// 신청 버튼 클릭 헬퍼
// =============================================================================
async function clickSubmitButton(page, log) {
  const submitSelectors = [
    'button:has-text("신청")',
    'button:has-text("접수")',
    'button:has-text("등록")',
    'button:has-text("제출")',
    'input[type="submit"]',
    '#btnSubmit', '#submitBtn', '#btnReg',
    'button.btn-primary:has-text("신청")',
    'a:has-text("신청하기")',
  ];

  for (const sel of submitSelectors) {
    try {
      const el = await page.$(sel);
      if (el && await el.isVisible()) {
        await el.click();
        log(`신청 버튼 클릭: ${sel}`);
        return { clicked: true, selector: sel };
      }
    } catch (e) { /* continue */ }
  }

  log('신청 버튼을 찾지 못함');
  return { clicked: false };
}

// =============================================================================
// 디버그: car365 페이지 구조 덤프
// =============================================================================
async function debugCar365Page(url) {
  const logs = [];
  const log = (msg) => { console.log(`[Car365 Debug] ${msg}`); logs.push(msg); };

  let browser = null;

  try {
    log('브라우저 시작...');
    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    const page = stealth.page;

    page.on('dialog', async (dialog) => await dialog.accept());

    const targetUrl = url || 'https://www.car365.go.kr';
    log(`접속 중: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    await humanDelay(3000, 5000);

    await stealthScreenshot(page, 'car365_debug');

    // 전체 페이지 구조 덤프
    const dump = await page.evaluate(() => {
      const body = document.body;
      if (!body) return { error: 'no body' };

      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent?.trim()?.substring(0, 60),
        href: a.href,
        visible: a.offsetParent !== null,
      })).filter(l => l.visible && l.text);

      const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(e => ({
        tag: e.tagName, id: e.id, name: e.name, type: e.type || '',
        placeholder: e.placeholder || '', visible: e.offsetParent !== null,
      })).filter(i => i.visible);

      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).map(e => ({
        tag: e.tagName, id: e.id, text: (e.textContent || e.value || '').trim().substring(0, 60),
        onclick: e.getAttribute('onclick')?.substring(0, 100) || '',
        visible: e.offsetParent !== null,
      })).filter(b => b.visible);

      const menus = Array.from(document.querySelectorAll('nav a, .gnb a, .menu a, [class*="nav"] a, [class*="menu"] a')).map(a => ({
        text: a.textContent?.trim()?.substring(0, 40),
        href: a.href,
      })).filter(m => m.text);

      const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
        id: f.id, name: f.name, src: f.src,
      }));

      return {
        title: document.title,
        url: window.location.href,
        links: links.slice(0, 50),
        inputs,
        buttons,
        menus: menus.slice(0, 30),
        iframes,
        bodySnippet: body.innerText?.substring(0, 3000) || '',
      };
    });

    await browser.close();
    browser = null;

    return { success: true, ...dump, logs };

  } catch (error) {
    log(`오류: ${error.message}`);
    if (browser) await browser.close().catch(() => {});
    return { success: false, error: error.message, logs };
  }
}

// =============================================================================
// Exports
// =============================================================================
module.exports = {
  startTransfer,
  confirmTransfer,
  debugCar365Page,
  cleanupSession: cleanupSession,
};
