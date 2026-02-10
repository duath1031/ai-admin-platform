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
  await humanDelay(1500, 2500);
  await saveScreenshot(page, 'doc24_01_login_page');

  // 계정 유형에 따른 탭 선택
  if (accountType === 'corp_rep' || accountType === 'corp_member') {
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
      if (accountType === 'corp_rep') {
        // 대표 사용자 라디오 선택
        const repRadio = page.locator('input[value="CR"], #mberSeEntrprs[value="CR"]').first();
        if (await repRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
          await repRadio.check();
          log('login', '대표 사용자 선택 (CR)');
        } else {
          // radio가 아닌 경우 직접 값 설정
          await page.evaluate(() => {
            const el = document.getElementById('mberSeEntrprs');
            if (el) el.value = 'CR';
            // 라디오 버튼이면 클릭
            const radios = document.querySelectorAll('input[name="mberSeEntrprs"]');
            radios.forEach(r => { if (r.value === 'CR') r.checked = true; });
          });
          log('login', '대표 사용자 값 직접 설정 (CR)');
        }
      } else {
        // 일반(부서) 사용자
        await page.evaluate(() => {
          const el = document.getElementById('mberSeEntrprs');
          if (el) el.value = 'CC';
          const radios = document.querySelectorAll('input[name="mberSeEntrprs"]');
          radios.forEach(r => { if (r.value === 'CC') r.checked = true; });
        });
        log('login', '부서 사용자 값 설정 (CC)');
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
  await humanDelay(2000, 3000);

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
  await humanDelay(2000, 3000);

  const currentUrl = page.url();
  log('compose', `현재 URL: ${currentUrl}`);

  // 로그인 페이지로 리디렉트되었는지 확인
  if (currentUrl.includes('loginForm')) {
    log('compose', '세션 만료 - 로그인 페이지로 리디렉트됨', 'error');
    return { success: false, error: '세션이 만료되었습니다. 다시 로그인해주세요.' };
  }

  await saveScreenshot(page, 'doc24_04_compose_page');

  // 발송 안내사항 체크박스 처리 (4개)
  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  if (checkboxCount > 0) {
    log('compose', `체크박스 ${checkboxCount}개 발견`);
    for (let i = 0; i < checkboxCount; i++) {
      const cb = checkboxes.nth(i);
      const isChecked = await cb.isChecked().catch(() => true);
      if (!isChecked) {
        await cb.check().catch(() => {});
        await humanDelay(200, 400);
      }
    }
    log('compose', '안내사항 체크 완료');

    // 확인/다음 버튼
    const nextBtnSelectors = [
      'button:has-text("확인")',
      'button:has-text("다음")',
      '.jconfirm-buttons button',
      'button[type="submit"]',
    ];
    for (const sel of nextBtnSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click();
        log('compose', `확인 버튼 클릭: ${sel}`);
        await humanDelay(1500, 2500);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        break;
      }
    }
  }

  await saveScreenshot(page, 'doc24_05_compose_ready');
  log('compose', '문서작성 페이지 준비 완료');
  return { success: true };
}

/**
 * 수신기관 검색 및 선택
 */
async function selectRecipient(page, recipient, log) {
  log('recipient', `수신기관 선택: ${recipient}`);

  // 수신기관 버튼 클릭
  const recipientBtnSelectors = [
    'button:has-text("받는 기관")',
    'button:has-text("수신기관")',
    'button:has-text("기관검색")',
    'a:has-text("받는 기관")',
    'a:has-text("수신기관")',
    '.btn_search_org',
    '#searchOrg',
    '[onclick*="openRecv"]',
    '[onclick*="openOrg"]',
    '[onclick*="searchOrg"]',
  ];

  let recipientBtnClicked = false;
  for (const sel of recipientBtnSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      log('recipient', `수신기관 버튼 클릭: ${sel}`);
      recipientBtnClicked = true;
      await humanDelay(1500, 2500);
      break;
    }
  }

  if (!recipientBtnClicked) {
    // 페이지 내에서 직접 수신기관 입력 필드 찾기
    log('recipient', '수신기관 버튼 못 찾음 - 입력 필드 직접 탐색');
  }

  await saveScreenshot(page, 'doc24_06_recipient_search');

  // 검색창에 수신기관명 입력
  const searchInputSelectors = [
    '#searchKeyword',
    'input[name="searchKeyword"]',
    'input[name="searchWord"]',
    'input[name="orgNm"]',
    '.search_input input',
    'input[placeholder*="검색"]',
    'input[placeholder*="기관"]',
    'input[type="text"]',
  ];

  let searchInputFound = false;
  for (const sel of searchInputSelectors) {
    // 메인 페이지와 팝업/iframe 모두 확인
    let input = page.locator(sel).first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.click();
      await humanDelay(200, 400);
      await input.fill(recipient);
      log('recipient', `검색어 입력: ${sel} → "${recipient}"`);
      searchInputFound = true;

      // 검색 버튼 클릭
      const searchBtnSelectors = [
        'button:has-text("검색")',
        'input[type="submit"]',
        '.btn_search',
        'a:has-text("검색")',
        'button[type="button"]:has-text("검색")',
      ];
      for (const btnSel of searchBtnSelectors) {
        const btn = page.locator(btnSel).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click();
          log('recipient', `검색 버튼 클릭: ${btnSel}`);
          break;
        }
      }
      await humanDelay(2000, 3000);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      break;
    }
  }

  if (!searchInputFound) {
    log('recipient', '검색 입력 필드를 찾지 못함', 'warning');
  }

  await saveScreenshot(page, 'doc24_07_recipient_results');

  // 검색 결과에서 기관 선택
  const resultSelectors = [
    `td:has-text("${recipient}")`,
    `a:has-text("${recipient}")`,
    `li:has-text("${recipient}")`,
    `span:has-text("${recipient}")`,
    `.result_item:has-text("${recipient}")`,
    `tr:has-text("${recipient}")`,
  ];

  let resultClicked = false;
  for (const sel of resultSelectors) {
    const results = page.locator(sel);
    const count = await results.count();
    if (count > 0) {
      // 첫 번째 결과 클릭
      await results.first().click();
      log('recipient', `수신기관 선택: ${sel} (${count}개 결과 중 첫번째)`);
      resultClicked = true;
      await humanDelay(500, 1000);
      break;
    }
  }

  if (!resultClicked) {
    log('recipient', '검색 결과에서 기관을 선택하지 못함', 'warning');
  }

  // 선택 확인/적용 버튼
  const confirmSelectors = [
    'button:has-text("선택")',
    'button:has-text("적용")',
    'button:has-text("확인")',
    '.btn_select',
    '.btn_confirm',
  ];
  for (const sel of confirmSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click();
      log('recipient', `확인 버튼 클릭: ${sel}`);
      await humanDelay(1000, 2000);
      break;
    }
  }

  await saveScreenshot(page, 'doc24_08_recipient_selected');
  return { success: resultClicked };
}

/**
 * 제목 및 내용 입력
 */
async function fillContent(page, title, content, log) {
  log('content', `제목 입력: ${title.substring(0, 50)}`);

  // 제목 입력
  const titleSelectors = [
    '#docTitle',
    'input[name="docTitle"]',
    '#title',
    'input[name="title"]',
    '#subject',
    'input[name="subject"]',
    'input[name="docSj"]',
    '.title_input input',
    'input[placeholder*="제목"]',
  ];

  let titleFilled = false;
  for (const sel of titleSelectors) {
    const input = page.locator(sel).first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.click();
      await humanDelay(200, 400);
      await input.fill(title);
      log('content', `제목 입력 완료: ${sel}`);
      titleFilled = true;
      break;
    }
  }

  if (!titleFilled) {
    log('content', '제목 필드를 찾지 못함', 'warning');
  }

  // 내용 입력 (textarea 또는 에디터)
  if (content) {
    log('content', `본문 입력: ${content.substring(0, 50)}...`);

    // 방법 1: textarea 직접 입력
    const textareaSelectors = [
      '#content',
      'textarea[name="content"]',
      '#docContent',
      'textarea[name="docContent"]',
      '#body',
      'textarea[name="body"]',
      'textarea[name="docCn"]',
      '.content_area textarea',
    ];

    let contentFilled = false;
    for (const sel of textareaSelectors) {
      const textarea = page.locator(sel).first();
      if (await textarea.isVisible({ timeout: 1500 }).catch(() => false)) {
        await textarea.click();
        await humanDelay(200, 400);
        await textarea.fill(content);
        log('content', `본문 입력 완료 (textarea): ${sel}`);
        contentFilled = true;
        break;
      }
    }

    // 방법 2: contenteditable div
    if (!contentFilled) {
      const editableDivs = page.locator('[contenteditable="true"]');
      const editableCount = await editableDivs.count();
      if (editableCount > 0) {
        const editable = editableDivs.first();
        await editable.click();
        await humanDelay(200, 400);
        await editable.fill(content);
        log('content', '본문 입력 완료 (contenteditable)');
        contentFilled = true;
      }
    }

    // 방법 3: iframe 에디터
    if (!contentFilled) {
      const iframeSelectors = [
        'iframe.editor',
        'iframe#editorFrame',
        'iframe[name="editor"]',
        'iframe[id*="editor"]',
        'iframe[class*="editor"]',
        'iframe[src*="editor"]',
      ];

      for (const sel of iframeSelectors) {
        const iframe = page.locator(sel).first();
        if (await iframe.isVisible({ timeout: 1500 }).catch(() => false)) {
          const frame = page.frameLocator(sel);
          await frame.locator('body').click().catch(() => {});
          await humanDelay(200, 400);

          // iframe 내 body에 HTML 삽입
          await page.evaluate((args) => {
            const iframeEl = document.querySelector(args.sel);
            if (iframeEl && iframeEl.contentDocument) {
              iframeEl.contentDocument.body.innerHTML = `<p>${args.content}</p>`;
            }
          }, { sel, content }).catch(() => {});

          // fallback: type으로 시도
          await frame.locator('body').fill(content).catch(() => {});

          log('content', `본문 입력 완료 (iframe): ${sel}`);
          contentFilled = true;
          break;
        }
      }
    }

    if (!contentFilled) {
      log('content', '본문 입력 필드를 찾지 못함', 'warning');
    }
  }

  await saveScreenshot(page, 'doc24_09_content_filled');
  return { success: titleFilled };
}

/**
 * 첨부파일 업로드
 */
async function uploadAttachments(page, files, log) {
  if (!files || files.length === 0) {
    log('upload', '첨부파일 없음');
    return { success: true };
  }

  log('upload', `첨부파일 ${files.length}개 업로드`);

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

  // 파일 input 찾기
  const fileInputSelectors = [
    'input[type="file"]',
    'input[type="file"][name*="file"]',
    'input[type="file"][name*="attach"]',
    'input[type="file"][id*="file"]',
    'input[type="file"][id*="attach"]',
  ];

  let uploaded = false;
  for (const sel of fileInputSelectors) {
    const fileInput = page.locator(sel).first();
    const count = await page.locator(sel).count();
    if (count > 0) {
      await fileInput.setInputFiles(localPaths);
      log('upload', `파일 업로드 완료: ${sel}`);
      uploaded = true;
      await humanDelay(2000, 3000); // 업로드 처리 대기
      break;
    }
  }

  // 첨부 버튼 → filechooser 방식
  if (!uploaded) {
    const attachBtnSelectors = [
      'button:has-text("파일첨부")',
      'button:has-text("파일 첨부")',
      'a:has-text("파일첨부")',
      'button:has-text("첨부")',
      'a:has-text("첨부")',
      'label[for*="file"]',
    ];

    for (const sel of attachBtnSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        log('upload', `첨부 버튼 발견: ${sel}`);
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 5000 }),
          btn.click(),
        ]).catch(() => [null]);

        if (fileChooser) {
          await fileChooser.setFiles(localPaths);
          log('upload', '파일 선택 완료 (filechooser)');
          uploaded = true;
          await humanDelay(2000, 3000);
        }
        break;
      }
    }
  }

  if (!uploaded) {
    log('upload', '파일 업로드 요소를 찾지 못함', 'warning');
  }

  // 임시 파일 정리
  for (const p of localPaths) {
    fs.unlinkSync(p);
  }

  await saveScreenshot(page, 'doc24_10_files_uploaded');
  return { success: uploaded };
}

/**
 * 발송하기
 */
async function sendDocument(page, log) {
  log('send', '발송 버튼 탐색');

  // 발송 버튼 클릭
  const sendSelectors = [
    'button:has-text("보내기")',
    'button:has-text("발송")',
    'button:has-text("전송")',
    'a:has-text("보내기")',
    'a:has-text("발송")',
    '#sendBtn',
    '#submitBtn',
    '.btn_send',
    'button[type="submit"]',
    '[onclick*="doSend"]',
    '[onclick*="fnSend"]',
    '[onclick*="send"]',
  ];

  let sendClicked = false;
  for (const sel of sendSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // display:none 체크 (상단 버튼이 숨겨져 있을 수 있음)
      const isEnabled = await btn.isEnabled().catch(() => false);
      if (isEnabled) {
        const btnText = await btn.textContent().catch(() => '');
        await btn.click();
        log('send', `발송 버튼 클릭: ${sel} ("${btnText.trim()}")`);
        sendClicked = true;
        await humanDelay(1000, 2000);
        break;
      }
    }
  }

  // 하단 버튼 fallback
  if (!sendClicked) {
    const bottomBtnSelectors = [
      '.btn_area_bottom button:has-text("발송")',
      '.btn_area_bottom button:has-text("보내기")',
      '.bottom_btn button',
    ];
    for (const sel of bottomBtnSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click();
        log('send', `하단 발송 버튼 클릭: ${sel}`);
        sendClicked = true;
        await humanDelay(1000, 2000);
        break;
      }
    }
  }

  if (!sendClicked) {
    log('send', '발송 버튼을 찾지 못함', 'error');
    return { success: false, error: '발송 버튼을 찾지 못했습니다.' };
  }

  // PDF 변환 대기 (~5-6초)
  log('send', 'PDF 변환 대기중...');
  await humanDelay(3000, 5000);
  await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.pdfConversion }).catch(() => {});

  await saveScreenshot(page, 'doc24_11_after_send');

  // 발송 확인 팝업 처리 (jconfirm)
  const confirmSelectors = [
    '.jconfirm-buttons button:has-text("확인")',
    '.jconfirm-buttons button:has-text("예")',
    'button:has-text("확인")',
    'button:has-text("예")',
    '.confirm_btn',
  ];

  for (const sel of confirmSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const btnText = await btn.textContent().catch(() => '');
      await btn.click();
      log('send', `발송 확인 클릭: ${sel} ("${btnText.trim()}")`);
      await humanDelay(2000, 4000);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      break;
    }
  }

  // 추가 확인 팝업 (두 번째)
  await humanDelay(1000, 2000);
  for (const sel of confirmSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      log('send', `추가 확인 클릭: ${sel}`);
      await humanDelay(1500, 2500);
      break;
    }
  }

  await saveScreenshot(page, 'doc24_12_send_confirmed');
  log('send', '발송 완료');
  return { success: true };
}

/**
 * 보낸문서함에서 접수 확인 + 스크린샷
 */
async function checkSentBox(page, title, log) {
  log('receipt', '보낸문서함 확인');

  // 보낸문서함 이동
  await page.goto('https://docu.gdoc.go.kr/doc/snd/sendDocList.do', {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUTS.navigation,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await humanDelay(2000, 3000);

  await saveScreenshot(page, 'doc24_13_sent_box');

  // 가장 최근 문서 확인
  const recentDocSelectors = [
    'table tbody tr:first-child td a',
    'table tbody tr:first-child',
    '.doc_list li:first-child a',
    '.document_item:first-child',
    'ul.list li:first-child a',
  ];

  let docClicked = false;
  for (const sel of recentDocSelectors) {
    const doc = page.locator(sel).first();
    if (await doc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await doc.click();
      log('receipt', `최근 문서 클릭: ${sel}`);
      docClicked = true;
      await humanDelay(2000, 3000);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      break;
    }
  }

  const documentUrl = page.url();
  log('receipt', `문서 URL: ${documentUrl}`);
  await saveScreenshot(page, 'doc24_14_document_detail');

  // 접수번호/문서번호 추출
  const receiptNumber = await page.evaluate(() => {
    const text = document.body.innerText;
    const patterns = [
      /문서번호\s*[:\s]*([A-Za-z0-9\-]+)/,
      /접수번호\s*[:\s]*([A-Za-z0-9\-]+)/,
      /발송번호\s*[:\s]*([A-Za-z0-9\-]+)/,
      /관리번호\s*[:\s]*([A-Za-z0-9\-]+)/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1];
    }
    return null;
  }).catch(() => null);

  if (receiptNumber) {
    log('receipt', `접수번호: ${receiptNumber}`);
  } else {
    log('receipt', '접수번호 추출 실패', 'warning');
  }

  // 최종 스크린샷
  const screenshotBuf = await page.screenshot({ fullPage: false }).catch(() => null);
  const screenshotB64 = screenshotBuf
    ? `data:image/png;base64,${screenshotBuf.toString('base64')}`
    : null;

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
    result.bodyPreview = document.body?.innerText?.substring(0, 500);
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
    await selectRecipient(page, recipient, log);
    onProgress(50);

    // Step 5: 제목/내용 입력
    await fillContent(page, title, content || '', log);
    onProgress(60);

    // Step 6: 첨부파일 업로드
    await uploadAttachments(page, files, log);
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
    log('success', `문서24 발송 완료 (접수번호: ${receiptResult.receiptNumber || '확인필요'})`);

    return {
      success: true,
      taskId,
      receiptNumber: receiptResult.receiptNumber,
      documentUrl: receiptResult.documentUrl,
      screenshot: receiptResult.screenshotB64,
      message: receiptResult.receiptNumber
        ? `문서24를 통해 접수가 완료되었습니다. 접수번호: ${receiptResult.receiptNumber}`
        : '문서24를 통해 문서가 발송되었습니다.',
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
async function debugDoc24Compose(loginId, password) {
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

    const loginResult = await loginToDoc24(page, loginId, password, log);
    if (!loginResult.success) {
      return { success: false, error: loginResult.error, logs };
    }

    await navigateToCompose(page, log);
    const structure = await dumpPageStructure(page, log);

    const screenshotBuf = await page.screenshot({ fullPage: true }).catch(() => null);
    const screenshotB64 = screenshotBuf
      ? `data:image/png;base64,${screenshotBuf.toString('base64')}`
      : null;

    return {
      success: true,
      structure,
      screenshot: screenshotB64,
      logs,
    };
  } catch (error) {
    return { success: false, error: error.message, logs };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = {
  submitDoc24Document,
  debugDoc24Compose,
};
