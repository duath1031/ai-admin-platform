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

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://aiadminplatform.vercel.app',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

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
    version: '1.0.0',
  });
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
 * 정부24 간편인증 요청
 * POST /gov24/auth/request
 */
app.post('/gov24/auth/request', validateApiKey, async (req, res) => {
  const { name, birthDate, phoneNumber, carrier, authMethod } = req.body;

  if (!name || !birthDate || !phoneNumber) {
    return res.status(400).json({
      success: false,
      error: '이름, 생년월일, 전화번호는 필수입니다.',
    });
  }

  try {
    const result = await requestGov24Auth({
      name,
      birthDate,
      phoneNumber,
      carrier,
      authMethod,
    });

    res.json(result);

  } catch (error) {
    console.error('[Gov24 Auth Request] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 정부24 간편인증 확인
 * POST /gov24/auth/confirm
 */
app.post('/gov24/auth/confirm', validateApiKey, async (req, res) => {
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: 'taskId is required',
    });
  }

  try {
    const result = await confirmGov24Auth({ taskId });
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
 * 정부24 민원 제출
 * POST /gov24/submit
 */
app.post('/gov24/submit', validateApiKey, async (req, res) => {
  const { cookies, serviceCode, formData } = req.body;

  if (!serviceCode || !formData) {
    return res.status(400).json({
      success: false,
      error: 'serviceCode and formData are required',
    });
  }

  try {
    const result = await submitGov24Service({
      cookies,
      serviceCode,
      formData,
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
app.get('/tasks/:taskId', validateApiKey, (req, res) => {
  const { taskId } = req.params;

  // TODO: Redis나 DB에서 작업 상태 조회
  res.json({
    success: true,
    taskId,
    status: 'unknown',
    message: 'Task status tracking not implemented yet',
  });
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
  console.log('RPA Worker Server');
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] Received SIGINT, shutting down gracefully');
  process.exit(0);
});
