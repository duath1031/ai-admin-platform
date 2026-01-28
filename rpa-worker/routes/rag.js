/**
 * =============================================================================
 * RAG (Retrieval Augmented Generation) Routes
 * =============================================================================
 * 대용량 문서 업로드 및 RAG 파이프라인 처리
 *
 * Endpoints:
 * - POST /rag/upload     : 문서 업로드 및 처리
 * - GET  /rag/status/:id : 처리 상태 조회
 * - POST /rag/search     : 벡터 검색
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const { extractText, getFileSizeMB, cleanText, getDocumentType } = require('../services/documentProcessor');
const { chunkText, chunkPages, chunkSections, getChunkStats } = require('../services/chunkingService');
const { generateEmbeddings, generateQueryEmbedding, EMBEDDING_DIMENSION } = require('../services/embeddingService');
const {
  createKnowledgeDocument,
  updateKnowledgeDocument,
  insertKnowledgeChunks,
  getKnowledgeDocument,
  searchByVector,
  testConnection,
} = require('../services/supabaseService');

const router = express.Router();

// Multer 설정 - 메모리 스토리지 사용 (500MB 제한)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식입니다: ${ext}. 지원 형식: ${allowedTypes.join(', ')}`));
    }
  },
});

// 처리 중인 작업 상태 저장 (메모리)
const processingTasks = new Map();

/**
 * POST /rag/upload
 * 대용량 문서 업로드 및 RAG 파이프라인 처리
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    // 파일 검증
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.',
      });
    }

    const { title, category = 'general' } = req.body;
    const file = req.file;

    console.log(`[RAG Upload] Starting: ${file.originalname} (${getFileSizeMB(file.buffer).toFixed(2)} MB)`);

    // 문서 레코드 생성
    const document = await createKnowledgeDocument({
      title: title || file.originalname,
      category,
      fileType: getDocumentType(file.originalname),
      originalFileName: file.originalname,
      fileSize: file.buffer.length,
      status: 'processing',
      metadata: {
        uploadedAt: new Date().toISOString(),
        mimeType: file.mimetype,
      },
    });

    const documentId = document.id;
    console.log(`[RAG Upload] Document created: ${documentId}`);

    // 작업 상태 초기화
    processingTasks.set(documentId, {
      status: 'extracting',
      progress: 0,
      startTime,
      documentId,
    });

    // 비동기 처리 시작 (응답은 즉시 반환)
    processDocumentAsync(documentId, file.buffer, file.originalname)
      .then(() => {
        console.log(`[RAG Upload] Completed: ${documentId}`);
      })
      .catch((error) => {
        console.error(`[RAG Upload] Failed: ${documentId}`, error);
        processingTasks.set(documentId, {
          status: 'failed',
          error: error.message,
          documentId,
        });
      });

    // 즉시 응답 반환
    res.json({
      success: true,
      documentId,
      message: '문서 처리가 시작되었습니다. /rag/status/:id로 상태를 확인하세요.',
      statusUrl: `/rag/status/${documentId}`,
    });

  } catch (error) {
    console.error('[RAG Upload] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 문서 비동기 처리
 * @param {string} documentId
 * @param {Buffer} buffer
 * @param {string} filename
 */
async function processDocumentAsync(documentId, buffer, filename) {
  try {
    // 1. 텍스트 추출
    updateTaskStatus(documentId, 'extracting', 10);
    console.log(`[RAG] Step 1: Extracting text from ${filename}`);

    const extractResult = await extractText(buffer, filename);
    const cleanedText = cleanText(extractResult.text);

    console.log(`[RAG] Extracted ${cleanedText.length} characters`);

    // 2. 청킹
    updateTaskStatus(documentId, 'chunking', 30);
    console.log('[RAG] Step 2: Chunking text');

    let chunks;
    if (extractResult.pages && extractResult.pages.length > 0) {
      chunks = chunkPages(extractResult.pages);
    } else if (extractResult.sections && extractResult.sections.length > 0) {
      chunks = chunkSections(extractResult.sections);
    } else {
      chunks = chunkText(cleanedText);
    }

    const stats = getChunkStats(chunks);
    console.log(`[RAG] Created ${stats.totalChunks} chunks (avg: ${stats.avgChunkSize} chars)`);

    // 3. 임베딩 생성
    updateTaskStatus(documentId, 'embedding', 50);
    console.log('[RAG] Step 3: Generating embeddings');

    const texts = chunks.map(c => c.content);
    const embeddings = await generateEmbeddings(texts, (progress) => {
      const totalProgress = 50 + Math.round(progress.percentage * 0.35);
      updateTaskStatus(documentId, 'embedding', totalProgress);
    });

    // 청크에 임베딩 추가
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
    }

    // 4. DB 저장
    updateTaskStatus(documentId, 'saving', 90);
    console.log('[RAG] Step 4: Saving to database');

    const insertedCount = await insertKnowledgeChunks(chunks, documentId);

    // 5. 문서 상태 업데이트
    await updateKnowledgeDocument(documentId, {
      status: 'ready',
      totalChunks: insertedCount,
      metadata: {
        processingTime: Date.now() - processingTasks.get(documentId)?.startTime,
        textLength: cleanedText.length,
        chunkStats: stats,
        embeddingDimension: EMBEDDING_DIMENSION,
      },
    });

    updateTaskStatus(documentId, 'completed', 100, {
      totalChunks: insertedCount,
      stats,
    });

    console.log(`[RAG] Processing completed: ${documentId} (${insertedCount} chunks)`);

  } catch (error) {
    console.error(`[RAG] Processing failed: ${documentId}`, error);

    await updateKnowledgeDocument(documentId, {
      status: 'failed',
      metadata: {
        error: error.message,
        failedAt: new Date().toISOString(),
      },
    }).catch(console.error);

    throw error;
  }
}

/**
 * 작업 상태 업데이트
 */
function updateTaskStatus(documentId, status, progress, extra = {}) {
  const current = processingTasks.get(documentId) || {};
  processingTasks.set(documentId, {
    ...current,
    status,
    progress,
    ...extra,
    updatedAt: Date.now(),
  });
}

/**
 * GET /rag/status/:id
 * 처리 상태 조회
 */
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 메모리에서 진행 상태 조회
    const taskStatus = processingTasks.get(id);

    // DB에서 문서 상태 조회
    const document = await getKnowledgeDocument(id);

    if (!document && !taskStatus) {
      return res.status(404).json({
        success: false,
        error: '문서를 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      documentId: id,
      status: taskStatus?.status || document?.status || 'unknown',
      progress: taskStatus?.progress || (document?.status === 'ready' ? 100 : 0),
      document: document ? {
        title: document.title,
        category: document.category,
        totalChunks: document.totalChunks,
        status: document.status,
        createdAt: document.createdAt,
      } : null,
      taskInfo: taskStatus ? {
        startTime: taskStatus.startTime,
        updatedAt: taskStatus.updatedAt,
        totalChunks: taskStatus.totalChunks,
        error: taskStatus.error,
      } : null,
    });

  } catch (error) {
    console.error('[RAG Status] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /rag/search
 * 벡터 유사도 검색
 */
router.post('/search', async (req, res) => {
  try {
    const { query, category, limit = 10, threshold = 0.5 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: '검색 쿼리가 필요합니다.',
      });
    }

    console.log(`[RAG Search] Query: "${query}" (category: ${category || 'all'})`);

    // 쿼리 임베딩 생성
    const queryEmbedding = await generateQueryEmbedding(query);

    // 벡터 검색
    const results = await searchByVector(queryEmbedding, {
      limit,
      threshold,
      category,
    });

    console.log(`[RAG Search] Found ${results.length} results`);

    res.json({
      success: true,
      query,
      resultCount: results.length,
      results: results.map(r => ({
        content: r.content,
        documentTitle: r.documentTitle,
        documentId: r.documentId,
        category: r.category,
        chunkIndex: r.chunkIndex,
        pageNumber: r.pageNumber,
        sectionTitle: r.sectionTitle,
        similarity: parseFloat(r.similarity).toFixed(4),
      })),
    });

  } catch (error) {
    console.error('[RAG Search] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /rag/health
 * RAG 서비스 헬스체크
 */
router.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();

    res.json({
      success: true,
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
      embeddingModel: 'gemini-embedding-001',
      embeddingDimension: 3072,
      maxFileSize: '500MB',
      supportedFormats: ['.pdf', '.docx', '.txt'],
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
