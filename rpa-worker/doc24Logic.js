/**
 * =============================================================================
 * 문서24 자동접수 Bot (Phase 27)
 * =============================================================================
 * docu.gdoc.go.kr 전자문서 자동 발송
 *
 * [핵심 URL]
 * - 로그인: https://docu.gdoc.go.kr/cmm/main/loginForm.do
 * - 문서작성: https://docu.gdoc.go.kr/doc/wte/docWriteForm.do
 * - 보낸문서함: https://docu.gdoc.go.kr/doc/snd/sendDocList.do
 *
 * [로그인 폼]
 * - Form ID: #loginDataForm
 * - ID: #id, PW: #password
 * - 로그인 버튼: #loginBtn
 * - 개인 탭: .lm_type1 첫번째 a
 * - 약관동의: #allAgreAt
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  launchStealthBrowser,
  humanDelay,
  saveScreenshot: stealthScreenshot,
} = require('./src/stealthBrowser');

const TIMEOUTS = {
  navigation: 30000,
  element: 10000,
  pdfConversion: 15000, // 문서24 PDF 변환 ~5-6초
};

async function saveScreenshot(page, prefix = 'doc24') {
  return stealthScreenshot(page, prefix);
}

/**
 * jconfirm 팝업(doc24_alert 등) 자동 닫기
 * 문서24는 다양한 단계에서 jconfirm 경고 팝업을 띄움
 * 모든 주요 동작 전에 호출하여 팝업을 해제
 */
async function dismissJconfirmAlerts(page, log) {
  const dismissed = await page.evaluate(() => {
    const alerts = document.querySelectorAll('.jconfirm.jconfirm-open');
    let count = 0;
    alerts.forEach(alert => {
      // 팝업 내부의 버튼 찾기 (확인, 예, 닫기 등)
      const btns = alert.querySelectorAll('.jconfirm-buttons button, .jconfirm-closeIcon');
      for (const btn of btns) {
        btn.click();
        count++;
        break; // 첫 번째 버튼만 클릭
      }
      // 버튼이 없으면 팝업 자체를 강제 닫기
      if (btns.length === 0) {
        alert.style.display = 'none';
        alert.remove();
        count++;
      }
    });
    return count;
  }).catch(() => 0);

  if (dismissed > 0) {
    if (log) log('alert', `jconfirm 팝업 ${dismissed}개 닫음`);
    await humanDelay(500, 800);
  }
  return dismissed;
}

/**
 * 문서24 로그인
 */
async function loginToDoc24(page, loginId, password, log, accountType = 'personal') {
  log('login', `문서24 로그인 시작 - ID: ${loginId}, accountType: ${accountType}, PW길이: ${password?.length || 0}`);

  // 로그인 페이지 이동
  await page.goto('https://docu.gdoc.go.kr/cmm/main/loginForm.do', {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUTS.navigation,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await humanDelay(800, 1200);
  await saveScreenshot(page, 'doc24_01_login_page');

  // 계정 유형에 따른 탭 선택
  if (accountType === 'corp_rep' || accountType === 'corp_admin' || accountType === 'corp_member') {
    // 법인/단체 탭 클릭
    const corpTab = page.locator('#entrprsHref, a[href="#entrprs"]').first();
    if (await corpTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await corpTab.click();
      log('login', '법인/단체사용자 탭 선택');
      await humanDelay(500, 800);

      // mberSe를 C로 설정 (법인)
      await page.evaluate(() => {
        const mberSe = document.getElementById('mberSe');
        if (mberSe) mberSe.value = 'C';
      });

      // 법인 내 역할 구분 (CR: 대표, CA: 업무관리자, CC: 부서사용자)
      // 법인 내 역할 매핑: corp_rep→CR, corp_admin→CA, corp_member→CC
      const roleMap = { corp_rep: 'CR', corp_admin: 'CA', corp_member: 'CC' };
      const roleLabel = { corp_rep: '대표사용자', corp_admin: '업무관리자', corp_member: '부서사용자' };
      const roleCode = roleMap[accountType] || 'CR';

      // 라디오 버튼 클릭 시도
      const roleRadio = page.locator(`input[value="${roleCode}"]`).first();
      if (await roleRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
        await roleRadio.check();
        log('login', `${roleLabel[accountType]} 라디오 선택 (${roleCode})`);
      } else {
        // 직접 값 설정
        await page.evaluate((code) => {
          const el = document.getElementById('mberSeEntrprs');
          if (el) el.value = code;
          const radios = document.querySelectorAll('input[name="mberSeEntrprs"]');
          radios.forEach(r => { if (r.value === code) r.checked = true; });
        }, roleCode);
        log('login', `${roleLabel[accountType]} 값 직접 설정 (${roleCode})`);
      }
      await humanDelay(300, 500);
    } else {
      log('login', '법인/단체 탭을 찾을 수 없음, 기본 탭으로 진행', 'warn');
    }
  } else {
    // 개인 탭 클릭
    const personalTab = page.locator('#gnrlHref, a[href="#gnrl"]').first();
    if (await personalTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await personalTab.click();
      log('login', '개인사용자 탭 선택');
      await humanDelay(300, 500);
    }
  }

  await saveScreenshot(page, 'doc24_01b_tab_selected');

  // ID 입력
  const idInput = page.locator('#id');
  if (await idInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await idInput.click();
    await humanDelay(200, 400);
    await idInput.fill(loginId);
    log('login', 'ID 입력 완료');
  } else {
    log('login', '#id 필드를 찾을 수 없음', 'error');
    return { success: false, error: '로그인 폼을 찾을 수 없습니다.' };
  }

  // 비밀번호 입력
  const pwInput = page.locator('#password');
  if (await pwInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pwInput.click();
    await humanDelay(200, 400);
    await pwInput.fill(password);
    log('login', '비밀번호 입력 완료');
  } else {
    log('login', '#password 필드를 찾을 수 없음', 'error');
    return { success: false, error: '비밀번호 필드를 찾을 수 없습니다.' };
  }

  await humanDelay(300, 600);
  await saveScreenshot(page, 'doc24_02_login_filled');

  // 약관 동의 처리 (첫 로그인 시 표시될 수 있음)
  const allAgree = page.locator('#allAgreAt');
  if (await allAgree.isVisible({ timeout: 1000 }).catch(() => false)) {
    const isChecked = await allAgree.isChecked().catch(() => false);
    if (!isChecked) {
      await allAgree.check();
      log('login', '약관 전체 동의 체크');
      await humanDelay(300, 500);
    }
    const termSave = page.locator('#termSave');
    if (await termSave.isVisible({ timeout: 1000 }).catch(() => false)) {
      await termSave.click();
      log('login', '약관 동의 저장');
      await humanDelay(1000, 2000);
    }
  }

  // dialog(alert) 메시지 캡처
  let dialogMsg = '';
  page.on('dialog', async (dialog) => {
    dialogMsg = dialog.message();
    log('login', `Dialog 감지: "${dialogMsg}"`);
    await dialog.accept().catch(() => {});
  });

  // 로그인 버튼 클릭
  const loginBtn = page.locator('#loginBtn');
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginBtn.click();
    log('login', '로그인 버튼 클릭');
  } else {
    // fallback
    await page.keyboard.press('Enter');
    log('login', 'Enter 키로 로그인 시도');
  }

  // 로그인 결과 대기
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await humanDelay(1000, 1500);

  // dialog 메시지가 있으면 에러 반환
  if (dialogMsg) {
    log('login', `로그인 실패 (alert): ${dialogMsg}`, 'error');
    return { success: false, error: `문서24: ${dialogMsg}` };
  }

  // 중복 세션 확인 팝업 처리 (jconfirm)
  const confirmBtn = page.locator('.jconfirm-buttons button').first();
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const btnText = await confirmBtn.textContent().catch(() => '');
    log('login', `중복 세션 팝업 확인: "${btnText.trim()}"`);
    await confirmBtn.click();
    await humanDelay(1500, 2500);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  await saveScreenshot(page, 'doc24_03_after_login');

  // 로그인 성공 확인
  const currentUrl = page.url();
  const pageContent = await page.textContent('body').catch(() => '');

  const isLoggedIn = (
    !currentUrl.includes('loginForm') &&
    !currentUrl.includes('login.do') &&
    (pageContent.includes('로그아웃') ||
     pageContent.includes('문서 보내기') ||
     pageContent.includes('보낸문서함') ||
     pageContent.includes('받은문서함') ||
     currentUrl.includes('index.do'))
  );

  // 에러 메시지 체크
  const errorMsg = await page.locator('.err_msg, .alert-danger, .error_message').first()
    .textContent().catch(() => '');
  if (errorMsg && errorMsg.trim()) {
    log('login', `로그인 에러: ${errorMsg.trim()}`, 'error');
    return { success: false, error: `문서24 로그인 실패: ${errorMsg.trim()}` };
  }

  if (!isLoggedIn) {
    log('login', `로그인 실패 - URL: ${currentUrl}`, 'error');
    return {
      success: false,
      error: '문서24 로그인에 실패했습니다. ID/비밀번호를 확인해주세요.',
    };
  }

  log('login', '로그인 성공');
  return { success: true };
}

/**
 * 문서 작성 페이지로 이동
 */
async function navigateToCompose(page, log) {
  log('compose', '문서작성 페이지 이동');

  // 직접 URL 이동
  await page.goto('https://docu.gdoc.go.kr/doc/wte/docWriteForm.do', {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUTS.navigation,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await humanDelay(800, 1200);

  const currentUrl = page.url();
  log('compose', `현재 URL: ${currentUrl}`);

  // 로그인 페이지로 리디렉트되었는지 확인
  if (currentUrl.includes('loginForm')) {
    log('compose', '세션 만료 - 로그인 페이지로 리디렉트됨', 'error');
    return { success: false, error: '세션이 만료되었습니다. 다시 로그인해주세요.' };
  }

  await saveScreenshot(page, 'doc24_04_compose_page');

  // jconfirm 팝업 닫기 (먼저 처리)
  await dismissJconfirmAlerts(page, log);

  // 발송 안내사항 체크박스 처리 (#wteChk1~4, hidden이므로 JS로 강제 체크)
  const checkResult = await page.evaluate(() => {
    const ids = ['wteChk1', 'wteChk2', 'wteChk3', 'wteChk4'];
    let checked = 0;
    let total = 0;
    for (const id of ids) {
      const cb = document.getElementById(id);
      if (cb) {
        total++;
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          cb.dispatchEvent(new Event('click', { bubbles: true }));
          checked++;
        }
      }
    }
    // 추가: doc_check_list 내부 체크박스도 모두 처리
    document.querySelectorAll('.doc_check_list input[type="checkbox"]').forEach(cb => {
      if (!cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        checked++;
      }
      total++;
    });
    return { total, checked };
  }).catch(() => ({ total: 0, checked: 0 }));
  log('compose', `체크박스 JS 처리: ${checkResult.total}개 중 ${checkResult.checked}개 체크`);
  await humanDelay(300, 500);

  // 확인/다음 버튼 클릭 (doc_check_list 내부 버튼 우선)
  const nextBtnSelectors = [
    '.doc_check_list button',
    '.doc_check_list a.btn',
    'button:has-text("확인")',
    'button:has-text("다음")',
    '.jconfirm-buttons button',
  ];
  for (const sel of nextBtnSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click({ force: true });
      log('compose', `확인 버튼 클릭: ${sel}`);
      await humanDelay(500, 800);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      break;
    }
  }

  // JS로도 확인 버튼 클릭 시도 (오버레이가 아직 남아있을 경우)
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.doc_check_list button, .doc_check_list a.btn');
    for (const btn of btns) {
      if (btn.textContent.includes('확인') || btn.textContent.includes('다음')) {
        btn.click();
        return true;
      }
    }
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
      const t = btn.textContent.trim();
      if (t === '확인' || t === '다음') {
        btn.click();
        return true;
      }
    }
    return false;
  }).catch(() => false);
  await humanDelay(500, 800);

  // 오버레이 요소 강제 제거 (blind_table, doc_check_list)
  await page.evaluate(() => {
    document.querySelectorAll('.blind_table').forEach(el => {
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    });
    document.querySelectorAll('.doc_check_list').forEach(el => {
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    });
    const header = document.querySelector('.header_wrap');
    if (header) header.style.position = 'relative';
  }).catch(() => {});
  log('compose', '오버레이 요소 제거 완료');

  // 추가 jconfirm 팝업 닫기
  await dismissJconfirmAlerts(page, log);

  await saveScreenshot(page, 'doc24_05_compose_ready');
  log('compose', '문서작성 페이지 준비 완료');
  return { success: true };
}

/**
 * 수신기관 검색 및 선택
 *
 * 실제 페이지 구조:
 * - #receiptinfoTmp: readonly input (표시용)
 * - #ldapSearch: "받는기관 검색" 버튼 → 팝업 윈도우 오픈
 * - #recvOrgCd (hidden): 선택된 기관 코드
 * - #recvOrgNm (hidden): 선택된 기관명
 * - #receiptinfo (hidden): 접수 정보
 * - #recvList (textarea, hidden): 수신 목록
 *
 * v31: popup 핸들링 전면 재작성
 * - Promise.all([page.waitForEvent('popup'), click]) 패턴
 * - 팝업 완전 로드 대기 (load + networkidle)
 * - 팝업 내부 iframe 감지 + 구조 덤프
 */
async function selectRecipient(page, recipient, log) {
  log('recipient', `수신기관 선택 시작: "${recipient}"`);
  await dismissJconfirmAlerts(page, log);

  // Step 0: 기존에 열린 공지/알림 팝업들 먼저 닫기
  const existingPages = page.context().pages();
  for (const p of existingPages) {
    if (p !== page && !p.isClosed()) {
      const url = p.url();
      const title = await p.title().catch(() => '');
      if (url.includes('popup_t.do') || url.includes('popup') || title.includes('공지') || title.includes('알림') || title.includes('안내')) {
        log('recipient', `기존 팝업 닫기: ${title || url}`);
        await p.close().catch(() => {});
        await humanDelay(300, 500);
      }
    }
  }

  // Step 1: #ldapSearch 클릭하여 모달 열기 (팝업 대신 jconfirm 모달)
  log('recipient', '#ldapSearch 클릭하여 모달 열기');
  const ldapBtn = page.locator('#ldapSearch');
  const btnExists = await ldapBtn.count().catch(() => 0) > 0;

  if (!btnExists) {
    log('recipient', '#ldapSearch 버튼을 찾을 수 없음', 'error');
    return { success: false, error: '받는기관 검색 버튼을 찾을 수 없습니다.' };
  }

  await ldapBtn.click({ force: true });
  await humanDelay(1500, 2000);

  // Step 2: jconfirm 모달 확인 (페이지 내 레이어 팝업)
  const modalExists = await page.evaluate(() => {
    const modal = document.querySelector('.jconfirm-box, [role="dialog"]');
    return modal && modal.offsetParent !== null;
  }).catch(() => false);

  if (!modalExists) {
    log('recipient', 'jconfirm 모달이 열리지 않음', 'error');
    await saveScreenshot(page, 'doc24_06_no_modal');
    return { success: false, error: '수신기관 검색 모달이 열리지 않았습니다.' };
  }

  log('recipient', 'jconfirm 모달 열림 확인');
  await saveScreenshot(page, 'doc24_06a_modal_opened');

  // Step 3: 모달 내 검색 입력 필드 찾기
  const searchInputSelectors = [
    '.jconfirm-box input[type="text"]',
    '.jconfirm-content input[type="text"]',
    '[role="dialog"] input[type="text"]',
    'input[placeholder*="기관"]',
    'input[placeholder*="검색"]',
  ];

  let searchInput = null;
  for (const sel of searchInputSelectors) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0) > 0 && await el.isVisible().catch(() => false)) {
      searchInput = el;
      log('recipient', `모달 검색 입력 필드: ${sel}`);
      break;
    }
  }

  if (!searchInput) {
    log('recipient', '모달 내 검색 입력 필드를 찾을 수 없음', 'error');
    // 모달 구조 덤프
    const modalStructure = await page.evaluate(() => {
      const modal = document.querySelector('.jconfirm-box, [role="dialog"]');
      if (!modal) return null;
      return {
        html: modal.innerHTML.substring(0, 2000),
        inputs: Array.from(modal.querySelectorAll('input')).map(el => ({
          type: el.type, id: el.id, name: el.name, placeholder: el.placeholder,
          visible: el.offsetParent !== null,
        })),
      };
    }).catch(() => null);
    log('recipient', `모달 구조: ${JSON.stringify(modalStructure)?.substring(0, 1000)}`);
    return { success: false, error: '수신기관 검색 모달에서 입력 필드를 찾지 못했습니다.' };
  }

  // Step 4: 검색어 입력 및 검색
  await searchInput.click();
  await humanDelay(200, 400);
  await searchInput.fill(recipient);
  log('recipient', `검색어 입력: "${recipient}"`);
  await humanDelay(300, 500);

  // 검색 버튼 클릭
  const searchBtnSelectors = [
    '.jconfirm-box button:has-text("검색")',
    '.jconfirm-content button:has-text("검색")',
    '[role="dialog"] button:has-text("검색")',
    '.jconfirm-box input[type="button"][value*="검색"]',
    '.jconfirm-box a:has-text("검색")',
  ];

  let searchBtnClicked = false;
  for (const sel of searchBtnSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.count().catch(() => 0) > 0 && await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      log('recipient', `검색 버튼 클릭: ${sel}`);
      searchBtnClicked = true;
      break;
    }
  }
  if (!searchBtnClicked) {
    await searchInput.press('Enter');
    log('recipient', 'Enter 키로 검색');
  }

  await humanDelay(1500, 2000);
  await saveScreenshot(page, 'doc24_07_search_results');

  // Step 5: 검색 결과에서 기관 선택
  const resultSelectors = [
    `.jconfirm-box td:has-text("${recipient}")`,
    `.jconfirm-box tr:has-text("${recipient}") td`,
    `.jconfirm-content a:has-text("${recipient}")`,
    '.jconfirm-box table tbody tr:first-child td:nth-child(2)',
    '.jconfirm-box table tbody tr:first-child td a',
  ];

  let resultClicked = false;
  for (const sel of resultSelectors) {
    const results = page.locator(sel);
    const count = await results.count().catch(() => 0);
    if (count > 0) {
      // 클릭 가능한 요소 찾기 (a 또는 input[type=radio] 또는 td)
      const clickable = results.first().locator('a, input[type="radio"], input[type="checkbox"]').first();
      if (await clickable.count().catch(() => 0) > 0) {
        await clickable.click({ force: true });
      } else {
        await results.first().click({ force: true });
      }
      const text = await results.first().textContent().catch(() => '');
      log('recipient', `기관 선택: "${text.trim()}" (${sel})`);
      resultClicked = true;
      await humanDelay(500, 800);
      break;
    }
  }

  if (!resultClicked) {
    log('recipient', '검색 결과에서 기관을 선택하지 못함', 'warning');
    // 검색 결과 덤프
    const tableContent = await page.evaluate(() => {
      const table = document.querySelector('.jconfirm-box table tbody');
      if (!table) return '테이블 없음';
      return table.innerText.substring(0, 500);
    }).catch(() => '');
    log('recipient', `검색 결과: ${tableContent}`);
  }

  // Step 6: 모달 닫기 (확인/닫기 버튼)
  const closeBtnSelectors = [
    '.jconfirm-box button:has-text("닫기")',
    '.jconfirm-box button:has-text("확인")',
    '.jconfirm-box .jconfirm-closeIcon',
  ];

  for (const sel of closeBtnSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.count().catch(() => 0) > 0 && await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      log('recipient', `모달 닫기: ${sel}`);
      break;
    }
  }

  await humanDelay(500, 800);
  await saveScreenshot(page, 'doc24_08_recipient_selected');

  // Step 7: 선택 결과 검증
  const recvOrgNm = await page.evaluate(() => {
    const el = document.getElementById('recvOrgNm');
    return el ? el.value : '';
  }).catch(() => '');
  const receiptinfoTmp = await page.evaluate(() => {
    const el = document.getElementById('receiptinfoTmp');
    return el ? el.value : '';
  }).catch(() => '');

  log('recipient', `검증 - recvOrgNm: "${recvOrgNm}", receiptinfoTmp: "${receiptinfoTmp}"`);

  if (recvOrgNm || receiptinfoTmp) {
    log('recipient', `수신기관 선택 완료: "${recvOrgNm || receiptinfoTmp}"`);
    return { success: true, selectedOrg: recvOrgNm || receiptinfoTmp };
  } else {
    log('recipient', `수신기관 미선택 - "${recipient}" 값을 직접 설정`, 'warning');
    await page.evaluate((name) => {
      const orgNm = document.getElementById('recvOrgNm');
      if (orgNm) orgNm.value = name;
      const tmp = document.getElementById('receiptinfoTmp');
      if (tmp) tmp.value = name;
      const orgCd = document.getElementById('recvOrgCd');
      if (orgCd && !orgCd.value) orgCd.value = name;
    }, recipient).catch(() => {});
    return { success: true, selectedOrg: recipient, directSet: true };
  }
}
  await saveScreenshot(searchPopup, 'doc24_06a_popup_loaded');

  // Step 3: 팝업 구조 분석 (디버그 덤프)
  const popupStructure = await searchPopup.evaluate(() => {
    return {
      url: location.href,
      title: document.title,
      inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
        tag: el.tagName, id: el.id, name: el.name, type: el.type,
        placeholder: el.placeholder, readonly: el.readOnly,
        visible: el.offsetParent !== null,
        className: (el.className || '').toString().substring(0, 60),
      })),
      buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn, a[onclick]')).map(el => ({
        tag: el.tagName, id: el.id,
        text: (el.textContent || el.value || '').trim().substring(0, 40),
        onclick: (el.getAttribute('onclick') || '').substring(0, 80),
      })),
      iframes: Array.from(document.querySelectorAll('iframe')).map(f => ({
        id: f.id, src: f.src, name: f.name,
      })),
      tables: document.querySelectorAll('table').length,
      treeNodes: document.querySelectorAll('.tree, .jstree, [role="tree"], .org_tree, .orgTree, .treeview').length,
      bodyPreview: (document.body?.innerText || '').substring(0, 1000),
    };
  }).catch(() => ({ error: 'evaluate failed' }));
  log('recipient', `팝업 구조: ${JSON.stringify(popupStructure).substring(0, 2000)}`);

  // Step 4: 팝업 내부 iframe 확인 → searchContext 결정
  let searchContext = searchPopup;
  const popupFrames = searchPopup.frames();
  if (popupFrames.length > 1) {
    for (const frame of popupFrames) {
      if (frame !== searchPopup.mainFrame()) {
        const frameUrl = frame.url();
        log('recipient', `팝업 내부 iframe 발견: ${frameUrl}`);
        searchContext = frame;
        await frame.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await humanDelay(500, 800);
        // iframe 내부 구조도 덤프
        const iframeStructure = await frame.evaluate(() => ({
          url: location.href,
          inputs: Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea')).map(el => ({
            id: el.id, name: el.name, type: el.type, placeholder: el.placeholder,
          })),
        })).catch(() => ({ error: 'iframe evaluate failed' }));
        log('recipient', `iframe 구조: ${JSON.stringify(iframeStructure).substring(0, 500)}`);
        break;
      }
    }
  }

  // Step 5: 검색 입력 필드 찾기 (searchContext = popup 또는 popup 내 iframe)
  const searchInputSelectors = [
    '#searchWrd', '#searchKeyword', '#orgNm', '#insttNm', '#keyword',
    '#srchText', '#searchText', '#search_text', '#schText', '#srchWrd',
    '#query', '#search', '#txtSearch', '#inputSearch',
    'input[name="searchWrd"]', 'input[name="searchKeyword"]',
    'input[name="orgNm"]', 'input[name="insttNm"]',
    'input[name="keyword"]', 'input[name="searchWord"]',
    'input[name="srchText"]', 'input[name="query"]',
    '.search_input input', '.srch_input input', '.search_box input',
    'input[placeholder*="검색"]', 'input[placeholder*="기관"]',
    'input[placeholder*="입력"]', 'input[placeholder*="조직"]',
    'input[placeholder*="기관명"]',
    // 최후 수단: visible text input
    'input[type="text"]:not([readonly]):not([disabled])',
  ];

  let searchInputFound = false;
  for (const sel of searchInputSelectors) {
    const input = searchContext.locator(sel).first();
    const count = await input.count().catch(() => 0);
    if (count > 0) {
      // ID 셀렉터는 hidden이어도 사용 가능, 나머지는 visible 체크
      const isIdSelector = sel.startsWith('#');
      const isVisible = await input.isVisible().catch(() => false);
      if (isIdSelector || isVisible) {
        await input.click({ force: true }).catch(() => {});
        await humanDelay(300, 500);
        await input.fill(recipient);
        log('recipient', `검색어 입력 완료: ${sel} → "${recipient}"`);
        searchInputFound = true;

        // Step 6: 검색 버튼 클릭
        const searchBtnSelectors = [
          'button:has-text("검색")', 'a:has-text("검색")',
          'input[type="button"][value*="검색"]', 'input[type="submit"]',
          '.btn_search', '#searchBtn', '#btnSearch',
          'img[alt*="검색"]', 'button[type="submit"]',
          'a[onclick*="search"]', 'a[onclick*="Search"]',
        ];
        let searchBtnClicked = false;
        for (const btnSel of searchBtnSelectors) {
          const btn = searchContext.locator(btnSel).first();
          if (await btn.count().catch(() => 0) > 0) {
            await btn.click({ force: true });
            log('recipient', `검색 버튼 클릭: ${btnSel}`);
            searchBtnClicked = true;
            break;
          }
        }
        if (!searchBtnClicked) {
          await input.press('Enter').catch(() => {});
          log('recipient', 'Enter 키로 검색 실행');
        }

        await humanDelay(1000, 1500);
        if (searchContext.waitForLoadState) {
          await searchContext.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        }
        await humanDelay(500, 800);
        break;
      }
    }
  }

  if (!searchInputFound) {
    log('recipient', '검색 입력 필드를 찾지 못함 - 팝업 구조 확인 필요', 'error');
    await saveScreenshot(searchPopup, 'doc24_06b_no_search_input');
    if (!searchPopup.isClosed()) await searchPopup.close().catch(() => {});
    return { success: false, error: '수신기관 검색 팝업에서 입력 필드를 찾지 못했습니다. Worker 로그에서 팝업 구조를 확인하세요.' };
  }

  await saveScreenshot(searchPopup, 'doc24_07_search_results');

  // Step 7: 검색 결과에서 기관 선택
  const resultSelectors = [
    // 정확한 텍스트 매칭 우선
    `td a:has-text("${recipient}")`,
    `a:has-text("${recipient}")`,
    `td:has-text("${recipient}")`,
    `li:has-text("${recipient}")`,
    `span:has-text("${recipient}")`,
    // 첫 번째 결과 행 (정확 매칭 실패 시)
    'table tbody tr:first-child td a',
    'table tbody tr:first-child td:nth-child(2)',
    // 목록 형태
    '.result_list li:first-child a',
    '.org_list li:first-child a',
    'ul.list li:first-child a',
  ];

  let resultClicked = false;
  for (const sel of resultSelectors) {
    const results = searchContext.locator(sel);
    const count = await results.count().catch(() => 0);
    if (count > 0) {
      // 더블클릭 → 단일클릭 fallback
      await results.first().dblclick({ force: true }).catch(async () => {
        await results.first().click({ force: true }).catch(() => {});
      });
      const resultText = await results.first().textContent().catch(() => '');
      log('recipient', `기관 선택: ${sel} → "${resultText.trim()}" (${count}개 중 첫번째)`);
      resultClicked = true;
      await humanDelay(500, 800);
      break;
    }
  }

  if (!resultClicked) {
    // JS evaluate로 직접 선택 시도
    const jsSelect = await searchContext.evaluate((name) => {
      const links = document.querySelectorAll('a, td, li, span');
      for (const el of links) {
        if (el.textContent?.includes(name)) {
          el.click();
          return el.textContent.trim().substring(0, 50);
        }
      }
      return null;
    }, recipient).catch(() => null);
    if (jsSelect) {
      log('recipient', `JS 직접 선택: "${jsSelect}"`);
      resultClicked = true;
      await humanDelay(500, 800);
    } else {
      log('recipient', '검색 결과에서 기관 선택 실패', 'warning');
    }
  }

  // Step 8: 선택 확인/적용 버튼
  const confirmSelectors = [
    'button:has-text("선택")', 'button:has-text("적용")', 'button:has-text("확인")',
    'a:has-text("선택")', 'a:has-text("적용")', 'a:has-text("확인")',
    'input[type="button"][value*="선택"]', 'input[type="button"][value*="적용"]',
    'input[type="button"][value*="확인"]',
    '.btn_select', '.btn_confirm', '#selectBtn', '#confirmBtn',
  ];
  for (const sel of confirmSelectors) {
    const btn = searchContext.locator(sel).first();
    if (await btn.count().catch(() => 0) > 0) {
      await btn.click({ force: true });
      log('recipient', `확인 버튼 클릭: ${sel}`);
      await humanDelay(500, 800);
      break;
    }
  }

  // Step 9: 팝업 닫기 + 메인 페이지 복귀
  await humanDelay(500, 800);
  if (!searchPopup.isClosed()) {
    await searchPopup.close().catch(() => {});
    log('recipient', '팝업 수동 닫기');
  } else {
    log('recipient', '팝업 자동 닫힘');
  }
  await page.bringToFront();
  await humanDelay(500, 800);

  await saveScreenshot(page, 'doc24_08_recipient_selected');

  // Step 10: 선택 결과 검증
  const recvOrgNm = await page.evaluate(() => {
    const el = document.getElementById('recvOrgNm');
    return el ? el.value : '';
  }).catch(() => '');
  const receiptinfoTmp = await page.evaluate(() => {
    const el = document.getElementById('receiptinfoTmp');
    return el ? el.value : '';
  }).catch(() => '');

  log('recipient', `검증 - recvOrgNm: "${recvOrgNm}", receiptinfoTmp: "${receiptinfoTmp}"`);

  if (recvOrgNm || receiptinfoTmp) {
    log('recipient', `수신기관 선택 완료: "${recvOrgNm || receiptinfoTmp}"`);
    return { success: true, selectedOrg: recvOrgNm || receiptinfoTmp };
  } else {
    log('recipient', `수신기관 미선택 - "${recipient}" 값을 직접 설정 시도`, 'warning');
    // 마지막 fallback: hidden 필드에 직접 값 입력
    await page.evaluate((name) => {
      const orgNm = document.getElementById('recvOrgNm');
      if (orgNm) { orgNm.value = name; }
      const tmp = document.getElementById('receiptinfoTmp');
      if (tmp) { tmp.value = name; }
      const orgCd = document.getElementById('recvOrgCd');
      if (orgCd && !orgCd.value) { orgCd.value = name; }
    }, recipient).catch(() => {});
    return { success: true, selectedOrg: recipient, directSet: true };
  }
}

/**
 * 제목 및 내용 입력
 *
 * 실제 페이지 구조:
 * - #docTitle: input, placeholder "작성할 문서의 제목을 입력하세요."
 * - #Document_HwpCtrl: HWP ActiveX web editor (한컴 웹에디터, 비표준)
 * - #st_rdo1/#st_rdo2: 직인날인 예/아니오
 * - #senderNm, #apprNm: 발신자명/제출자명 (자동 채워짐)
 */
async function fillContent(page, title, content, log) {
  log('content', `제목 입력: "${title.substring(0, 50)}"`);
  await dismissJconfirmAlerts(page, log);

  // === 제목 입력 (#docTitle) ===
  let titleFilled = false;

  // 방법 1: Playwright fill
  const titleInput = page.locator('#docTitle');
  if (await titleInput.count().catch(() => 0) > 0) {
    await titleInput.click({ force: true }).catch(() => {});
    await humanDelay(300, 500);
    await titleInput.fill(title).catch(() => {});
    titleFilled = true;
    log('content', '#docTitle fill 완료');
  }

  // 방법 2: JS 직접 값 설정 (fallback 또는 추가 보장)
  const jsTitle = await page.evaluate((t) => {
    const el = document.getElementById('docTitle');
    if (el) {
      el.value = t;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    }
    return null;
  }, title).catch(() => null);

  if (jsTitle) {
    titleFilled = true;
    log('content', `#docTitle JS 값 설정 확인: "${jsTitle.substring(0, 30)}"`);
  }

  if (!titleFilled) {
    // 최후 fallback: 다른 셀렉터 시도
    const fallbackSelectors = [
      'input[name="docTitle"]',
      'input[placeholder*="제목"]',
      '#title',
      'input[name="title"]',
    ];
    for (const sel of fallbackSelectors) {
      const input = page.locator(sel).first();
      if (await input.count().catch(() => 0) > 0) {
        await input.click({ force: true }).catch(() => {});
        await input.fill(title).catch(() => {});
        titleFilled = true;
        log('content', `제목 fallback 입력: ${sel}`);
        break;
      }
    }
  }

  if (!titleFilled) {
    log('content', '제목 필드(#docTitle)를 찾지 못함', 'error');
    return { success: false, error: '제목 필드(#docTitle)를 찾지 못했습니다.' };
  }

  // === 제목 입력 검증 ===
  const verifiedTitle = await page.evaluate(() => {
    const el = document.getElementById('docTitle');
    return el ? el.value : '';
  }).catch(() => '');
  if (!verifiedTitle) {
    log('content', '제목 입력 검증 실패: #docTitle 값이 비어있음', 'warning');
  } else {
    log('content', `제목 입력 검증 통과: "${verifiedTitle.substring(0, 30)}"`);
  }

  await humanDelay(300, 500);

  // === 본문 입력 (HWP 웹에디터 #Document_HwpCtrl) ===
  if (content) {
    log('content', `본문 입력 시도: "${content.substring(0, 50)}..."`);
    let contentFilled = false;

    // 방법 1: HWP ActiveX 웹 컨트롤 API (HwpCtrl.InsertText)
    contentFilled = await page.evaluate((text) => {
      // HwpCtrl 글로벌 객체
      if (window.HwpCtrl) {
        try {
          if (typeof HwpCtrl.InsertText === 'function') {
            HwpCtrl.InsertText(text);
            return 'HwpCtrl.InsertText';
          }
          if (typeof HwpCtrl.SetText === 'function') {
            HwpCtrl.SetText(text);
            return 'HwpCtrl.SetText';
          }
        } catch (e) { /* continue */ }
      }
      // Document_HwpCtrl 객체
      const hwpEl = document.getElementById('Document_HwpCtrl');
      if (hwpEl) {
        try {
          if (typeof hwpEl.InsertText === 'function') {
            hwpEl.InsertText(text);
            return 'hwpEl.InsertText';
          }
          if (typeof hwpEl.SetText === 'function') {
            hwpEl.SetText(text);
            return 'hwpEl.SetText';
          }
          if (typeof hwpEl.PutFieldText === 'function') {
            hwpEl.PutFieldText('본문', text);
            return 'hwpEl.PutFieldText';
          }
        } catch (e) { /* continue */ }
      }
      return null;
    }, content).catch(() => null);

    if (contentFilled) {
      log('content', `본문 입력 완료 (${contentFilled})`);
    }

    // 방법 2: iframe contentDocument 접근
    if (!contentFilled) {
      const iframeResult = await page.evaluate((text) => {
        const iframes = document.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
          const iframe = iframes[i];
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) continue;
            const body = doc.body;
            if (body && (body.contentEditable === 'true' || body.isContentEditable || doc.designMode === 'on')) {
              body.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
              return `iframe[${i}] id="${iframe.id}"`;
            }
          } catch (e) { /* cross-origin, skip */ }
        }
        return null;
      }, content).catch(() => null);

      if (iframeResult) {
        contentFilled = true;
        log('content', `본문 입력 완료 (${iframeResult})`);
      }
    }

    // 방법 3: contenteditable div
    if (!contentFilled) {
      const editableSelectors = [
        '[contenteditable="true"]',
        '.note-editable',
        '.ql-editor',
        '.ProseMirror',
      ];
      for (const sel of editableSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
          await el.click({ force: true }).catch(() => {});
          await humanDelay(300, 500);
          await page.evaluate((args) => {
            const el = document.querySelector(args.sel);
            if (el) el.innerHTML = `<p>${args.content.replace(/\n/g, '<br>')}</p>`;
          }, { sel, content }).catch(() => {});
          log('content', `본문 입력 완료 (${sel})`);
          contentFilled = true;
          break;
        }
      }
    }

    // 방법 4: textarea fallback
    if (!contentFilled) {
      const textareaSelectors = [
        'textarea[name="docCn"]',
        'textarea[name="content"]',
        'textarea[name="docContent"]',
      ];
      for (const sel of textareaSelectors) {
        const ta = page.locator(sel).first();
        if (await ta.count().catch(() => 0) > 0) {
          await ta.fill(content).catch(() => {});
          log('content', `본문 입력 완료 (textarea: ${sel})`);
          contentFilled = true;
          break;
        }
      }
    }

    if (!contentFilled) {
      log('content', '본문 에디터(#Document_HwpCtrl)는 HWP ActiveX 컨트롤 - 본문 입력 불가. 제목+첨부파일로 진행합니다.', 'warning');
    }
  }

  await saveScreenshot(page, 'doc24_09_content_filled');
  return { success: titleFilled };
}

/**
 * 첨부파일 업로드
 *
 * 실제 페이지 구조:
 * - #files_1_c100: hidden file input (name=files[])
 * - #addFiles_1_c100: "파일 추가" button
 * - #deleteFile_1_c100: "파일 삭제" button
 */
async function uploadAttachments(page, files, log) {
  await dismissJconfirmAlerts(page, log);
  if (!files || files.length === 0) {
    log('upload', '첨부파일 없음');
    return { success: true };
  }

  log('upload', `첨부파일 ${files.length}개 업로드 시작`);

  const tmpDir = '/tmp/doc24-upload';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const localPaths = [];
  for (const file of files) {
    const { fileName, fileBase64, mimeType } = file;
    if (!fileBase64 || !fileName) continue;

    const safeName = fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const tmpPath = path.join(tmpDir, `${Date.now()}_${safeName}`);
    fs.writeFileSync(tmpPath, Buffer.from(fileBase64, 'base64'));
    localPaths.push(tmpPath);
    log('upload', `파일 저장: ${safeName} (${Math.round(fileBase64.length * 0.75 / 1024)}KB)`);
  }

  if (localPaths.length === 0) {
    log('upload', '유효한 파일 없음', 'warning');
    return { success: true };
  }

  let uploaded = false;

  // 방법 1: #files_1_c100 hidden file input 직접 사용 (setInputFiles는 hidden에도 동작)
  const primaryFileInput = page.locator('#files_1_c100');
  if (await primaryFileInput.count().catch(() => 0) > 0) {
    try {
      await primaryFileInput.setInputFiles(localPaths);
      log('upload', `#files_1_c100 setInputFiles 완료 (${localPaths.length}개 파일)`);
      uploaded = true;
      await humanDelay(800, 1200);
    } catch (err) {
      log('upload', `#files_1_c100 setInputFiles 실패: ${err.message}`, 'warning');
    }
  }

  // 방법 2: 일반 file input 탐색
  if (!uploaded) {
    const fileInputSelectors = [
      'input[type="file"][name*="files"]',
      'input[type="file"][name*="file"]',
      'input[type="file"][name*="attach"]',
      'input[type="file"]',
    ];
    for (const sel of fileInputSelectors) {
      const fileInput = page.locator(sel).first();
      if (await fileInput.count().catch(() => 0) > 0) {
        try {
          await fileInput.setInputFiles(localPaths);
          log('upload', `파일 업로드 완료: ${sel}`);
          uploaded = true;
          await humanDelay(800, 1200);
          break;
        } catch (err) {
          log('upload', `${sel} setInputFiles 실패: ${err.message}`, 'warning');
        }
      }
    }
  }

  // 방법 3: "파일 추가" 버튼 → filechooser 이벤트
  if (!uploaded) {
    const attachBtnSelectors = [
      '#addFiles_1_c100',
      'button:has-text("파일 추가")',
      'button:has-text("파일첨부")',
      'button:has-text("파일 첨부")',
      'a:has-text("파일첨부")',
      'button:has-text("첨부")',
      'label[for*="file"]',
    ];

    for (const sel of attachBtnSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count().catch(() => 0) > 0) {
        log('upload', `첨부 버튼 발견: ${sel}`);
        try {
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 5000 }),
            btn.click({ force: true }),
          ]);
          if (fileChooser) {
            await fileChooser.setFiles(localPaths);
            log('upload', '파일 선택 완료 (filechooser)');
            uploaded = true;
            await humanDelay(800, 1200);
          }
        } catch (err) {
          log('upload', `filechooser 방식 실패: ${err.message}`, 'warning');
        }
        break;
      }
    }
  }

  if (!uploaded) {
    log('upload', '파일 업로드 요소를 찾지 못함', 'error');
  } else {
    // 업로드 완료 대기: 파일이 첨부 목록에 나타나는지 확인
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await humanDelay(500, 800);

    // 첨부 파일 테이블에 파일이 표시되는지 확인
    const attachedCount = await page.evaluate(() => {
      // 첨부 파일 목록 테이블/리스트에서 파일 개수 확인
      const rows = document.querySelectorAll('.file_list tr, .attach_list li, .file_item, table.fileList tr');
      return rows.length;
    }).catch(() => 0);
    log('upload', `첨부 파일 목록 확인: ${attachedCount}개 항목`);
  }

  // 임시 파일 정리
  for (const p of localPaths) {
    try { fs.unlinkSync(p); } catch {}
  }

  await saveScreenshot(page, 'doc24_10_files_uploaded');
  return { success: uploaded };
}

/**
 * 발송하기 (전송요청)
 *
 * 실제 페이지 구조:
 * - #sendDoc: "전송요청" 버튼 (실제 발송)
 * - #viewDoc: "미리보기" 버튼
 * - #saveGian: "임시저장" 버튼
 * - 클릭 후 jconfirm 팝업으로 발송 확인 → PDF 변환 → 결과 팝업 또는 페이지 이동
 */
async function sendDocument(page, log) {
  log('send', '전송요청(#sendDoc) 버튼 클릭 시도');
  await dismissJconfirmAlerts(page, log);

  // Step 1: #sendDoc 버튼 클릭
  let sendClicked = false;

  // 방법 1: Playwright click
  const sendDocBtn = page.locator('#sendDoc');
  if (await sendDocBtn.count().catch(() => 0) > 0) {
    const btnText = await sendDocBtn.textContent().catch(() => '');
    await sendDocBtn.click({ force: true });
    log('send', `#sendDoc 클릭 완료: "${btnText.trim()}"`);
    sendClicked = true;
  }

  // 방법 2: JS click fallback
  if (!sendClicked) {
    sendClicked = await page.evaluate(() => {
      const btn = document.getElementById('sendDoc');
      if (btn) { btn.click(); return true; }
      // fallback: onclick 함수 직접 호출
      if (typeof fn_sendDoc === 'function') { fn_sendDoc(); return true; }
      if (typeof sendDoc === 'function') { sendDoc(); return true; }
      return false;
    }).catch(() => false);
    if (sendClicked) log('send', 'JS fallback으로 sendDoc 클릭');
  }

  // 방법 3: 다른 셀렉터 시도
  if (!sendClicked) {
    const fallbackSelectors = [
      'button:has-text("전송요청")',
      'button:has-text("전송 요청")',
      'a:has-text("전송요청")',
      'button:has-text("발송")',
      'button:has-text("보내기")',
      '#sendBtn',
      '[onclick*="sendDoc"]',
      '[onclick*="fn_send"]',
    ];
    for (const sel of fallbackSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count().catch(() => 0) > 0) {
        await btn.click({ force: true });
        log('send', `fallback 발송 버튼 클릭: ${sel}`);
        sendClicked = true;
        break;
      }
    }
  }

  if (!sendClicked) {
    log('send', '전송요청 버튼(#sendDoc)을 찾지 못함', 'error');
    await saveScreenshot(page, 'doc24_11_send_btn_not_found');
    return { success: false, error: '전송요청 버튼(#sendDoc)을 찾지 못했습니다.' };
  }

  await humanDelay(500, 800);
  await saveScreenshot(page, 'doc24_11_after_send_click');

  // Step 2: jconfirm 발송 확인 팝업 처리
  // 문서24는 jconfirm으로 "발송하시겠습니까?" 류의 확인 팝업을 띄움
  log('send', 'jconfirm 발송 확인 팝업 대기');
  let confirmClicked = false;

  // jconfirm 팝업이 나타날 때까지 대기 (최대 5초)
  for (let retry = 0; retry < 10; retry++) {
    const jconfirmVisible = await page.locator('.jconfirm.jconfirm-open').count().catch(() => 0);
    if (jconfirmVisible > 0) {
      log('send', 'jconfirm 팝업 감지');

      // 팝업 내용 확인 (디버그)
      const popupContent = await page.evaluate(() => {
        const popup = document.querySelector('.jconfirm.jconfirm-open');
        if (!popup) return '';
        return popup.textContent?.substring(0, 200) || '';
      }).catch(() => '');
      log('send', `팝업 내용: "${popupContent.trim().substring(0, 100)}"`);

      // 에러 팝업인지 확인
      const isError = popupContent.includes('오류') || popupContent.includes('실패') ||
                      popupContent.includes('입력') || popupContent.includes('선택해');
      if (isError) {
        log('send', `발송 실패 팝업 감지: "${popupContent.trim().substring(0, 150)}"`, 'error');
        // 팝업 닫기
        await dismissJconfirmAlerts(page, log);
        await saveScreenshot(page, 'doc24_11_send_error_popup');
        return { success: false, error: `발송 실패: ${popupContent.trim().substring(0, 200)}` };
      }

      // 확인/예 버튼 클릭
      const confirmBtnSelectors = [
        '.jconfirm-buttons button:has-text("확인")',
        '.jconfirm-buttons button:has-text("예")',
        '.jconfirm-buttons button:has-text("전송")',
        '.jconfirm-buttons button:has-text("발송")',
        '.jconfirm-buttons button',
      ];
      for (const sel of confirmBtnSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          const btnText = await btn.textContent().catch(() => '');
          await btn.click({ force: true });
          log('send', `발송 확인 버튼 클릭: ${sel} ("${btnText.trim()}")`);
          confirmClicked = true;
          break;
        }
      }
      break;
    }
    await humanDelay(400, 600);
  }

  if (!confirmClicked) {
    log('send', 'jconfirm 확인 팝업이 나타나지 않음 - 직접 발송됐을 수 있음', 'warning');
  }

  // Step 3: PDF 변환 및 발송 처리 대기 (~5-6초)
  log('send', 'PDF 변환/발송 처리 대기...');
  await humanDelay(3000, 5000);
  await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.pdfConversion }).catch(() => {});

  await saveScreenshot(page, 'doc24_12_after_confirm');

  // Step 4: 결과 확인 - 추가 jconfirm 팝업 (성공/실패)
  for (let retry = 0; retry < 5; retry++) {
    const jconfirmVisible = await page.locator('.jconfirm.jconfirm-open').count().catch(() => 0);
    if (jconfirmVisible > 0) {
      const popupContent = await page.evaluate(() => {
        const popup = document.querySelector('.jconfirm.jconfirm-open');
        return popup ? (popup.textContent?.substring(0, 300) || '') : '';
      }).catch(() => '');
      log('send', `결과 팝업: "${popupContent.trim().substring(0, 150)}"`);

      // 성공 키워드 확인
      const isSuccess = popupContent.includes('완료') || popupContent.includes('성공') ||
                        popupContent.includes('전송되었') || popupContent.includes('발송되었') ||
                        popupContent.includes('처리되었');
      // 실패 키워드 확인
      const isFailure = popupContent.includes('실패') || popupContent.includes('오류') ||
                        popupContent.includes('에러');

      // 팝업 닫기 (확인 버튼 클릭)
      await page.evaluate(() => {
        const popup = document.querySelector('.jconfirm.jconfirm-open');
        if (popup) {
          const btn = popup.querySelector('.jconfirm-buttons button');
          if (btn) btn.click();
        }
      }).catch(() => {});
      await humanDelay(500, 800);

      if (isFailure) {
        log('send', `발송 실패: ${popupContent.trim().substring(0, 200)}`, 'error');
        await saveScreenshot(page, 'doc24_12_send_failed');
        return { success: false, error: `발송 실패: ${popupContent.trim().substring(0, 200)}` };
      }

      if (isSuccess) {
        log('send', '발송 성공 확인');
      }
      break;
    }
    await humanDelay(500, 800);
  }

  // Step 5: 페이지 이동 확인 (발송 후 목록 페이지로 이동하는 경우)
  const finalUrl = page.url();
  log('send', `발송 후 URL: ${finalUrl}`);

  const isRedirected = finalUrl.includes('sendDocList') || finalUrl.includes('index') ||
                       !finalUrl.includes('docWriteForm');

  await saveScreenshot(page, 'doc24_12_send_confirmed');

  if (isRedirected) {
    log('send', '발송 완료 (페이지 이동 확인)');
  } else {
    log('send', '발송 완료 (페이지 이동 미확인 - 성공 여부 보낸문서함에서 확인 필요)', 'warning');
  }

  return { success: true };
}

/**
 * 보낸문서함에서 접수 확인 + 스크린샷
 *
 * 보낸문서함 URL: https://docu.gdoc.go.kr/doc/snd/sendDocList.do
 * 테이블 구조: 첫 번째 행이 가장 최근 문서
 */
async function checkSentBox(page, title, log) {
  log('receipt', `보낸문서함 확인 - 검증 제목: "${title.substring(0, 30)}"`);
  await dismissJconfirmAlerts(page, log);

  // Step 1: 보낸문서함 이동
  await page.goto('https://docu.gdoc.go.kr/doc/snd/sendDocList.do', {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUTS.navigation,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await humanDelay(800, 1200);
  await dismissJconfirmAlerts(page, log);

  await saveScreenshot(page, 'doc24_13_sent_box');

  // Step 2: 최신 문서(첫 번째 행) 확인
  const latestDocInfo = await page.evaluate((expectedTitle) => {
    // 테이블의 첫 번째 데이터 행
    const firstRow = document.querySelector('table tbody tr:first-child');
    if (!firstRow) return { found: false, error: '테이블 행을 찾을 수 없음' };

    const cells = firstRow.querySelectorAll('td');
    const cellTexts = Array.from(cells).map(td => td.textContent?.trim() || '');

    // 문서 제목이 포함된 셀 찾기
    let docTitle = '';
    let docLink = null;
    for (const cell of cells) {
      const link = cell.querySelector('a');
      if (link) {
        docTitle = link.textContent?.trim() || '';
        docLink = link;
        break;
      }
    }

    // 제목이 없으면 셀 텍스트에서 가장 긴 것을 제목으로 추정
    if (!docTitle) {
      docTitle = cellTexts.reduce((a, b) => a.length > b.length ? a : b, '');
    }

    // 제목 매칭 확인
    const titleMatches = docTitle.includes(expectedTitle) || expectedTitle.includes(docTitle) ||
                         docTitle.replace(/\s+/g, '') === expectedTitle.replace(/\s+/g, '');

    return {
      found: true,
      docTitle,
      titleMatches,
      cellTexts: cellTexts.join(' | '),
      hasLink: !!docLink,
    };
  }, title).catch(() => ({ found: false, error: 'evaluate 실패' }));

  log('receipt', `최신 문서 정보: ${JSON.stringify(latestDocInfo)}`);

  if (!latestDocInfo.found) {
    log('receipt', `보낸문서함에서 문서를 찾지 못함: ${latestDocInfo.error}`, 'error');
    const screenshotBuf = await page.screenshot({ fullPage: false }).catch(() => null);
    return {
      receiptNumber: null,
      documentUrl: page.url(),
      screenshotB64: screenshotBuf ? `data:image/png;base64,${screenshotBuf.toString('base64')}` : null,
      error: '보낸문서함에서 문서를 찾지 못했습니다.',
    };
  }

  if (!latestDocInfo.titleMatches) {
    log('receipt', `제목 불일치! 기대: "${title}", 실제: "${latestDocInfo.docTitle}"`, 'warning');
  } else {
    log('receipt', `제목 일치 확인: "${latestDocInfo.docTitle}"`);
  }

  // Step 3: 최신 문서 클릭하여 상세 페이지 이동
  const docClicked = await page.evaluate(() => {
    const firstRow = document.querySelector('table tbody tr:first-child');
    if (!firstRow) return false;
    const link = firstRow.querySelector('a');
    if (link) { link.click(); return true; }
    // 링크가 없으면 행 자체를 클릭
    firstRow.click();
    return true;
  }).catch(() => false);

  if (docClicked) {
    log('receipt', '최신 문서 클릭 완료');
    await humanDelay(800, 1200);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  } else {
    // Playwright 셀렉터로 시도
    const docSelectors = [
      'table tbody tr:first-child td a',
      'table tbody tr:first-child',
    ];
    for (const sel of docSelectors) {
      const el = page.locator(sel).first();
      if (await el.count().catch(() => 0) > 0) {
        await el.click({ force: true });
        log('receipt', `최신 문서 클릭 (fallback): ${sel}`);
        await humanDelay(800, 1200);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        break;
      }
    }
  }

  const documentUrl = page.url();
  log('receipt', `문서 상세 URL: ${documentUrl}`);
  await saveScreenshot(page, 'doc24_14_document_detail');

  // Step 4: 접수번호/문서번호 추출
  const receiptNumber = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const patterns = [
      /문서번호\s*[:\s]*([A-Za-z0-9가-힣\-_]+)/,
      /접수번호\s*[:\s]*([A-Za-z0-9가-힣\-_]+)/,
      /발송번호\s*[:\s]*([A-Za-z0-9가-힣\-_]+)/,
      /관리번호\s*[:\s]*([A-Za-z0-9가-힣\-_]+)/,
      /등록번호\s*[:\s]*([A-Za-z0-9가-힣\-_]+)/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1].length >= 3) return m[1];
    }
    // #regnum1 + #regnum2 필드에서도 추출 시도
    const reg1 = document.getElementById('regnum1');
    const reg2 = document.getElementById('regnum2');
    if (reg1 && reg1.value) {
      return reg2 && reg2.value ? `${reg1.value}-${reg2.value}` : reg1.value;
    }
    return null;
  }).catch(() => null);

  if (receiptNumber) {
    log('receipt', `문서번호 추출: ${receiptNumber}`);
  } else {
    log('receipt', '문서번호 추출 실패 - 보낸문서함 목록에서 확인 필요', 'warning');
  }

  // Step 5: 제목 불일치 시 에러 반환
  if (!latestDocInfo.titleMatches) {
    const screenshotBuf = await page.screenshot({ fullPage: false }).catch(() => null);
    return {
      receiptNumber,
      documentUrl,
      screenshotB64: screenshotBuf ? `data:image/png;base64,${screenshotBuf.toString('base64')}` : null,
      error: `발송이 확인되지 않았습니다. 보낸문서함 최신 문서 제목: "${latestDocInfo.docTitle}"`,
    };
  }

  // Step 6: 최종 스크린샷
  const screenshotBuf = await page.screenshot({ fullPage: false }).catch(() => null);
  const screenshotB64 = screenshotBuf
    ? `data:image/png;base64,${screenshotBuf.toString('base64')}`
    : null;

  log('receipt', `보낸문서함 확인 완료 - 문서번호: ${receiptNumber || '미추출'}`);

  return {
    receiptNumber,
    documentUrl,
    screenshotB64,
  };
}

/**
 * 페이지 구조 분석 (디버그용)
 */
async function dumpPageStructure(page, log) {
  const structure = await page.evaluate(() => {
    const result = { url: location.href, title: document.title };

    // 모든 input/textarea/select/button
    const elements = [];
    const els = document.querySelectorAll('input, textarea, select, button, a, iframe, [contenteditable]');
    els.forEach(el => {
      const tag = el.tagName;
      const type = el.type || '';
      const id = el.id || '';
      const name = el.name || '';
      const className = (el.className || '').toString().substring(0, 80);
      const text = (el.textContent || el.value || '').trim().substring(0, 60);
      const visible = el.offsetParent !== null;
      const placeholder = el.placeholder || '';
      if (id || name || text || tag === 'IFRAME') {
        elements.push({ tag, type, id, name, className, text, visible, placeholder });
      }
    });
    result.elements = elements;
    result.bodyPreview = document.body?.innerText?.substring(0, 2000);
    return result;
  }).catch(() => ({ error: 'evaluate failed' }));

  log('debug', `페이지 구조: ${JSON.stringify(structure).substring(0, 2000)}`);
  return structure;
}

// =============================================================================
// 메인 함수: 문서24 전체 자동접수 프로세스
// =============================================================================

async function submitDoc24Document(params, onProgress = () => {}) {
  const {
    loginId,
    password,
    accountType = 'personal',
    recipient,
    title,
    content,
    files = [],
  } = params;

  const taskId = uuidv4();
  const logs = [];
  let browser = null;

  const log = (step, message, status = 'info') => {
    const entry = { step, message, status, timestamp: new Date().toISOString() };
    logs.push(entry);
    console.log(`[Doc24][${taskId.slice(0, 8)}] [${step}] ${message}`);
  };

  try {
    log('init', `문서24 자동접수 시작 - 수신: ${recipient}, 제목: ${title}`);
    onProgress(10);

    // Step 1: 브라우저 시작 (뷰포트 1920x1080 고정)
    const stealth = await launchStealthBrowser({
      viewport: { width: 1920, height: 1080 },
    });
    browser = stealth.browser;
    const page = stealth.page;

    // 다이얼로그 핸들러
    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      const msg = dialog.message();
      log('dialog', `${dialog.type()}: ${msg}`);
      dialogMessages.push(msg);
      await dialog.accept();
    });

    onProgress(20);

    // Step 2: 로그인
    const loginResult = await loginToDoc24(page, loginId, password, log, accountType);
    if (!loginResult.success) {
      const screenshotBuf = await page.screenshot({ fullPage: false }).catch(() => null);
      return {
        success: false,
        taskId,
        error: loginResult.error,
        logs,
        screenshot: screenshotBuf ? `data:image/png;base64,${screenshotBuf.toString('base64')}` : null,
      };
    }
    onProgress(30);

    // Step 3: 문서작성 페이지 이동
    const composeResult = await navigateToCompose(page, log);
    if (!composeResult.success) {
      const screenshotBuf = await page.screenshot({ fullPage: false }).catch(() => null);
      return {
        success: false,
        taskId,
        error: composeResult.error || '문서작성 페이지 이동 실패',
        logs,
        screenshot: screenshotBuf ? `data:image/png;base64,${screenshotBuf.toString('base64')}` : null,
      };
    }
    onProgress(40);

    // 디버그: 현재 페이지 구조 분석
    await dumpPageStructure(page, log);

    // Step 4: 수신기관 선택
    const recipientResult = await selectRecipient(page, recipient, log);
    if (!recipientResult.success) {
      const screenshotBuf = await page.screenshot({ fullPage: false }).catch(() => null);
      return {
        success: false,
        taskId,
        error: recipientResult.error || `수신기관 선택 실패: "${recipient}"`,
        logs,
        screenshot: screenshotBuf ? `data:image/png;base64,${screenshotBuf.toString('base64')}` : null,
      };
    }
    onProgress(50);

    // Step 5: 제목/내용 입력
    const contentResult = await fillContent(page, title, content || '', log);
    if (!contentResult.success) {
      const screenshotBuf = await page.screenshot({ fullPage: false }).catch(() => null);
      return {
        success: false,
        taskId,
        error: contentResult.error || '제목/내용 입력 실패',
        logs,
        screenshot: screenshotBuf ? `data:image/png;base64,${screenshotBuf.toString('base64')}` : null,
      };
    }
    onProgress(60);

    // Step 6: 첨부파일 업로드
    const uploadResult = await uploadAttachments(page, files, log);
    if (!uploadResult.success) {
      log('upload', '첨부파일 업로드 실패 - 발송은 계속 진행', 'warning');
    }
    onProgress(70);

    await saveScreenshot(page, 'doc24_before_send');

    // Step 7: 발송
    const sendResult = await sendDocument(page, log);
    onProgress(80);

    if (!sendResult.success) {
      const screenshotBuf = await page.screenshot({ fullPage: false }).catch(() => null);
      return {
        success: false,
        taskId,
        error: sendResult.error || '발송 실패',
        logs,
        screenshot: screenshotBuf ? `data:image/png;base64,${screenshotBuf.toString('base64')}` : null,
      };
    }

    // Step 8: 보낸문서함 확인
    onProgress(90);
    const receiptResult = await checkSentBox(page, title, log);

    onProgress(100);

    // checkSentBox에서 에러가 반환된 경우 (제목 불일치 등)
    if (receiptResult.error) {
      log('receipt', `보낸문서함 확인 결과: ${receiptResult.error}`, 'warning');
      return {
        success: false,
        taskId,
        error: receiptResult.error,
        receiptNumber: receiptResult.receiptNumber,
        documentUrl: receiptResult.documentUrl,
        screenshot: receiptResult.screenshotB64,
        logs,
      };
    }

    log('success', `문서24 발송 완료 (문서번호: ${receiptResult.receiptNumber || '확인필요'})`);

    return {
      success: true,
      taskId,
      receiptNumber: receiptResult.receiptNumber,
      documentUrl: receiptResult.documentUrl,
      screenshot: receiptResult.screenshotB64,
      message: receiptResult.receiptNumber
        ? `문서24를 통해 발송이 완료되었습니다. 문서번호: ${receiptResult.receiptNumber}`
        : '문서24를 통해 문서가 발송되었습니다. 보낸문서함에서 확인해주세요.',
      logs,
    };

  } catch (error) {
    log('error', error.message, 'error');
    let screenshotB64 = null;
    if (browser) {
      try {
        const pages = browser.contexts()[0]?.pages() || [];
        if (pages.length > 0) {
          const buf = await pages[0].screenshot({ fullPage: false }).catch(() => null);
          screenshotB64 = buf ? `data:image/png;base64,${buf.toString('base64')}` : null;
        }
      } catch {}
    }

    return {
      success: false,
      taskId,
      error: `문서24 오류: ${error.message}`,
      logs,
      screenshot: screenshotB64,
    };

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
      log('cleanup', '브라우저 종료');
    }
  }
}

/**
 * 디버그 전용: 문서24 로그인 후 작성 페이지 구조 덤프
 */
async function debugDoc24Compose(loginId, password, accountType = 'personal') {
  const logs = [];
  const log = (step, msg) => {
    logs.push({ step, msg, ts: new Date().toISOString() });
    console.log(`[Doc24 Debug] [${step}] ${msg}`);
  };

  let browser = null;
  try {
    const stealth = await launchStealthBrowser({
      viewport: { width: 1920, height: 1080 },
    });
    browser = stealth.browser;
    const page = stealth.page;

    const loginResult = await loginToDoc24(page, loginId, password, log, accountType);
    if (!loginResult.success) {
      return { success: false, error: loginResult.error, logs };
    }

    await navigateToCompose(page, log);

    // 기존 팝업들 먼저 닫기
    const existingPages = page.context().pages();
    for (const p of existingPages) {
      if (p !== page && !p.isClosed()) {
        const title = await p.title().catch(() => '');
        log('debug', `기존 팝업 닫기: ${title}`);
        await p.close().catch(() => {});
      }
    }
    await humanDelay(500, 800);

    // #ldapSearch 클릭 테스트
    log('debug', '#ldapSearch 클릭 테스트 시작');
    const ldapBtn = page.locator('#ldapSearch');
    const btnExists = await ldapBtn.count().catch(() => 0) > 0;
    log('debug', `#ldapSearch 버튼 존재: ${btnExists}`);

    let popupInfo = null;
    let modalInfo = null;

    if (btnExists) {
      try {
        const [popup] = await Promise.all([
          page.waitForEvent('popup', { timeout: 10000 }),
          ldapBtn.click({ force: true }),
        ]);
        await popup.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
        popupInfo = {
          url: popup.url(),
          title: await popup.title().catch(() => ''),
        };
        log('debug', `팝업 열림: ${popupInfo.title} - ${popupInfo.url}`);
        await popup.close().catch(() => {});
      } catch (e) {
        log('debug', `팝업 이벤트 실패: ${e.message}`);
        // 모달/레이어 팝업 확인
        await humanDelay(1500, 2000);
        modalInfo = await page.evaluate(() => {
          // 모달/레이어 팝업 요소 찾기
          const modals = [];
          const selectors = [
            '.modal', '.popup', '.layer', '.dialog', '[role="dialog"]',
            '.jconfirm', '.overlay', '.pop_wrap', '.pop_cont', '.popupLayer'
          ];
          for (const sel of selectors) {
            document.querySelectorAll(sel).forEach(el => {
              if (el.offsetParent !== null) { // visible
                modals.push({
                  selector: sel,
                  id: el.id,
                  className: el.className.substring(0, 100),
                  text: (el.innerText || '').substring(0, 500),
                });
              }
            });
          }
          // iframe 확인
          const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
            id: f.id, src: f.src, visible: f.offsetParent !== null,
          }));
          return { modals, iframes, pagesCount: 1 };
        }).catch(() => null);
        log('debug', `모달 확인: ${JSON.stringify(modalInfo)?.substring(0, 500)}`);
      }
    }

    const structure = await dumpPageStructure(page, log);
    const screenshotBuf = await page.screenshot({ fullPage: true }).catch(() => null);
    const screenshotB64 = screenshotBuf
      ? `data:image/png;base64,${screenshotBuf.toString('base64')}`
      : null;

    // 모든 페이지 정보
    const allPages = page.context().pages();
    const pagesInfo = allPages.map(p => ({ url: p.url(), closed: p.isClosed() }));

    return {
      success: true,
      structure,
      popupInfo,
      modalInfo,
      pagesInfo,
      screenshot: screenshotB64,
      logs,
    };
  } catch (error) {
    return { success: false, error: error.message, logs };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * 문서24 수신기관 목록 크롤링 (정부조직도)
 *
 * #ldapSearch 팝업을 열어서 조직도/검색 결과를 크롤링합니다.
 * 초성+자음 조합 검색으로 가능한 모든 기관을 수집합니다.
 */
async function crawlDoc24OrgList(loginId, password, accountType = 'personal') {
  const logs = [];
  const log = (step, msg) => {
    logs.push({ step, msg, ts: new Date().toISOString() });
    console.log(`[Doc24 OrgCrawl] [${step}] ${msg}`);
  };

  let browser = null;
  const orgMap = new Map(); // name → { name, code, category, ... }

  try {
    const stealth = await launchStealthBrowser({ viewport: { width: 1920, height: 1080 } });
    browser = stealth.browser;
    const page = stealth.page;

    // 다이얼로그 자동 수락
    page.on('dialog', async (d) => { await d.accept().catch(() => {}); });

    // 로그인
    const loginResult = await loginToDoc24(page, loginId, password, log, accountType);
    if (!loginResult.success) {
      return { success: false, error: loginResult.error, logs };
    }

    // 문서작성 페이지 이동
    const composeResult = await navigateToCompose(page, log);
    if (!composeResult.success) {
      return { success: false, error: composeResult.error || '문서작성 페이지 이동 실패', logs };
    }

    // #ldapSearch 팝업 열기
    log('crawl', '#ldapSearch 팝업 열기');
    let popup = null;
    try {
      [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: 15000 }),
        page.locator('#ldapSearch').click({ force: true }),
      ]);
    } catch (e) {
      log('crawl', `popup 실패: ${e.message}`, 'error');
      return { success: false, error: '수신기관 팝업을 열 수 없습니다.', logs };
    }

    await popup.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await popup.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await humanDelay(1500, 2000);
    log('crawl', `팝업 URL: ${popup.url()}`);

    // 팝업 내 iframe 확인
    let ctx = popup;
    const frames = popup.frames();
    if (frames.length > 1) {
      for (const f of frames) {
        if (f !== popup.mainFrame()) {
          ctx = f;
          await f.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          log('crawl', `iframe 전환: ${f.url()}`);
          break;
        }
      }
    }

    // 팝업 구조 덤프
    const structure = await ctx.evaluate(() => ({
      url: location.href,
      title: document.title,
      inputs: Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea')).map(el => ({
        id: el.id, name: el.name, type: el.type, placeholder: el.placeholder,
      })),
      buttons: Array.from(document.querySelectorAll('button, input[type="button"], a.btn, a[onclick]')).map(el => ({
        id: el.id, text: (el.textContent || el.value || '').trim().substring(0, 40),
      })),
      bodyPreview: (document.body?.innerText || '').substring(0, 2000),
    })).catch(() => ({ error: 'eval failed' }));
    log('crawl', `팝업 구조: ${JSON.stringify(structure).substring(0, 2000)}`);

    // 검색 입력 필드 찾기
    const inputSels = [
      '#searchWrd', '#searchKeyword', '#orgNm', '#insttNm', '#keyword',
      '#srchText', '#searchText', '#query', '#txtSearch',
      'input[name="searchWrd"]', 'input[name="keyword"]',
      'input[type="text"]:not([readonly]):not([disabled])',
    ];
    let searchInput = null;
    for (const sel of inputSels) {
      const el = ctx.locator(sel).first();
      if (await el.count().catch(() => 0) > 0) {
        searchInput = el;
        log('crawl', `검색 필드: ${sel}`);
        break;
      }
    }

    if (!searchInput) {
      log('crawl', '검색 입력 필드 없음 - 트리 구조 직접 스크래핑 시도');
      // 트리/테이블에서 직접 수집
      const directOrgs = await ctx.evaluate(() => {
        const orgs = [];
        // 트리 노드
        document.querySelectorAll('.jstree-node a, .tree-node a, [role="treeitem"] a, .org_tree a').forEach(a => {
          const name = a.textContent?.trim();
          if (name && name.length > 1) orgs.push({ name, code: a.getAttribute('data-id') || a.getAttribute('data-code') || '' });
        });
        // 테이블 행
        if (orgs.length === 0) {
          document.querySelectorAll('table tbody tr').forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 2) {
              const name = (tds[1].textContent || tds[0].textContent || '').trim();
              const code = tds[0].textContent?.trim() || '';
              if (name && name.length > 1) orgs.push({ name, code });
            }
          });
        }
        // 리스트 아이템
        if (orgs.length === 0) {
          document.querySelectorAll('li a, li span').forEach(el => {
            const name = el.textContent?.trim();
            if (name && name.length > 1) orgs.push({ name, code: '' });
          });
        }
        return orgs;
      }).catch(() => []);

      for (const org of directOrgs) {
        if (org.name && !orgMap.has(org.name)) {
          orgMap.set(org.name, { name: org.name, code: org.code, category: '' });
        }
      }
      log('crawl', `직접 스크래핑으로 ${directOrgs.length}개 기관 수집`);

    } else {
      // 검색 기반 크롤링: 자주 사용되는 키워드로 순차 검색
      const searchKeywords = [
        // 광역시/도
        '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
        '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
        // 주요 기관 유형
        '구청', '시청', '군청', '보건소', '교육청', '세무서', '경찰서',
        '소방서', '법원', '검찰', '우체국', '주민센터', '동사무소',
        // 중앙행정기관
        '국무', '기획재정', '교육부', '과학기술', '외교부', '통일부',
        '법무부', '국방부', '행정안전', '문화체육', '농림축산', '산업통상',
        '보건복지', '환경부', '고용노동', '여성가족', '국토교통', '해양수산',
        '중소벤처', '국세청', '관세청', '조달청', '통계청', '병무청',
        '산림청', '특허청', '식약처', '기상청', '소방청',
      ];

      const searchBtnSels = [
        'button:has-text("검색")', 'a:has-text("검색")',
        'input[type="button"][value*="검색"]', '#searchBtn', '#btnSearch',
        'input[type="submit"]', 'button[type="submit"]',
      ];

      for (const keyword of searchKeywords) {
        log('crawl', `검색: "${keyword}"`);
        await searchInput.click({ force: true }).catch(() => {});
        await searchInput.fill('').catch(() => {});
        await humanDelay(200, 300);
        await searchInput.fill(keyword);
        await humanDelay(200, 300);

        // 검색 실행
        let clicked = false;
        for (const btnSel of searchBtnSels) {
          const btn = ctx.locator(btnSel).first();
          if (await btn.count().catch(() => 0) > 0) {
            await btn.click({ force: true });
            clicked = true;
            break;
          }
        }
        if (!clicked) {
          await searchInput.press('Enter').catch(() => {});
        }

        await humanDelay(800, 1200);
        if (ctx.waitForLoadState) {
          await ctx.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        }
        await humanDelay(300, 500);

        // 결과 수집
        const results = await ctx.evaluate(() => {
          const orgs = [];
          // 테이블 결과
          document.querySelectorAll('table tbody tr').forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 1) {
              const link = tr.querySelector('a');
              const name = link ? link.textContent?.trim() : '';
              const code = link?.getAttribute('data-code') || link?.getAttribute('data-id') || '';
              // 부가정보: 상위기관, 분류 등
              const extra = tds.length >= 3 ? (tds[2].textContent?.trim() || '') : '';
              if (name && name.length > 1) orgs.push({ name, code, category: extra });
            }
          });
          // 리스트 결과
          if (orgs.length === 0) {
            document.querySelectorAll('li a, .result_list a, .org_list a').forEach(a => {
              const name = a.textContent?.trim();
              const code = a.getAttribute('data-code') || a.getAttribute('data-id') || '';
              if (name && name.length > 1) orgs.push({ name, code, category: '' });
            });
          }
          return orgs;
        }).catch(() => []);

        for (const org of results) {
          if (org.name && !orgMap.has(org.name)) {
            orgMap.set(org.name, org);
          }
        }
        log('crawl', `"${keyword}" → ${results.length}개 결과 (누적: ${orgMap.size})`);
      }
    }

    // 팝업 닫기
    if (!popup.isClosed()) await popup.close().catch(() => {});
    log('crawl', `크롤링 완료: 총 ${orgMap.size}개 기관`);

    const orgList = Array.from(orgMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    return { success: true, orgList, total: orgList.length, logs };

  } catch (error) {
    log('error', error.message);
    return { success: false, error: error.message, orgList: [], logs };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * 문서24 수신기관 실시간 검색 (팝업 내 검색)
 * 단일 키워드로 검색 후 결과 반환 (캐시에 없는 기관 찾기용)
 */
async function searchDoc24Orgs(loginId, password, keyword, accountType = 'personal') {
  const logs = [];
  const log = (step, msg) => {
    logs.push({ step, msg, ts: new Date().toISOString() });
    console.log(`[Doc24 OrgSearch] [${step}] ${msg}`);
  };

  let browser = null;
  try {
    const stealth = await launchStealthBrowser({ viewport: { width: 1920, height: 1080 } });
    browser = stealth.browser;
    const page = stealth.page;
    page.on('dialog', async (d) => { await d.accept().catch(() => {}); });

    const loginResult = await loginToDoc24(page, loginId, password, log, accountType);
    if (!loginResult.success) return { success: false, error: loginResult.error, results: [], logs };

    const composeResult = await navigateToCompose(page, log);
    if (!composeResult.success) return { success: false, error: composeResult.error, results: [], logs };

    let popup = null;
    try {
      [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: 15000 }),
        page.locator('#ldapSearch').click({ force: true }),
      ]);
    } catch {
      return { success: false, error: '팝업 열기 실패', results: [], logs };
    }

    await popup.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await popup.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await humanDelay(1500, 2000);

    let ctx = popup;
    const frames = popup.frames();
    if (frames.length > 1) {
      for (const f of frames) {
        if (f !== popup.mainFrame()) { ctx = f; break; }
      }
    }

    // 검색
    const inputSels = [
      '#searchWrd', '#searchKeyword', '#orgNm', '#insttNm', '#keyword',
      'input[type="text"]:not([readonly]):not([disabled])',
    ];
    for (const sel of inputSels) {
      const el = ctx.locator(sel).first();
      if (await el.count().catch(() => 0) > 0) {
        await el.fill(keyword);
        await el.press('Enter').catch(() => {});
        break;
      }
    }

    await humanDelay(1000, 1500);
    if (ctx.waitForLoadState) {
      await ctx.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    }

    const results = await ctx.evaluate(() => {
      const orgs = [];
      document.querySelectorAll('table tbody tr').forEach(tr => {
        const link = tr.querySelector('a');
        const tds = tr.querySelectorAll('td');
        const name = link ? link.textContent?.trim() : (tds[1]?.textContent?.trim() || tds[0]?.textContent?.trim());
        const code = link?.getAttribute('data-code') || link?.getAttribute('data-id') || '';
        const category = tds.length >= 3 ? (tds[2].textContent?.trim() || '') : '';
        if (name && name.length > 1) orgs.push({ name, code, category });
      });
      if (orgs.length === 0) {
        document.querySelectorAll('li a, .result_list a').forEach(a => {
          const name = a.textContent?.trim();
          if (name && name.length > 1) orgs.push({ name, code: '', category: '' });
        });
      }
      return orgs;
    }).catch(() => []);

    if (!popup.isClosed()) await popup.close().catch(() => {});
    log('search', `"${keyword}" → ${results.length}개 결과`);

    return { success: true, results, logs };
  } catch (error) {
    return { success: false, error: error.message, results: [], logs };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = {
  submitDoc24Document,
  debugDoc24Compose,
  crawlDoc24OrgList,
  searchDoc24Orgs,
};
