/**
 * Stealth Browser Launcher
 * Playwright + stealth + ghost-cursor 통합 브라우저 관리
 *
 * 기능:
 * - Bot detection 우회 (stealth plugin)
 * - 베지에 곡선 마우스 이동 (ghost-cursor-playwright)
 * - User-Agent 로테이션
 * - 랜덤 딜레이
 * - Viewport 랜덤화
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');

// Stealth plugin 적용
chromium.use(stealth());

// 최신 Chrome User-Agent 풀
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

// Viewport 풀
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

/**
 * 랜덤 요소 선택
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 인간적인 랜덤 딜레이 (ms)
 */
function humanDelay(min = 500, max = 1500) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min) + min))
  );
}

/**
 * 짧은 랜덤 딜레이 (타이핑 간)
 */
function typeDelay(min = 50, max = 150) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min) + min))
  );
}

/**
 * 스텔스 브라우저 + 페이지 생성
 * @param {object} opts - 옵션
 * @returns {{ browser, page, cursor }}
 */
async function launchStealthBrowser(opts = {}) {
  const userAgent = opts.userAgent || pick(USER_AGENTS);
  const viewport = opts.viewport || pick(VIEWPORTS);

  const browser = await chromium.launch({
    headless: opts.headless !== false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      `--window-size=${viewport.width},${viewport.height}`,
    ],
  });

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    geolocation: { latitude: 37.5665, longitude: 126.9780 }, // 서울
    permissions: ['geolocation'],
    javaScriptEnabled: true,
  });

  // WebDriver 속성 제거
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5].map(() => ({ name: 'Chrome Plugin' })),
    });
    window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
  });

  const page = await context.newPage();

  // ghost-cursor 초기화 시도
  let cursor = null;
  try {
    const { createCursor } = require('ghost-cursor-playwright');
    cursor = await createCursor(page);
    console.log('[Stealth] ghost-cursor 활성화');
  } catch (err) {
    console.warn('[Stealth] ghost-cursor 로드 실패 (일반 클릭 사용):', err.message);
  }

  console.log(`[Stealth] 브라우저 시작 - UA: ${userAgent.slice(0, 50)}... VP: ${viewport.width}x${viewport.height}`);

  return { browser, context, page, cursor };
}

/**
 * ghost-cursor로 클릭 (실패 시 일반 클릭 fallback)
 */
async function humanClick(page, cursor, selector) {
  if (cursor) {
    try {
      await cursor.click(selector);
      return;
    } catch (e) {
      console.warn('[Stealth] ghost-cursor 클릭 실패, fallback:', e.message);
    }
  }
  // Fallback: 일반 클릭 + 랜덤 오프셋
  const element = await page.locator(selector).first();
  const box = await element.boundingBox();
  if (box) {
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.3 + Math.random() * 0.4);
    await page.mouse.click(x, y);
  } else {
    await element.click();
  }
}

/**
 * 인간적 텍스트 입력 (글자마다 랜덤 딜레이)
 */
async function humanType(page, selector, text) {
  const element = await page.locator(selector).first();
  await element.click();
  await humanDelay(200, 400);

  for (const char of text) {
    await element.type(char, { delay: 0 });
    await typeDelay(30, 120);
  }
}

/**
 * 스크린샷 저장 (Supabase 또는 로컬)
 */
async function saveScreenshot(page, label = 'screenshot') {
  const dir = process.env.SCREENSHOT_DIR || '/app/screenshots';
  const filename = `${label}_${Date.now()}.png`;
  const filepath = `${dir}/${filename}`;

  try {
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`[Screenshot] 저장: ${filepath}`);
    return filepath;
  } catch (err) {
    console.warn(`[Screenshot] 저장 실패: ${err.message}`);
    return null;
  }
}

module.exports = {
  launchStealthBrowser,
  humanClick,
  humanType,
  humanDelay,
  typeDelay,
  saveScreenshot,
  pick,
  USER_AGENTS,
  VIEWPORTS,
};
