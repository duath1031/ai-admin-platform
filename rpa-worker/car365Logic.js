/**
 * =============================================================================
 * 자동차365 이전등록 RPA 봇 (car365.go.kr) - v2 DevTools 우회
 * =============================================================================
 *
 * [핵심 발견 사항]
 * - car365.go.kr은 devtools-detector.js로 DevTools 감지 시 about:blank 리다이렉트
 * - 이전등록(M610201004)은 AnyID(정부통합인증) 로그인 필수
 * - 로그인 → PASS/카카오 간편인증 → 세션 획득 → 이전등록 페이지 접근
 *
 * [플로우]
 * 1. devtools-detector.js 차단 + car365.go.kr 접속
 * 2. AnyID 로그인 팝업 트리거 → 사용자 간편인증(PASS/카카오)
 * 3. 인증 완료 후 → 이전등록 페이지 이동 → 폼 입력 → 제출
 *
 * [2단계 세션 방식]
 * - startTransfer(): 사이트 접속 → 로그인 트리거 → 간편인증 대기 (브라우저 유지)
 * - confirmTransfer(): 인증 완료 후 → 이전등록 폼 → 제출
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
  authWait: 300000,     // 간편인증 대기 5분
  polling: 3000,
  sessionTTL: 600000,   // 세션 유효시간 10분
};

// car365 주요 URL
const CAR365_URLS = {
  main: 'https://www.car365.go.kr',
  login: 'https://www.car365.go.kr/ccpt/mbr/login/mainView.do',
  transfer: 'https://www.car365.go.kr/ccpt/cmmn/menu/redirectMenu.do?menuId=M610201004',
  registration: 'https://www.car365.go.kr/ccpt/cmmn/menu/redirectMenu.do?menuId=M610201000',
};

// =============================================================================
// DevTools 감지 우회 - car365 핵심 수정
// =============================================================================
/**
 * Playwright 페이지에 DevTools 감지 우회 설정
 * car365.go.kr은 devtools-detector.js로 Playwright를 DevTools로 오인 → about:blank 리다이렉트
 * 이를 차단하여 정상적인 페이지 로딩 보장
 */
async function setupDevToolsBypass(page, context, log) {
  // 방법 1: devtools-detector.js 요청 자체를 차단
  await context.route('**/devtools-detector.js', (route) => {
    log('devtools-detector.js 차단됨');
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '// devtools-detector blocked by RPA\nvar devtoolsDetector = { addListener: function(){}, launch: function(){}, stop: function(){} };',
    });
  });

  // 방법 2: TouchEn nxKey 보안 프로그램 설치 페이지 리다이렉트 차단
  // car365 로그인 시 TouchEn 미설치면 install.html로 리다이렉트됨 → 이를 차단
  await context.route('**/touchenNx/install/**', (route) => {
    log('TouchEn 설치 페이지 리다이렉트 차단됨');
    // install.html에서 url 파라미터로 원래 이동하려던 URL이 들어옴
    const url = new URL(route.request().url());
    const redirectUrl = url.searchParams.get('url');
    log(`원래 목적지: ${redirectUrl}`);
    // 빈 페이지 반환 (리다이렉트 방지)
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><script>window.location.href="' + (redirectUrl || 'https://www.car365.go.kr/ccpt/mbr/login/mainView.do') + '";</script></body></html>',
    });
  });

  // 방법 3: TouchEn nxKey 관련 JS 파일 가짜 응답
  await context.route('**/{TouchEn,touchen,nxKey,nxkey,nxweb,ksign}*.js', (route) => {
    const reqUrl = route.request().url();
    // install 관련은 위에서 처리하므로 JS만
    if (reqUrl.includes('install.html')) {
      route.continue();
      return;
    }
    log(`TouchEn JS 차단: ${reqUrl.split('/').pop()}`);
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `// TouchEn bypassed by RPA
var TouchEn = TouchEn || {};
TouchEn.nxKey = { isRunning: true, isInstalled: true, version: "1.0.0" };
var nxKey = { isRunning: true };
var ksToken = "";
function nxkey_check() { return true; }
function TouchEnNxKeyCheck() { return true; }
function TouchEnStart() { return true; }
`,
    });
  });

  // 방법 4: 페이지 로드 전에 devtoolsDetector + TouchEn 전역 객체 무력화
  await page.addInitScript(() => {
    // devtoolsDetector가 로드되기 전에 더미 객체로 선점
    Object.defineProperty(window, 'devtoolsDetector', {
      value: {
        addListener: function() {},
        launch: function() {},
        stop: function() {},
        isOpen: false,
      },
      writable: false,
      configurable: false,
    });

    // TouchEn nxKey 전역 객체 선점
    window.TouchEn = window.TouchEn || {};
    window.TouchEn.nxKey = { isRunning: true, isInstalled: true, version: "1.0.0" };
    window.nxKey = { isRunning: true };

    // TouchEn 설치 체크 함수 오버라이드
    window.nxkey_check = function() { return true; };
    window.TouchEnNxKeyCheck = function() { return true; };
    window.TouchEnStart = function() { return true; };

    // ★ TouchEn이 password 필드를 readonly로 만드는 것을 지속적으로 해제
    // MutationObserver로 DOM 변경 감시 → stkhIdntfNo2 필드가 나타나면 즉시 editable로 전환
    const _touchenObserver = new MutationObserver(() => {
      const pwFields = document.querySelectorAll('#stkhIdntfNo2, input[name="stkhIdntfNo2"], input[type="password"]');
      pwFields.forEach(el => {
        if (el.readOnly || el.disabled) {
          el.readOnly = false;
          el.disabled = false;
          el.removeAttribute('readonly');
          el.removeAttribute('disabled');
        }
      });
    });
    // document가 ready되면 Observer 시작
    if (document.body) {
      _touchenObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['readonly', 'disabled'] });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        _touchenObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['readonly', 'disabled'] });
      });
    }

    // 보안 프로그램 설치 페이지 리다이렉트 방지
    const origAssign = window.location.assign;
    const origReplace = window.location.replace;
    const blockSecurityRedirect = function(url) {
      if (typeof url === 'string' && (url.includes('touchenNx/install') || url.includes('TouchEn') || url.includes('raonsecure'))) {
        console.log('[RPA] 보안 프로그램 리다이렉트 차단:', url);
        return;
      }
      return origAssign ? origAssign.call(window.location, url) : undefined;
    };
    try {
      Object.defineProperty(window.location, 'assign', { value: blockSecurityRedirect, writable: true });
    } catch (e) { /* location.assign은 일부 브라우저에서 변경 불가 */ }
  });

  log('DevTools + TouchEn 보안 우회 설정 완료');
}

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
// Step 1: 이전등록 시작 - 사이트 접속 + 로그인 + 간편인증 요청
// =============================================================================
async function startTransfer(data) {
  const {
    name,           // 양수인(매수인) 이름
    phoneNumber,    // 양수인 전화번호 (010-xxxx-xxxx)
    carrier,        // 통신사
    birthDate,      // 생년월일 YYYYMMDD 8자리 또는 YYMMDD 6자리
    idNumberBack,   // 주민등록번호 뒷자리 7자리 (선택)
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
    const context = stealth.context;

    // ★ 핵심: DevTools 감지 우회 설정 (페이지 로드 전에!)
    await setupDevToolsBypass(page, context, log);

    // 다이얼로그 처리 - 보안 프로그램 설치 다이얼로그는 dismiss
    page.on('dialog', async (dialog) => {
      const msg = dialog.message();
      log(`다이얼로그: ${dialog.type()} - ${msg}`);
      // 보안 프로그램 설치 관련 다이얼로그는 dismiss (설치 페이지 이동 방지)
      if (msg.includes('키보드보안') || msg.includes('보안 프로그램') || msg.includes('라온시큐어') || msg.includes('설치페이지') || msg.includes('TouchEn')) {
        log('보안 프로그램 설치 다이얼로그 dismiss');
        await dialog.dismiss();
      } else {
        await dialog.accept();
      }
    });

    // Step 1: car365.go.kr 메인페이지 접속
    log('자동차365 접속 중...');
    await page.goto(CAR365_URLS.main, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });
    await humanDelay(2000, 3000);

    const mainUrl = page.url();
    log(`메인페이지 URL: ${mainUrl}`);
    const mainTitle = await page.title();
    log(`메인페이지 제목: ${mainTitle}`);

    // about:blank 체크 (DevTools 우회 실패 시)
    if (mainUrl === 'about:blank' || !mainTitle) {
      log('⚠️ DevTools 우회 실패 - about:blank 감지. 재시도...');
      await page.goto(CAR365_URLS.main, {
        waitUntil: 'load',
        timeout: TIMEOUTS.navigation,
      });
      await humanDelay(1500, 2500);
      log(`재시도 후 URL: ${page.url()}`);
    }

    await stealthScreenshot(page, `car365_main_${taskId.slice(0, 8)}`);

    // Step 2: 로그인 페이지 직접 이동 (버튼 클릭 대신 goto로 안정적 이동)
    // 버튼 클릭 시 보안 프로그램 다이얼로그 + SPA 라우팅으로 컨텍스트 파괴 발생
    log('로그인 페이지 직접 이동...');
    await page.goto(CAR365_URLS.login, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });

    // AnyID SPA 페이지 안정화 대기 (KnockoutJS SPA 라우터 초기화)
    await humanDelay(4000, 6000);

    // 네비게이션 완료 대기
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (e) {
      log(`networkidle 대기 타임아웃 (무시): ${e.message}`);
    }

    await stealthScreenshot(page, `car365_login_${taskId.slice(0, 8)}`);

    const loginUrl = page.url();
    log(`로그인 페이지 URL: ${loginUrl}`);

    // Step 3: AnyID 간편인증 페이지 구조 분석 (재시도 포함)
    let loginPageDump = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        loginPageDump = await page.evaluate(() => {
          const body = document.body;
          if (!body) return { error: 'no body' };

          // 모든 버튼, 링크 수집
          const elements = [];
          document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [onclick]').forEach(el => {
            const text = (el.textContent || el.value || '').trim();
            if (text.length > 0 && text.length < 100) {
              elements.push({
                tag: el.tagName,
                id: el.id,
                cls: el.className?.substring(0, 80) || '',
                text: text.substring(0, 60),
                onclick: el.getAttribute('onclick')?.substring(0, 100) || '',
                href: el.href || '',
              });
            }
          });

          // input 필드
          const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(e => ({
            tag: e.tagName, id: e.id, name: e.name, type: e.type || '',
            placeholder: e.placeholder || '', visible: e.offsetParent !== null,
          })).filter(i => i.visible);

          // iframe 확인
          const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
            id: f.id, name: f.name, src: f.src, visible: f.offsetParent !== null,
          }));

          // 팝업/모달 확인
          const modals = Array.from(document.querySelectorAll('[role="dialog"], .modal, .popup, .layer-modal, [class*="layer"]')).map(m => ({
            id: m.id, cls: m.className?.substring(0, 80) || '',
            visible: m.offsetParent !== null,
            text: m.textContent?.trim()?.substring(0, 200) || '',
          })).filter(m => m.visible);

          return {
            title: document.title,
            url: window.location.href,
            bodySnippet: body.innerText?.substring(0, 2000) || '',
            elements: elements.slice(0, 50),
            inputs,
            iframes,
            modals,
          };
        });
        break; // 성공 시 루프 탈출
      } catch (evalError) {
        log(`페이지 분석 시도 ${attempt + 1}/3 실패: ${evalError.message}`);
        if (attempt < 2) {
          await humanDelay(3000, 5000);
          try { await page.waitForLoadState('domcontentloaded', { timeout: 10000 }); } catch (e) { /* ignore */ }
        }
      }
    }

    if (!loginPageDump) {
      loginPageDump = { error: 'evaluate 3회 실패', title: '', inputs: [], iframes: [], modals: [], elements: [], bodySnippet: '' };
    }

    log(`로그인 페이지 제목: ${loginPageDump.title}`);
    log(`입력 필드: ${loginPageDump.inputs?.length || 0}개`);
    log(`iframe: ${loginPageDump.iframes?.length || 0}개`);
    log(`모달: ${loginPageDump.modals?.length || 0}개`);
    log(`버튼/링크: ${loginPageDump.elements?.length || 0}개`);

    // Step 4: 비회원 로그인 + 로그인 영역 HTML 덤프
    let authTriggered = false;
    let authStatus = 'login_page_loaded';

    try {
      // Step 4-1: 로그인 컨텐츠 영역 HTML 직접 덤프 (정확한 구조 파악)
      log('로그인 영역 HTML 덤프...');
      const htmlDump = await page.evaluate(() => {
        // content-section 또는 container 영역의 outerHTML 가져오기
        const contentSection = document.querySelector('#content-section') ||
          document.querySelector('.container') ||
          document.querySelector('[class*="content-wrap"]') ||
          document.querySelector('main') ||
          document.querySelector('#container');

        // AnyID 관련 영역 (tab-area, layer, login 등)
        const loginArea = document.querySelector('.tab-area') ||
          document.querySelector('[class*="tab-content"]') ||
          document.querySelector('[class*="login-content"]');

        return {
          contentSectionHtml: contentSection ? contentSection.outerHTML.substring(0, 5000) : 'NOT FOUND',
          loginAreaHtml: loginArea ? loginArea.outerHTML.substring(0, 5000) : 'NOT FOUND',
          contentSectionTag: contentSection ? `${contentSection.tagName}#${contentSection.id}.${contentSection.className?.toString()?.substring(0, 60)}` : 'N/A',
          loginAreaTag: loginArea ? `${loginArea.tagName}#${loginArea.id}.${loginArea.className?.toString()?.substring(0, 60)}` : 'N/A',
        };
      });

      log(`콘텐츠 영역: ${htmlDump.contentSectionTag}`);
      log(`로그인 영역: ${htmlDump.loginAreaTag}`);
      // HTML 일부 로그 (구조 파악용)
      const loginHtml = htmlDump.loginAreaHtml || htmlDump.contentSectionHtml;
      log(`로그인 HTML (500자): ${loginHtml.substring(0, 500)}`);

      // Step 4-2: "비회원 로그인" 탭 클릭 시도 (phone auth 직접 접근 가능 경로)
      log('"비회원 로그인" 탭(tab_0102) 클릭 시도...');
      const tab0102 = await page.$('#tab_0102');
      if (tab0102 && await tab0102.isVisible()) {
        await tab0102.click();
        log('비회원 로그인 탭 클릭 성공');
        await humanDelay(2000, 3000);

        // 비회원 로그인 탭 내용 분석
        const nonMemberDump = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input, select')).map(e => ({
            tag: e.tagName, id: e.id, name: e.name, type: e.type || '',
            placeholder: e.placeholder || '', visible: e.offsetParent !== null,
          })).filter(i => i.visible);

          const buttons = Array.from(document.querySelectorAll('button, a[class*="btn"]')).map(e => ({
            id: e.id, text: (e.textContent || e.value || '').trim().substring(0, 60),
            cls: e.className?.toString()?.substring(0, 60) || '',
            visible: e.offsetParent !== null,
          })).filter(b => b.visible && b.text);

          return {
            inputs,
            buttons: buttons.slice(0, 20),
            bodySnippet: document.body?.innerText?.substring(0, 3000) || '',
            hash: window.location.hash,
          };
        });

        log(`비회원 로그인 - 입력 필드: ${nonMemberDump.inputs?.length || 0}개`);
        for (const inp of (nonMemberDump.inputs || [])) {
          log(`  [input] id=${inp.id} name=${inp.name} type=${inp.type} placeholder="${inp.placeholder}"`);
        }
        log(`비회원 로그인 - 버튼: ${nonMemberDump.buttons?.length || 0}개`);
        for (const btn of (nonMemberDump.buttons || []).slice(0, 10)) {
          log(`  [btn] id=${btn.id} text="${btn.text}" cls="${btn.cls}"`);
        }
        log(`URL 해시: ${nonMemberDump.hash}`);

        loginPageDump.nonMemberDump = nonMemberDump;
        loginPageDump.htmlDump = { contentSectionTag: htmlDump.contentSectionTag, loginAreaTag: htmlDump.loginAreaTag };

        // Step 4-3: 비회원 로그인 1단계 - 이용약관 모두 동의
        log('1단계: 이용약관 동의 진행...');

        // "모두 동의" 체크박스 클릭
        const allAgreeCheck = await page.$('#chk_01_02');
        if (allAgreeCheck && await allAgreeCheck.isVisible()) {
          await allAgreeCheck.click();
          log('모두 동의 체크박스 클릭');
          await humanDelay(500, 1000);
        } else {
          // 개별 동의 라디오 버튼 클릭 (동의함 = 짝수 번호)
          for (const radioId of ['#radio_02_02', '#radio_02_04', '#radio_02_06', '#radio_02_08']) {
            const radio = await page.$(radioId);
            if (radio && await radio.isVisible()) {
              await radio.click();
              log(`동의 라디오 클릭: ${radioId}`);
              await humanDelay(200, 400);
            }
          }
        }

        await humanDelay(500, 1000);

        // "동의" 버튼 클릭 (다음 단계로)
        const agreeSelectors = [
          'button:has-text("동의")',
          'a:has-text("동의")',
          'button.btn-primary:has-text("동의")',
          '#btnAgree',
          'button[class*="agree"]',
        ];

        let agreedNext = false;
        for (const sel of agreeSelectors) {
          try {
            const btns = await page.$$(sel);
            for (const btn of btns) {
              if (await btn.isVisible()) {
                const btnText = await btn.textContent();
                // "동의안함"은 제외, "동의"만 클릭
                if (btnText && btnText.trim() === '동의') {
                  await btn.click();
                  agreedNext = true;
                  log(`동의 버튼 클릭: ${sel} - "${btnText.trim()}"`);
                  break;
                }
              }
            }
            if (agreedNext) break;
          } catch (e) { /* continue */ }
        }

        if (!agreedNext) {
          // 폴백: 페이지 하단의 "다음" 또는 "동의" 버튼 찾기
          const nextBtn = await page.$('button:has-text("다음")') || await page.$('a:has-text("다음")');
          if (nextBtn && await nextBtn.isVisible()) {
            await nextBtn.click();
            agreedNext = true;
            log('다음 버튼 클릭');
          }
        }

        if (agreedNext) {
          await humanDelay(2000, 3000);
          await stealthScreenshot(page, `car365_step2_${taskId.slice(0, 8)}`);

          // Step 4-4: 2단계 실명확인 페이지 분석
          log('2단계: 실명확인 페이지...');
          const step2Dump = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input, select')).map(e => ({
              tag: e.tagName, id: e.id, name: e.name, type: e.type || '',
              placeholder: e.placeholder || '', visible: e.offsetParent !== null,
              label: e.closest('tr,div,label,li,dd')?.querySelector('th,label,span,dt')?.textContent?.trim()?.substring(0, 40) || '',
            })).filter(i => i.visible);

            const buttons = Array.from(document.querySelectorAll('button, a[class*="btn"], input[type="submit"]')).map(e => ({
              id: e.id, text: (e.textContent || e.value || '').trim().substring(0, 60),
              cls: e.className?.toString()?.substring(0, 60) || '',
              visible: e.offsetParent !== null,
            })).filter(b => b.visible && b.text);

            return {
              inputs,
              buttons: buttons.slice(0, 20),
              bodySnippet: document.body?.innerText?.substring(0, 2000) || '',
              hash: window.location.hash,
            };
          });

          log(`2단계 입력 필드: ${step2Dump.inputs?.length || 0}개`);
          for (const inp of (step2Dump.inputs || [])) {
            log(`  [input] id=${inp.id} name=${inp.name} type=${inp.type} label="${inp.label}" placeholder="${inp.placeholder}"`);
          }
          log(`2단계 버튼: ${step2Dump.buttons?.length || 0}개`);
          for (const btn of (step2Dump.buttons || []).slice(0, 10)) {
            log(`  [btn] id=${btn.id} text="${btn.text}"`);
          }

          loginPageDump.step2Dump = step2Dump;
          authStatus = 'step2_loaded';

          // Step 4-5: 2단계 실명확인 정보 입력 (이름 + 주민번호)
          if (step2Dump.inputs?.length > 0) {
            log('실명확인 정보 입력 시도...');

            // 이름 입력 (name=mbrNm)
            try {
              const nameEl = await page.$('input[name="mbrNm"]');
              if (nameEl && await nameEl.isVisible()) {
                await nameEl.fill('');
                await nameEl.type(name, { delay: 80 });
                log(`이름 입력 성공: mbrNm = ${name}`);
              }
            } catch (e) { log(`이름 입력 실패: ${e.message}`); }

            // 주민등록번호 앞자리 (YYMMDD 6자리) 입력 (name=stkhIdntfNo1)
            const birthDateStr = birthDate?.length === 8 ? birthDate.substring(2) : birthDate; // YYYYMMDD → YYMMDD
            if (birthDateStr) {
              try {
                const ssnFrontEl = await page.$('input[name="stkhIdntfNo1"]');
                if (ssnFrontEl && await ssnFrontEl.isVisible()) {
                  await ssnFrontEl.fill('');
                  await ssnFrontEl.type(birthDateStr, { delay: 80 });
                  log(`주민번호 앞자리 입력 성공: stkhIdntfNo1 = ${birthDateStr}`);
                }
              } catch (e) { log(`주민번호 앞자리 입력 실패: ${e.message}`); }
            }

            // ★ 핵심: KnockoutJS data-bind="textInput: model.stkhIdntfNo2"
            // → vm.model 서브모델에 직접 값 설정 + DOM 직접 설정 + checkRlnmCert 분석
            let koModelResult = null;
            if (idNumberBack) {
              try {
                const birthDateStr6 = birthDate?.length === 8 ? birthDate.substring(2) : birthDate;

                // Phase 1: checkRlnmCert 소스코드 분석 + KO model 설정 (checkRlnmCert 호출 안함)
                koModelResult = await page.evaluate(({ nameVal, ssnFront, ssnBack }) => {
                  const results = { success: false, setFields: {} };

                  if (typeof ko === 'undefined') return { ...results, error: 'ko undefined' };

                  // Root VM 가져오기
                  const rootEl = document.querySelector('.tab-area') || document.querySelector('#content-section');
                  let vm = null;
                  try {
                    const ctx = ko.contextFor(rootEl);
                    vm = ctx?.$root;
                  } catch (e) {}
                  if (!vm) return { ...results, error: 'root VM not found' };

                  // ★ model 서브모델에 접근
                  let model = null;
                  if (vm.model) {
                    model = ko.isObservable(vm.model) ? vm.model() : vm.model;
                  }
                  if (!model) return { ...results, error: 'vm.model not found' };

                  // ★ checkRlnmCert 소스코드 분석 (어디서 값을 읽는지 파악)
                  if (typeof vm.checkRlnmCert === 'function') {
                    results.checkRlnmCertSource = vm.checkRlnmCert.toString().substring(0, 1500);
                  }

                  // model의 키 목록 (설정 전 상태)
                  const modelKeys = [];
                  for (const k of Object.keys(model)) {
                    if (ko.isObservable(model[k])) {
                      const v = model[k]();
                      modelKeys.push(k + '=' + (v !== null && v !== undefined ? String(v).substring(0, 15) : 'null'));
                    }
                  }
                  results.modelKeys = modelKeys;

                  // ★ model에 값 설정 (stkhIdntfNoTypeCd는 기존값 유지!)
                  const setField = (key, val) => {
                    if (model[key] && ko.isObservable(model[key])) {
                      model[key](val);
                      results.setFields[key] = { set: true, verify: model[key]() ? 'OK' : 'EMPTY' };
                      return true;
                    }
                    results.setFields[key] = { set: false, exists: !!model[key] };
                    return false;
                  };

                  setField('mbrNm', nameVal);
                  setField('stkhIdntfNo1', ssnFront);
                  setField('stkhIdntfNo2', ssnBack);
                  // stkhIdntfNoTypeCd는 기존값 '11' (내국인) 유지 - 덮어쓰지 않음

                  // ★ DOM 요소에도 직접 값 설정 + 이벤트 디스패치
                  const pwInput = document.querySelector('#stkhIdntfNo2') || document.querySelector('input[name="stkhIdntfNo2"]');
                  if (pwInput) {
                    // nativeInputValueSetter로 React/KO 바인딩 우회하여 DOM 값 설정
                    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
                    if (nativeSetter) {
                      nativeSetter.call(pwInput, ssnBack);
                    } else {
                      pwInput.value = ssnBack;
                    }
                    // 이벤트 디스패치 (KO textInput 바인딩이 DOM 변경을 감지하도록)
                    pwInput.dispatchEvent(new Event('input', { bubbles: true }));
                    pwInput.dispatchEvent(new Event('change', { bubbles: true }));
                    pwInput.dispatchEvent(new Event('keyup', { bubbles: true }));
                    results.domValueSet = true;
                    results.domValue = pwInput.value ? pwInput.value.length + '자리' : 'EMPTY';
                  }

                  // 설정 후 model 값 재확인
                  const afterKeys = [];
                  for (const k of ['mbrNm', 'stkhIdntfNo1', 'stkhIdntfNo2', 'stkhIdntfNoTypeCd']) {
                    if (model[k] && ko.isObservable(model[k])) {
                      const v = model[k]();
                      afterKeys.push(k + '=' + (v !== null && v !== undefined ? String(v).substring(0, 15) : 'null'));
                    }
                  }
                  results.afterModelKeys = afterKeys;

                  results.success = true;
                  return results;
                }, { nameVal: name, ssnFront: birthDateStr6, ssnBack: idNumberBack });

                log(`KO model 설정: success=${koModelResult.success}`);
                if (koModelResult.modelKeys) log(`model 키 (설정전): ${koModelResult.modelKeys.join(', ')}`);
                if (koModelResult.afterModelKeys) log(`model 키 (설정후): ${koModelResult.afterModelKeys.join(', ')}`);
                for (const [key, val] of Object.entries(koModelResult.setFields || {})) {
                  log(`  model.${key}: set=${val.set}, verify=${val.verify || 'N/A'}`);
                }
                if (koModelResult.domValueSet) log(`DOM 직접 설정: ${koModelResult.domValue}`);
                if (koModelResult.checkRlnmCertSource) {
                  log(`checkRlnmCert 소스 (500자): ${koModelResult.checkRlnmCertSource.substring(0, 500)}`);
                }
                if (koModelResult.error) log(`오류: ${koModelResult.error}`);

                // Phase 2: AJAX 요청 가로채기 설정 후 checkRlnmCert 호출
                log('AJAX 가로채기 설정 + checkRlnmCert 호출...');

                // XHR/fetch 가로채기로 실제 전송 데이터 확인
                const ajaxResult = await page.evaluate(() => {
                  return new Promise((resolve) => {
                    const captured = { requests: [] };

                    // XMLHttpRequest 가로채기
                    const origOpen = XMLHttpRequest.prototype.open;
                    const origSend = XMLHttpRequest.prototype.send;
                    XMLHttpRequest.prototype.open = function(method, url) {
                      this._rpaUrl = url;
                      this._rpaMethod = method;
                      return origOpen.apply(this, arguments);
                    };
                    XMLHttpRequest.prototype.send = function(body) {
                      captured.requests.push({
                        type: 'xhr',
                        method: this._rpaMethod,
                        url: this._rpaUrl,
                        body: typeof body === 'string' ? body.substring(0, 500) : (body ? 'non-string' : 'null'),
                      });
                      return origSend.apply(this, arguments);
                    };

                    // checkRlnmCert 호출
                    const rootEl = document.querySelector('.tab-area') || document.querySelector('#content-section');
                    let vm = null;
                    try {
                      const ctx = ko.contextFor(rootEl);
                      vm = ctx?.$root;
                    } catch (e) {}

                    if (vm && typeof vm.checkRlnmCert === 'function') {
                      try {
                        vm.checkRlnmCert();
                        captured.checkCalled = true;
                      } catch (e) {
                        captured.checkError = e.message;
                      }
                    }

                    // 200ms 대기 후 캡처된 요청 반환
                    setTimeout(() => {
                      // 원복
                      XMLHttpRequest.prototype.open = origOpen;
                      XMLHttpRequest.prototype.send = origSend;
                      resolve(captured);
                    }, 500);
                  });
                });

                log(`checkRlnmCert 호출: ${ajaxResult.checkCalled ? '성공' : '실패'}`);
                if (ajaxResult.checkError) log(`checkRlnmCert 에러: ${ajaxResult.checkError}`);
                log(`가로챈 AJAX 요청: ${ajaxResult.requests?.length || 0}건`);
                for (const req of (ajaxResult.requests || [])) {
                  log(`  [${req.type}] ${req.method} ${req.url}`);
                  if (req.body && req.body !== 'null') log(`    body: ${req.body}`);
                }

              } catch (e) { log(`주민번호 뒷자리 입력 실패: ${e.message}`); }
            } else {
              log('⚠️ 주민번호 뒷자리(idNumberBack) 미제공 - 실명인증 불가능');
              authStatus = 'need_id_number_back';
            }

            await humanDelay(500, 1000);
            await stealthScreenshot(page, `car365_step2_filled_${taskId.slice(0, 8)}`);

            // checkRlnmCert가 이미 KO에서 호출됨 → 결과 대기
            // (폴백: 버튼 클릭)
            if (!idNumberBack || !koModelResult?.checkCalled) {
              log('checkRlnmCert 미호출, 실명인증 버튼 클릭 시도...');
              const step2NextSelectors = [
                'button:has-text("실명인증")',
                'a:has-text("실명인증")',
                'button:has-text("다음")',
                'a:has-text("다음")',
              ];
              for (const sel of step2NextSelectors) {
                try {
                  const btns = await page.$$(sel);
                  for (const btn of btns) {
                    if (await btn.isVisible()) {
                      const txt = (await btn.textContent())?.trim();
                      if (txt === '실명인증' || txt === '다음') {
                        await btn.click();
                        log(`2단계 버튼 클릭: ${sel} - "${txt}"`);
                        break;
                      }
                    }
                  }
                } catch (e) { /* continue */ }
              }
            }

            // 실명인증 결과 대기 (AJAX 호출 완료 대기)
            await humanDelay(3000, 5000);
            await stealthScreenshot(page, `car365_step2_result_${taskId.slice(0, 8)}`);

              // 실명인증 결과 확인 - 에러 모달 감지
              const step2Result = await page.evaluate(() => {
                const bodyText = document.body?.innerText || '';
                // 에러 모달 감지 (_btn_error_modify 버튼 존재 여부)
                const errorModal = document.querySelector('#_btn_error_modify');
                const hasError = errorModal && errorModal.offsetParent !== null;
                // 3단계(본인인증) 진입 여부 - "본인인증" step이 current인지
                const stepText = bodyText.match(/현재스텝\s*(\d)단계/) || bodyText.match(/(\d)단계\s*\/\s*3단계/);
                const currentStep = stepText ? parseInt(stepText[1]) : 0;
                // 에러 메시지 추출
                const errorMsg = bodyText.match(/(주의[^\n]*)/g) || [];
                return {
                  hasError,
                  currentStep,
                  errorMessages: errorMsg,
                  hasPhoneInput: !!document.querySelector('input[name*="tel"], input[name*="phone"], input[name*="hp"], input[type="tel"]'),
                  bodySnippet: bodyText.substring(0, 500),
                };
              });

              log(`실명인증 결과: 에러=${step2Result.hasError}, 현재단계=${step2Result.currentStep}`);
              if (step2Result.errorMessages?.length > 0) {
                log(`에러 메시지: ${step2Result.errorMessages.join(', ')}`);
              }

              if (step2Result.hasError) {
                // 에러 모달 닫기
                const closeBtn = await page.$('#_btn_error_modify') || await page.$('.close-layer');
                if (closeBtn) {
                  await closeBtn.click();
                  log('에러 모달 닫기 버튼 클릭');
                  await humanDelay(500, 1000);
                }
                authStatus = 'identity_verification_failed';
                log('⚠️ 실명인증 실패 - 주민번호 검증 에러');
              }

              // Step 4-6: 3단계 본인인증 페이지 분석 + 인증요청
              log('3단계: 본인인증 페이지...');
              const step3Dump = await page.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll('input, select')).map(e => ({
                  tag: e.tagName, id: e.id, name: e.name, type: e.type || '',
                  placeholder: e.placeholder || '', visible: e.offsetParent !== null,
                  label: e.closest('tr,div,label,li,dd')?.querySelector('th,label,span,dt')?.textContent?.trim()?.substring(0, 40) || '',
                })).filter(i => i.visible);

                const buttons = Array.from(document.querySelectorAll('button, a[class*="btn"], input[type="submit"]')).map(e => ({
                  id: e.id, text: (e.textContent || e.value || '').trim().substring(0, 60),
                  cls: e.className?.toString()?.substring(0, 60) || '',
                  visible: e.offsetParent !== null,
                })).filter(b => b.visible && b.text);

                return {
                  inputs,
                  buttons: buttons.slice(0, 20),
                  bodySnippet: document.body?.innerText?.substring(0, 2000) || '',
                  hash: window.location.hash,
                };
              });

              log(`3단계 입력 필드: ${step3Dump.inputs?.length || 0}개`);
              for (const inp of (step3Dump.inputs || [])) {
                log(`  [input] id=${inp.id} name=${inp.name} type=${inp.type} label="${inp.label}" placeholder="${inp.placeholder}"`);
              }
              log(`3단계 버튼: ${step3Dump.buttons?.length || 0}개`);
              for (const btn of (step3Dump.buttons || []).slice(0, 10)) {
                log(`  [btn] id=${btn.id} text="${btn.text}"`);
              }

              loginPageDump.step3Dump = step3Dump;
              authStatus = 'step3_loaded';

              // 통신사 선택
              if (carrier) {
                const selectEls = await page.$$('select');
                for (const sel of selectEls) {
                  if (await sel.isVisible()) {
                    const options = await sel.evaluate(el => {
                      return Array.from(el.options).map(o => ({ value: o.value, text: o.textContent?.trim() }));
                    });
                    const carrierMap = {
                      'SK': ['SKT', 'SK텔레콤', 'SK', '01'],
                      'KT': ['KT', 'KT', '02'],
                      'LG': ['LG', 'LGU+', 'LG유플러스', '03'],
                    };
                    const aliases = carrierMap[carrier.toUpperCase()] || [carrier];
                    const match = options.find(o => aliases.some(a => o.text?.includes(a) || o.value === a));
                    if (match) {
                      await sel.selectOption(match.value);
                      log(`통신사 선택 성공: ${carrier} → ${match.text} (${match.value})`);
                      break;
                    }
                  }
                }
              }

              // 전화번호 입력
              if (phoneNumber) {
                const phoneClean = phoneNumber.replace(/-/g, '');
                const phoneInputSel = step3Dump.inputs.find(inp =>
                  inp.name?.includes('tel') || inp.name?.includes('phone') || inp.name?.includes('hp') ||
                  inp.id?.includes('tel') || inp.id?.includes('phone') || inp.id?.includes('hp') ||
                  inp.label?.includes('전화') || inp.label?.includes('휴대폰') || inp.label?.includes('연락처') ||
                  inp.placeholder?.includes('전화') || inp.placeholder?.includes('휴대') ||
                  inp.type === 'tel'
                );
                if (phoneInputSel) {
                  try {
                    const el = phoneInputSel.id
                      ? await page.$(`#${phoneInputSel.id}`)
                      : await page.$(`input[name="${phoneInputSel.name}"]`);
                    if (el && await el.isVisible()) {
                      await el.fill('');
                      await el.type(phoneClean, { delay: 60 });
                      log(`전화번호 입력 성공: #${phoneInputSel.id || phoneInputSel.name}`);
                    }
                  } catch (e) { log(`전화번호 입력 실패: ${e.message}`); }
                }
              }

              await humanDelay(1000, 2000);
              await stealthScreenshot(page, `car365_auth_filled_${taskId.slice(0, 8)}`);

              // 인증번호 요청 버튼 클릭
              const authRequestSelectors = [
                'button:has-text("인증번호 요청")',
                'button:has-text("인증번호요청")',
                'button:has-text("인증요청")',
                'button:has-text("인증 요청")',
                'button:has-text("인증번호")',
                'button:has-text("본인인증")',
                'a:has-text("인증번호")',
                'a:has-text("인증요청")',
                'input[type="button"][value*="인증"]',
              ];

              let authRequested = false;
              for (const sel of authRequestSelectors) {
                try {
                  const btns = await page.$$(sel);
                  for (const btn of btns) {
                    if (await btn.isVisible()) {
                      await btn.click();
                      authRequested = true;
                      log(`인증번호 요청 버튼 클릭: ${sel}`);
                      break;
                    }
                  }
                  if (authRequested) break;
                } catch (e) { /* continue */ }
              }

              if (authRequested) {
                authTriggered = true;
                authStatus = 'auth_requested';
                await humanDelay(2000, 3000);
                await stealthScreenshot(page, `car365_auth_requested_${taskId.slice(0, 8)}`);
              } else {
                log('인증번호 요청 버튼을 찾지 못함');
                authStatus = 'step3_form_loaded';
              }
            } else {
              log('2단계 다음 버튼을 찾지 못함');
              authStatus = 'step2_next_failed';
            }
        } else {
          log('동의 버튼을 찾지 못함');
          authStatus = 'agreement_failed';
        }
      } else {
        log('비회원 로그인 탭(tab_0102) 없음');
        loginPageDump.htmlDump = htmlDump;
      }

      await stealthScreenshot(page, `car365_auth_${taskId.slice(0, 8)}`);
    } catch (authError) {
      log(`인증 진행 중 오류: ${authError.message}`);
    }

    // 세션 저장 (브라우저 세션 유지 - 인증번호 입력/확인용)
    saveSession(taskId, {
      browser,
      page,
      context,
      transferData: data,
      authTriggered,
    });

    return {
      success: true,
      taskId,
      status: authStatus,
      message: authTriggered
        ? '휴대폰 본인인증 요청이 발송되었습니다. 인증번호를 확인해 주세요.'
        : authStatus === 'auth_form_loaded'
          ? '인증 폼이 로드되었습니다. 폼 구조를 확인해 주세요.'
          : '자동차365 로그인 페이지가 로드되었습니다.',
      pageDump: loginPageDump,
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
    log('세션 복원됨, 로그인 상태 확인 중...');

    await stealthScreenshot(page, `car365_confirm_start_${taskId.slice(0, 8)}`);
    const currentUrl = page.url();
    log(`현재 URL: ${currentUrl}`);

    // 로그인 상태 확인
    const loginState = await page.evaluate(() => {
      const bodyText = document.body?.innerText || '';
      const hasLogout = bodyText.includes('로그아웃') || !!document.querySelector('[onclick*="logout"]');
      const hasLogin = !!document.querySelector('.h-btn-login');
      return {
        isLoggedIn: hasLogout,
        hasLogoutBtn: hasLogout,
        hasLoginBtn: hasLogin,
        bodySnippet: bodyText.substring(0, 500),
      };
    });

    log(`로그인 상태: ${loginState.isLoggedIn ? '로그인됨' : '미로그인'}`);

    if (!loginState.isLoggedIn) {
      log('로그인되지 않음. 인증이 완료되지 않았을 수 있습니다.');
      await cleanupSession(taskId);
      return {
        success: false,
        error: '로그인되지 않았습니다. 간편인증을 다시 시도해 주세요.',
        logs,
      };
    }

    // 이전등록 페이지로 이동
    log('이전등록 페이지로 이동 중...');
    await page.goto(CAR365_URLS.transfer, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });
    await humanDelay(3000, 5000);

    await stealthScreenshot(page, `car365_transfer_page_${taskId.slice(0, 8)}`);
    log(`이전등록 페이지 URL: ${page.url()}`);

    // 이전등록 페이지 구조 분석
    const transferDump = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(e => ({
        tag: e.tagName, id: e.id, name: e.name, type: e.type || '',
        placeholder: e.placeholder || '', visible: e.offsetParent !== null,
        label: e.closest('tr,div,label')?.querySelector('th,label')?.textContent?.trim()?.substring(0, 40) || '',
      })).filter(i => i.visible);

      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]')).map(e => ({
        id: e.id, text: (e.textContent || e.value || '').trim().substring(0, 60),
        cls: e.className?.substring(0, 80) || '',
        visible: e.offsetParent !== null,
      })).filter(b => b.visible && b.text);

      return {
        title: document.title,
        url: window.location.href,
        inputs,
        buttons,
        bodySnippet: document.body?.innerText?.substring(0, 2000) || '',
      };
    });

    log(`이전등록 페이지 입력 필드: ${transferDump.inputs?.length || 0}개`);
    log(`이전등록 페이지 버튼: ${transferDump.buttons?.length || 0}개`);

    // 이전등록 폼 입력
    if (transferData && transferDump.inputs?.length > 3) {
      log('이전등록 정보 입력 시작...');
      await fillTransferForm(page, transferData, log);
    } else {
      log('이전등록 폼 필드가 부족합니다. 페이지 구조를 확인하세요.');
    }

    await stealthScreenshot(page, `car365_form_filled_${taskId.slice(0, 8)}`);

    // 신청 버튼 클릭
    const autoSubmit = data.autoSubmit !== false;
    if (autoSubmit) {
      log('신청 버튼 클릭 시도...');
      const submitResult = await clickSubmitButton(page, log);
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
      if (result.receiptNumber) log(`접수번호: ${result.receiptNumber}`);

      await cleanupSession(taskId);

      return {
        success: true,
        taskId,
        status: 'submitted',
        receiptNumber: result.receiptNumber,
        message: result.receiptNumber
          ? `이전등록 신청이 완료되었습니다. 접수번호: ${result.receiptNumber}`
          : '이전등록 신청이 제출되었습니다. 결과를 확인해 주세요.',
        pageDump: transferDump,
        logs,
      };
    } else {
      return {
        success: true,
        taskId,
        status: 'preview',
        message: '폼 입력이 완료되었습니다. 직접 확인 후 제출해 주세요.',
        pageDump: transferDump,
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

  const fieldMappings = [
    { selectors: ['input[name*="seller" i]', 'input[name*="trnsfr" i]', 'input[id*="sellerNm" i]', 'input[placeholder*="양도인"]'], value: sellerName, label: '양도인 성명' },
    { selectors: ['input[name*="sellerPhone" i]', 'input[name*="trnsfrTelno" i]', 'input[id*="sellerPhone" i]'], value: sellerPhone?.replace(/-/g, ''), label: '양도인 전화번호' },
    { selectors: ['input[name*="buyer" i]', 'input[name*="acquir" i]', 'input[id*="buyerNm" i]', 'input[placeholder*="양수인"]'], value: buyerName, label: '양수인 성명' },
    { selectors: ['input[name*="buyerPhone" i]', 'input[name*="acquirTelno" i]', 'input[id*="buyerPhone" i]'], value: buyerPhone?.replace(/-/g, ''), label: '양수인 전화번호' },
    { selectors: ['input[name*="buyerAddr" i]', 'input[name*="acquirAddr" i]', 'input[placeholder*="주소"]'], value: buyerAddress, label: '양수인 주소' },
    { selectors: ['input[name*="vhcle" i]', 'input[name*="carNm" i]', 'input[id*="vhcleNm" i]', 'input[placeholder*="차명"]'], value: vehicleName, label: '차량명' },
    { selectors: ['input[name*="plate" i]', 'input[name*="vhcleNo" i]', 'input[id*="plateNo" i]', 'input[placeholder*="차량번호"]'], value: plateNumber, label: '차량번호' },
    { selectors: ['input[name*="year" i]', 'input[name*="mdlYear" i]'], value: modelYear?.toString(), label: '연식' },
    { selectors: ['input[name*="mileage" i]', 'input[name*="drvDstanc" i]', 'input[placeholder*="주행"]'], value: mileage?.toString(), label: '주행거리' },
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
    const context = stealth.context;

    // ★ DevTools 감지 우회 설정
    await setupDevToolsBypass(page, context, log);

    page.on('dialog', async (dialog) => {
      const msg = dialog.message();
      log(`다이얼로그: ${msg}`);
      if (msg.includes('키보드보안') || msg.includes('보안 프로그램') || msg.includes('라온시큐어') || msg.includes('설치페이지') || msg.includes('TouchEn')) {
        await dialog.dismiss();
      } else {
        await dialog.accept();
      }
    });

    const targetUrl = url || CAR365_URLS.main;
    log(`접속 중: ${targetUrl}`);

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });
    await humanDelay(3000, 5000);

    const finalUrl = page.url();
    log(`최종 URL: ${finalUrl}`);
    log(`제목: ${await page.title()}`);

    // about:blank 체크
    if (finalUrl === 'about:blank') {
      log('⚠️ about:blank 감지! DevTools 우회 실패');
      await browser.close();
      return { success: false, error: 'DevTools 감지 우회 실패: about:blank', logs };
    }

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
  cleanupSession,
};
