/**
 * 입력 보호 우회 헬퍼 (Input Protection Bypass)
 *
 * 전략 (우선순위):
 * 1순위: Clipboard Paste (navigator.clipboard + Ctrl+V)
 * 2순위: Playwright page.fill() / page.type() with 랜덤 딜레이
 * 3순위: execCommand('insertText') 레거시 fallback
 */

/**
 * Clipboard Paste로 텍스트 입력
 * @param {import('playwright').Page} page
 * @param {string} selector - 입력 필드 셀렉터
 * @param {string} text - 입력할 텍스트
 * @returns {boolean} 성공 여부
 */
async function pasteViaClipboard(page, selector, text) {
  try {
    const element = await page.locator(selector).first();
    if (!await element.isVisible({ timeout: 3000 }).catch(() => false)) {
      return false;
    }

    // 필드 포커스
    await element.click();
    await _microDelay();

    // 기존 값 클리어
    await page.keyboard.press('Control+a');
    await _microDelay();

    // 클립보드에 텍스트 설정 후 붙여넣기
    const success = await page.evaluate(async (value) => {
      try {
        // Clipboard API 사용
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // Clipboard API 실패 시 execCommand 방식
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textarea);
        return result;
      }
    }, text);

    if (success) {
      await page.keyboard.press('Control+v');
      await _microDelay();

      // 입력 확인
      const inputValue = await element.inputValue().catch(() => null);
      if (inputValue === text) {
        console.log(`[InputHelper] Clipboard paste 성공: ${selector}`);
        return true;
      }
    }

    return false;

  } catch (err) {
    console.warn(`[InputHelper] Clipboard paste 실패: ${err.message}`);
    return false;
  }
}

/**
 * Playwright fill/type으로 텍스트 입력 (랜덤 딜레이 포함)
 * @param {import('playwright').Page} page
 * @param {string} selector - 입력 필드 셀렉터
 * @param {string} text - 입력할 텍스트
 * @param {object} opts - { humanLike: boolean }
 * @returns {boolean} 성공 여부
 */
async function typeWithPlaywright(page, selector, text, opts = {}) {
  try {
    const element = await page.locator(selector).first();
    if (!await element.isVisible({ timeout: 3000 }).catch(() => false)) {
      return false;
    }

    if (opts.humanLike) {
      // 글자별 입력 + 랜덤 딜레이
      await element.click();
      await _microDelay();
      await page.keyboard.press('Control+a');
      await _microDelay();
      await page.keyboard.press('Delete');

      for (const char of text) {
        await page.keyboard.type(char);
        await new Promise(r => setTimeout(r, 30 + Math.random() * 100));
      }
    } else {
      // 한번에 fill (더 빠르지만 감지 가능)
      await element.fill(text);
    }

    // [Phase 24.5] 입력 이벤트 디스패치 강화 (input, change, blur)
    await element.evaluate((el, value) => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true })); // 유효성 검사 트리거
    }, text);

    // 포커스 해제 (다음 필드로 이동)
    await page.keyboard.press('Tab');
    await _microDelay();

    console.log(`[InputHelper] Playwright ${opts.humanLike ? 'type' : 'fill'} 성공: ${selector}`);
    return true;

  } catch (err) {
    console.warn(`[InputHelper] Playwright 입력 실패: ${err.message}`);
    return false;
  }
}

/**
 * execCommand insertText 레거시 방식
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 * @returns {boolean}
 */
async function insertViaExecCommand(page, selector, text) {
  try {
    const element = await page.locator(selector).first();
    if (!await element.isVisible({ timeout: 3000 }).catch(() => false)) {
      return false;
    }

    await element.click();
    await _microDelay();

    // 기존 내용 선택 + 삭제
    await page.keyboard.press('Control+a');
    await _microDelay();

    // execCommand insertText + [Phase 24.5] blur 이벤트 추가
    const success = await element.evaluate((el, value) => {
      el.focus();
      // 기존 값 제거
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = '';
      }
      const result = document.execCommand('insertText', false, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true })); // 유효성 검사 트리거
      return result;
    }, text);

    if (success) {
      console.log(`[InputHelper] execCommand 성공: ${selector}`);
      return true;
    }

    return false;

  } catch (err) {
    console.warn(`[InputHelper] execCommand 실패: ${err.message}`);
    return false;
  }
}

/**
 * 보호된 입력 필드에 텍스트 입력 (3단계 Fallback)
 * @param {import('playwright').Page} page
 * @param {string} selector - 입력 필드 셀렉터
 * @param {string} text - 입력할 텍스트
 * @param {object} opts - { method: 'auto'|'paste'|'type'|'exec' }
 * @returns {boolean} 성공 여부
 */
async function secureInput(page, selector, text, opts = {}) {
  const { method = 'auto' } = opts;

  if (method !== 'auto') {
    switch (method) {
      case 'paste': return pasteViaClipboard(page, selector, text);
      case 'type': return typeWithPlaywright(page, selector, text, { humanLike: true });
      case 'exec': return insertViaExecCommand(page, selector, text);
      default: break;
    }
  }

  // Auto: 3단계 Fallback
  // 1순위: Clipboard Paste
  if (await pasteViaClipboard(page, selector, text)) {
    return true;
  }

  // 2순위: Playwright humanLike type
  if (await typeWithPlaywright(page, selector, text, { humanLike: true })) {
    return true;
  }

  // 3순위: execCommand insertText
  if (await insertViaExecCommand(page, selector, text)) {
    return true;
  }

  console.error(`[InputHelper] 모든 입력 방법 실패: ${selector}`);
  return false;
}

/**
 * Select 드롭다운 선택 (보호 우회)
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} value - label 또는 value
 * @returns {boolean}
 */
async function secureSelect(page, selector, value) {
  try {
    const element = await page.locator(selector).first();
    if (!await element.isVisible({ timeout: 3000 }).catch(() => false)) {
      return false;
    }

    // label로 시도
    try {
      await element.selectOption({ label: value });
      console.log(`[InputHelper] Select (label) 성공: ${selector} = ${value}`);
      return true;
    } catch {
      // value로 시도
      try {
        await element.selectOption({ value });
        console.log(`[InputHelper] Select (value) 성공: ${selector} = ${value}`);
        return true;
      } catch {
        // 부분 매치로 시도
        const matched = await element.evaluate((el, searchValue) => {
          const options = Array.from(el.options);
          const found = options.find(o =>
            o.text.includes(searchValue) || o.value.includes(searchValue)
          );
          if (found) {
            el.value = found.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        }, value);

        if (matched) {
          console.log(`[InputHelper] Select (부분매치) 성공: ${selector} = ${value}`);
          return true;
        }
      }
    }

    return false;

  } catch (err) {
    console.warn(`[InputHelper] Select 실패: ${err.message}`);
    return false;
  }
}

/** 마이크로 딜레이 (50~200ms) */
function _microDelay() {
  return new Promise(r => setTimeout(r, 50 + Math.random() * 150));
}

module.exports = {
  pasteViaClipboard,
  typeWithPlaywright,
  insertViaExecCommand,
  secureInput,
  secureSelect,
};
