/**
 * =============================================================================
 * RPA Worker Server
 * =============================================================================
 * Express.js 기반 RPA 작업 처리 서버
 * - 정부24 간편인증 및 민원 제출 자동화
 * - Main 서버(Vercel)에서 요청을 받아 처리
 *
 * 배포: Railway Docker Container
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const {
  requestGov24Auth,
  confirmGov24Auth,
  submitGov24Service,
} = require('./gov24Logic');

// BullMQ 큐 시스템
const { addJob, getJobStatus, isQueueAvailable } = require('./src/queue');
const { startWorker, stopWorker } = require('./src/queueWorker');

// RAG 라우터
const ragRoutes = require('./routes/rag');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://aiadminplatform.vercel.app',
    'https://ai-admin-platform.vercel.app',
    'https://ai-admin-platform-git-main.vercel.app',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// API 키 검증 미들웨어
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!process.env.WORKER_API_KEY) {
    console.warn('[Warning] WORKER_API_KEY not set, skipping authentication');
    return next();
  }

  if (apiKey !== process.env.WORKER_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
  }

  next();
};

// =============================================================================
// 라우트
// =============================================================================

/**
 * 헬스체크
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.8.0-real-submit',
    features: ['gov24-rpa', 'rag-pipeline', 'in-memory-queue', 'stealth-browser'],
    queue: 'in-memory',
  });
});

/**
 * RAG 라우터 등록 (대용량 문서 처리)
 * - POST /rag/upload        : 문서 업로드 및 임베딩
 * - POST /rag/upload-gemini : Gemini File API 업로드 (CORS로 보호)
 * - GET  /rag/status/       : 처리 상태 조회
 * - POST /rag/search        : 벡터 검색
 * - GET  /rag/health        : RAG 서비스 상태
 */
// API Key 검증 (upload-gemini는 CORS로만 보호 - 브라우저 직접 업로드용)
const ragApiKeyMiddleware = (req, res, next) => {
  // upload-gemini는 CORS로만 보호 (대용량 파일 브라우저 직접 업로드)
  if (req.path === '/upload-gemini') {
    return next();
  }
  return validateApiKey(req, res, next);
};
app.use('/rag', ragApiKeyMiddleware, ragRoutes);

/**
 * Playwright 테스트 (브라우저 실행 가능 여부 확인)
 */
app.get('/test-browser', validateApiKey, async (req, res) => {
  const { chromium } = require('playwright');
  let browser = null;

  try {
    console.log('[Test Browser] Starting browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const version = browser.version();
    console.log(`[Test Browser] Browser started: ${version}`);

    const page = await browser.newPage();
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
    const title = await page.title();

    await browser.close();
    browser = null;

    res.json({
      success: true,
      browserVersion: version,
      testPageTitle: title,
      message: 'Playwright 정상 작동',
    });

  } catch (error) {
    console.error('[Test Browser] Error:', error);

    if (browser) {
      await browser.close().catch(() => {});
    }

    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * 정부24 iframe 내부 DOM 디버그 (임시)
 * GET /debug/gov24-iframe
 */
app.get('/debug/gov24-iframe', validateApiKey, async (req, res) => {
  const { launchStealthBrowser, humanDelay } = require('./src/stealthBrowser');
  let browser = null;

  try {
    const stealth = await launchStealthBrowser();
    browser = stealth.browser;
    const page = stealth.page;

    // Step 1: 로그인 페이지 이동
    await page.goto('https://www.gov.kr/nlogin', { waitUntil: 'networkidle', timeout: 30000 });
    await humanDelay(2000, 3000);
    const url1 = page.url();

    // Step 2: 간편인증 버튼 클릭 (button.login-type)
    const simpleAuthClicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button.login-type');
      for (const btn of btns) {
        if (btn.textContent.includes('간편인증')) { btn.click(); return true; }
      }
      return false;
    });
    await humanDelay(3000, 5000);

    // Step 3: iframe 확인
    const iframes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).map(f => ({
        id: f.id, name: f.name, src: f.src, cls: f.className,
        width: f.width, height: f.height, visible: f.offsetParent !== null
      }));
    });

    // Step 4: iframe 내부 DOM 분석
    let iframeContent = null;
    const frame = page.frames().find(f => f.url().includes('simpleCert'));
    if (frame) {
      iframeContent = await frame.evaluate(() => {
        const body = document.body;
        if (!body) return { error: 'no body' };

        // 모든 input, select
        const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(e => ({
          tag: e.tagName, id: e.id, name: e.name, type: e.type,
          placeholder: e.placeholder, cls: e.className.substring(0, 100),
          visible: e.offsetParent !== null,
          label: e.closest('label')?.textContent?.trim()?.substring(0, 50) || '',
          parentText: e.parentElement?.textContent?.trim()?.substring(0, 80) || ''
        }));

        // 인증방법 관련 요소 (PASS, 카카오, 네이버 등)
        const keywords = ['pass', '카카오', 'kakao', '네이버', 'naver', '토스', 'toss', '통신사', 'skt', 'kt', 'lg'];
        const authElements = Array.from(document.querySelectorAll('button, a, li, div, span, img, label, input')).filter(e => {
          const text = (e.textContent || e.alt || e.title || e.value || '').toLowerCase();
          return keywords.some(k => text.includes(k));
        }).map(e => ({
          tag: e.tagName, id: e.id, cls: e.className.substring(0, 100),
          text: (e.textContent || e.alt || '').trim().substring(0, 100),
          type: e.type || '', href: e.href || '', src: e.src || ''
        }));

        // 버튼들
        const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"], input[type="button"]')).map(e => ({
          tag: e.tagName, id: e.id, cls: e.className.substring(0, 100),
          text: (e.textContent || e.value || '').trim().substring(0, 80),
          type: e.type || ''
        }));

        // body HTML snippet
        const htmlSnippet = body.innerHTML.substring(0, 8000);

        return { inputs, authElements, buttons, htmlSnippet };
      });
    }

    await browser.close();
    browser = null;

    res.json({ url: url1, simpleAuthClicked, iframes, iframeContent });

  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

/**
 * 작업 실행 (메인 엔드포인트)
 * POST /execute-task
 */
app.post('/execute-task', validateApiKey, async (req, res) => {
  const { taskType, taskData } = req.body;

  if (!taskType) {
    return res.status(400).json({
      success: false,
      error: 'taskType is required',
    });
  }

  console.log(`[Task] Starting: ${taskType}`);

  try {
    let result;

    switch (taskType) {
      case 'gov24_auth_request':
        // 정부24 간편인증 요청
        result = await requestGov24Auth(taskData);
        break;

      case 'gov24_auth_confirm':
        // 정부24 간편인증 확인
        result = await confirmGov24Auth(taskData);
        break;

      case 'gov24_submit':
        // 정부24 민원 제출
        result = await submitGov24Service(taskData);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown taskType: ${taskType}`,
        });
    }

    console.log(`[Task] Completed: ${taskType} - ${result.success ? 'SUCCESS' : 'FAILED'}`);

    res.json(result);

  } catch (error) {
    console.error(`[Task] Error: ${taskType}`, error);

    res.status(500).json({
      success: false,
      error: error.message,
      taskType,
    });
  }
});

/**
 * 정부24 비회원 간편인증 요청
 * POST /gov24/auth/request
 */
app.post('/gov24/auth/request', validateApiKey, async (req, res) => {
  const { name, rrn1, rrn2, phoneNumber, carrier, authMethod } = req.body;

  console.log('[Gov24 Auth Request] Received:', { name, rrn1: '******', rrn2: '*******', phoneNumber: '***', carrier, authMethod });

  if (!name || !rrn1 || !rrn2 || !phoneNumber) {
    return res.status(400).json({
      success: false,
      error: '이름, 주민등록번호(앞자리/뒷자리), 전화번호는 필수입니다.',
    });
  }

  if (rrn1.length !== 6 || rrn2.length !== 7) {
    return res.status(400).json({
      success: false,
      error: '주민등록번호 형식이 올바르지 않습니다. (앞자리 6자리, 뒷자리 7자리)',
    });
  }

  // 타임아웃 설정 (Railway 제한 고려)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[Gov24 Auth Request] Timeout');
      res.status(504).json({
        success: false,
        error: '작업 시간 초과 (60초)',
      });
    }
  }, 60000);

  try {
    const result = await requestGov24Auth({
      name,
      rrn1,
      rrn2,
      phoneNumber,
      carrier,
      authMethod,
    });

    clearTimeout(timeout);

    if (!res.headersSent) {
      console.log('[Gov24 Auth Request] Result:', result.success ? 'SUCCESS' : 'FAILED');
      res.json(result);
    }

  } catch (error) {
    clearTimeout(timeout);
    console.error('[Gov24 Auth Request] Error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      });
    }
  }
});

/**
 * 정부24 간편인증 확인
 * POST /gov24/auth/confirm
 */
app.post('/gov24/auth/confirm', validateApiKey, async (req, res) => {
  const { taskId, timeout, clickConfirm } = req.body;

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: 'taskId is required',
    });
  }

  try {
    const result = await confirmGov24Auth({ taskId, timeout, clickConfirm });
    res.json(result);

  } catch (error) {
    console.error('[Gov24 Auth Confirm] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 정부24 민원 제출 (Phase 25.5)
 * POST /gov24/submit
 * Body: { cookies, serviceCode?, serviceUrl?, formData?, files?: [{fileName, fileBase64, mimeType}] }
 */
app.post('/gov24/submit', validateApiKey, async (req, res) => {
  const { cookies, serviceCode, serviceUrl, formData, files } = req.body;

  if (!serviceCode && !serviceUrl) {
    return res.status(400).json({
      success: false,
      error: 'serviceCode 또는 serviceUrl 중 하나는 필수입니다.',
    });
  }

  if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
    return res.status(400).json({
      success: false,
      error: '인증 쿠키(cookies)가 필요합니다.',
    });
  }

  console.log(`[Gov24 Submit] 요청: serviceCode=${serviceCode}, serviceUrl=${serviceUrl}, files=${(files || []).length}개`);

  try {
    const result = await submitGov24Service({
      cookies,
      serviceCode,
      serviceUrl,
      formData: formData || {},
      files: files || [],
    });

    res.json(result);

  } catch (error) {
    console.error('[Gov24 Submit] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 스크린샷 조회
 * GET /screenshots/:filename
 */
app.get('/screenshots/:filename', validateApiKey, (req, res) => {
  const { filename } = req.params;
  const filepath = `/app/screenshots/${filename}`;

  res.sendFile(filepath, (err) => {
    if (err) {
      res.status(404).json({
        success: false,
        error: 'Screenshot not found',
      });
    }
  });
});

/**
 * 작업 상태 조회 (향후 확장용)
 * GET /tasks/:taskId
 */
app.get('/tasks/:taskId', validateApiKey, async (req, res) => {
  const { taskId } = req.params;

  // BullMQ 큐에서 작업 상태 조회
  const jobStatus = await getJobStatus(taskId);
  if (jobStatus) {
    return res.json({ success: true, ...jobStatus });
  }

  res.json({
    success: true,
    taskId,
    status: 'unknown',
    message: 'Task not found in queue',
  });
});

/**
 * 큐에 작업 등록 (비동기 처리)
 * POST /queue/add
 */
app.post('/queue/add', validateApiKey, async (req, res) => {
  const { taskType, taskData } = req.body;

  if (!taskType) {
    return res.status(400).json({ success: false, error: 'taskType is required' });
  }

  if (!isQueueAvailable()) {
    return res.status(503).json({
      success: false,
      error: 'Queue unavailable (Redis not connected). Use /execute-task for direct execution.',
    });
  }

  try {
    const result = await addJob(taskType, taskData);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Queue Add] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// 에러 핸들링
// =============================================================================

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path,
  });
});

// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  console.error('[Error]', err);

  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// =============================================================================
// 서버 시작
// =============================================================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('RPA Worker Server v1.6.0-phase26-checkbox-fix (In-Memory Queue)');
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // 환경변수 디버그 로그
  console.log('[ENV] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('[ENV] GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'SET' : 'NOT SET');
  console.log('[ENV] WORKER_API_KEY:', process.env.WORKER_API_KEY ? 'SET' : 'NOT SET');
  console.log('='.repeat(60));

  // In-Memory Worker 시작
  const worker = startWorker();
  console.log('[Server] In-Memory Worker 활성화');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Received SIGTERM, shutting down gracefully');
  stopWorker();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] Received SIGINT, shutting down gracefully');
  stopWorker();
  process.exit(0);
});
