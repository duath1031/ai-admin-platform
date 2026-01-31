/**
 * 가상키패드 솔버 (Virtual Keypad Solver)
 *
 * 전략:
 * 1순위: DOM 속성 분석 (aria-label, alt, title, data-*)
 * 2순위: Tesseract.js OCR (이미지 기반 키패드)
 * 3순위: 좌표 기반 그리드 추측 (3x4 표준 레이아웃)
 */

const path = require('path');

/**
 * DOM 속성으로 키패드 버튼 매핑
 * @param {import('playwright').Page} page - Playwright 페이지
 * @param {string} keypadSelector - 키패드 컨테이너 CSS 셀렉터
 * @returns {Map<string, {x: number, y: number}>|null} 숫자→좌표 매핑
 */
async function solveByDomAttributes(page, keypadSelector = '.keypad, .virtualKeypad, .security-keypad, #keypad') {
  try {
    // 키패드 컨테이너 찾기
    const container = await page.locator(keypadSelector).first();
    if (!await container.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[KeypadSolver] 키패드 컨테이너 미발견');
      return null;
    }

    // 키패드 버튼들 탐색 (다양한 패턴)
    const buttonSelectors = [
      `${keypadSelector} button`,
      `${keypadSelector} [role="button"]`,
      `${keypadSelector} .key`,
      `${keypadSelector} .btn-key`,
      `${keypadSelector} td`,
      `${keypadSelector} img`,
      `${keypadSelector} a`,
    ];

    const digitMap = new Map();

    for (const btnSelector of buttonSelectors) {
      const buttons = await page.locator(btnSelector).all();
      if (buttons.length < 10) continue;

      for (const btn of buttons) {
        const box = await btn.boundingBox();
        if (!box) continue;

        // DOM 속성에서 숫자 추출 시도
        const digit = await btn.evaluate(el => {
          // 1순위: aria-label
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel && /^\d$/.test(ariaLabel.trim())) return ariaLabel.trim();

          // 2순위: alt (이미지 키패드)
          const alt = el.getAttribute('alt');
          if (alt && /^\d$/.test(alt.trim())) return alt.trim();

          // 3순위: title
          const title = el.getAttribute('title');
          if (title && /^\d$/.test(title.trim())) return title.trim();

          // 4순위: data-value, data-key, data-num
          for (const attr of ['data-value', 'data-key', 'data-num', 'data-number']) {
            const val = el.getAttribute(attr);
            if (val && /^\d$/.test(val.trim())) return val.trim();
          }

          // 5순위: 텍스트 콘텐츠 (숫자만 있는 경우)
          const text = el.textContent?.trim();
          if (text && /^\d$/.test(text)) return text;

          // 6순위: value 속성
          const value = el.getAttribute('value');
          if (value && /^\d$/.test(value.trim())) return value.trim();

          return null;
        });

        if (digit !== null) {
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          digitMap.set(digit, { x: centerX, y: centerY, box });
        }
      }

      if (digitMap.size >= 10) break;
    }

    if (digitMap.size >= 10) {
      console.log(`[KeypadSolver] DOM 분석 성공: ${digitMap.size}개 숫자 매핑`);
      return digitMap;
    }

    console.log(`[KeypadSolver] DOM 분석 부분 성공: ${digitMap.size}/10 매핑`);
    return digitMap.size > 0 ? digitMap : null;

  } catch (err) {
    console.warn('[KeypadSolver] DOM 분석 실패:', err.message);
    return null;
  }
}

/**
 * Tesseract.js OCR로 키패드 이미지 분석
 * @param {import('playwright').Page} page - Playwright 페이지
 * @param {string} keypadSelector - 키패드 컨테이너 셀렉터
 * @returns {Map<string, {x: number, y: number}>|null}
 */
async function solveByOcr(page, keypadSelector = '.keypad, .virtualKeypad, .security-keypad, #keypad') {
  try {
    const { createWorker } = require('tesseract.js');

    const container = await page.locator(keypadSelector).first();
    if (!await container.isVisible({ timeout: 3000 }).catch(() => false)) {
      return null;
    }

    // 키패드 영역 스크린샷
    const screenshotDir = process.env.SCREENSHOT_DIR || '/app/screenshots';
    const screenshotPath = path.join(screenshotDir, `keypad_${Date.now()}.png`);
    await container.screenshot({ path: screenshotPath });

    const containerBox = await container.boundingBox();
    if (!containerBox) return null;

    // Tesseract OCR 실행
    const worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: '11', // Sparse text
    });

    const { data } = await worker.recognize(screenshotPath);
    await worker.terminate();

    const digitMap = new Map();

    // OCR 결과에서 개별 문자 위치 추출
    if (data.words) {
      for (const word of data.words) {
        for (const symbol of (word.symbols || [])) {
          const char = symbol.text?.trim();
          if (/^\d$/.test(char)) {
            const bbox = symbol.bbox;
            // 스크린샷 좌표 → 페이지 좌표 변환
            const x = containerBox.x + (bbox.x0 + bbox.x1) / 2;
            const y = containerBox.y + (bbox.y0 + bbox.y1) / 2;
            digitMap.set(char, { x, y });
          }
        }
      }
    }

    if (digitMap.size >= 10) {
      console.log(`[KeypadSolver] OCR 성공: ${digitMap.size}개 숫자 인식`);
      return digitMap;
    }

    console.log(`[KeypadSolver] OCR 부분 성공: ${digitMap.size}/10 인식`);
    return digitMap.size > 0 ? digitMap : null;

  } catch (err) {
    console.warn('[KeypadSolver] OCR 실패:', err.message);
    return null;
  }
}

/**
 * 3x4 표준 그리드 레이아웃 추측 (최후 수단)
 * 일반적인 키패드: [1][2][3] / [4][5][6] / [7][8][9] / [*][0][#]
 */
async function solveByGridGuess(page, keypadSelector = '.keypad, .virtualKeypad, .security-keypad, #keypad') {
  try {
    const container = await page.locator(keypadSelector).first();
    const box = await container.boundingBox();
    if (!box) return null;

    const cellW = box.width / 3;
    const cellH = box.height / 4;
    const digitMap = new Map();

    // 표준 3x4 레이아웃
    const layout = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      [null, '0', null],
    ];

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const digit = layout[row][col];
        if (digit) {
          digitMap.set(digit, {
            x: box.x + cellW * col + cellW / 2,
            y: box.y + cellH * row + cellH / 2,
          });
        }
      }
    }

    console.log('[KeypadSolver] 그리드 추측 모드 (정확도 낮음)');
    return digitMap;

  } catch (err) {
    console.warn('[KeypadSolver] 그리드 추측 실패:', err.message);
    return null;
  }
}

/**
 * 가상키패드로 숫자 문자열 입력
 * @param {import('playwright').Page} page
 * @param {object|null} cursor - ghost-cursor 인스턴스
 * @param {string} digits - 입력할 숫자 문자열 (예: "123456")
 * @param {string} keypadSelector - 키패드 컨테이너 셀렉터
 * @returns {boolean} 성공 여부
 */
async function typeOnKeypad(page, cursor, digits, keypadSelector) {
  // 1순위: DOM 속성 분석
  let digitMap = await solveByDomAttributes(page, keypadSelector);

  // 2순위: OCR
  if (!digitMap) {
    console.log('[KeypadSolver] DOM 실패 → OCR 시도');
    digitMap = await solveByOcr(page, keypadSelector);
  }

  // 3순위: 그리드 추측
  if (!digitMap) {
    console.log('[KeypadSolver] OCR 실패 → 그리드 추측');
    digitMap = await solveByGridGuess(page, keypadSelector);
  }

  if (!digitMap) {
    console.error('[KeypadSolver] 모든 방법 실패');
    return false;
  }

  // 숫자 하나씩 클릭
  for (const d of digits) {
    const pos = digitMap.get(d);
    if (!pos) {
      console.warn(`[KeypadSolver] 숫자 '${d}' 위치 미발견`);
      return false;
    }

    // 랜덤 오프셋 (±3px)
    const offsetX = (Math.random() - 0.5) * 6;
    const offsetY = (Math.random() - 0.5) * 6;

    if (cursor) {
      try {
        await cursor.moveTo({ x: pos.x + offsetX, y: pos.y + offsetY });
        await page.mouse.click(pos.x + offsetX, pos.y + offsetY);
      } catch {
        await page.mouse.click(pos.x + offsetX, pos.y + offsetY);
      }
    } else {
      await page.mouse.click(pos.x + offsetX, pos.y + offsetY);
    }

    // 키 입력 간 랜덤 딜레이 (80~250ms)
    await new Promise(r => setTimeout(r, 80 + Math.random() * 170));
  }

  console.log(`[KeypadSolver] ${digits.length}자리 입력 완료`);
  return true;
}

module.exports = {
  solveByDomAttributes,
  solveByOcr,
  solveByGridGuess,
  typeOnKeypad,
};
