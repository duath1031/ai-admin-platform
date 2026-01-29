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
// Gemini File API (Long Context)
const { uploadToGemini, deleteFromGemini, SUPPORTED_MIME_TYPES } = require('../services/geminiFileService');

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
 * POST /rag/upload-gemini
 * 엔터프라이즈 아키텍처: 영구 저장소 + Gemini 캐시
 *
 * 1. 파일을 영구 저장소(The Vault)에 먼저 저장
 * 2. Gemini File API에 업로드 (48시간 캐시)
 * 3. 두 경로를 모두 반환
 */
router.post('/upload-gemini', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  const { saveToStorage } = require('../services/storageService');

  try {
    // 파일 검증
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.',
      });
    }

    const { title, category = 'general', documentId } = req.body;
    const file = req.file;
    const fileSizeMB = getFileSizeMB(file.buffer);

    console.log(`[RAG Gemini] Starting: ${file.originalname} (${fileSizeMB.toFixed(2)} MB)`);

    // ============================================
    // Step 1: 영구 저장소에 먼저 저장 (The Vault)
    // ============================================
    console.log(`[RAG Gemini] Step 1: Saving to permanent storage...`);
    const storageResult = await saveToStorage(file.buffer, file.originalname);
    console.log(`[RAG Gemini] Saved to storage: ${storageResult.storagePath}`);

    // ============================================
    // Step 2: Gemini File API에 업로드 (Cache)
    // ============================================
    console.log(`[RAG Gemini] Step 2: Uploading to Gemini File API...`);
    const uploadResult = await uploadToGemini(
      file.buffer,
      file.originalname,
      title || file.originalname
    );

    const processingTime = Date.now() - startTime;
    console.log(`[RAG Gemini] Completed in ${processingTime}ms`);
    console.log(`[RAG Gemini] - Storage: ${storageResult.storagePath}`);
    console.log(`[RAG Gemini] - Gemini: ${uploadResult.fileUri}`);

    // DB 업데이트 (documentId가 있으면)
    if (documentId) {
      try {
        await updateKnowledgeDocument(documentId, {
          status: 'completed',
          metadata: {
            storagePath: storageResult.storagePath,
            storageProvider: 'local',
            geminiFileUri: uploadResult.fileUri,
            geminiMimeType: uploadResult.mimeType,
            geminiFileName: uploadResult.name,
            geminiExpiresAt: uploadResult.expiresAt,
            processingMode: 'gemini_file',
            processingTime,
            uploadedAt: new Date().toISOString(),
          },
        });
      } catch (dbError) {
        console.error('[RAG Gemini] DB update failed:', dbError.message);
      }
    }

    res.json({
      success: true,
      // 영구 저장소 정보 (Supabase Storage)
      storagePath: storageResult.storagePath,
      storageProvider: storageResult.storageProvider,
      storageType: storageResult.storageType,
      // Gemini 캐시 정보 (48시간)
      fileUri: uploadResult.fileUri,
      mimeType: uploadResult.mimeType,
      fileName: uploadResult.name,
      displayName: uploadResult.displayName,
      expiresAt: uploadResult.expiresAt,
      // 메타데이터
      processingTime,
      message: `Supabase 영구저장 + Gemini 캐시 완료 (${processingTime}ms)`,
    });

  } catch (error) {
    console.error('[RAG Gemini] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /rag/renew-gemini
 * 만료된 Gemini 캐시 자동 갱신 (Smart Renewal)
 * - 영구 저장소에서 파일을 읽어 Gemini에 재업로드
 */
router.post('/renew-gemini', async (req, res) => {
  const startTime = Date.now();
  const { readFromStorage } = require('../services/storageService');

  try {
    const { storagePath, originalName, title } = req.body;

    if (!storagePath) {
      return res.status(400).json({
        success: false,
        error: 'storagePath가 필요합니다.',
      });
    }

    console.log(`[RAG Renew] Renewing Gemini cache for: ${storagePath}`);

    // 영구 저장소에서 파일 읽기
    const buffer = await readFromStorage(storagePath);
    const fileName = originalName || storagePath.split('_').pop();

    // Gemini에 재업로드
    const uploadResult = await uploadToGemini(buffer, fileName, title || fileName);

    const processingTime = Date.now() - startTime;
    console.log(`[RAG Renew] Renewed in ${processingTime}ms: ${uploadResult.fileUri}`);

    res.json({
      success: true,
      fileUri: uploadResult.fileUri,
      mimeType: uploadResult.mimeType,
      fileName: uploadResult.name,
      expiresAt: uploadResult.expiresAt,
      processingTime,
      message: `캐시 갱신 완료 (${processingTime}ms)`,
    });

  } catch (error) {
    console.error('[RAG Renew] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /rag/storage/stats
 * 영구 저장소 통계 조회
 */
router.get('/storage/stats', async (req, res) => {
  try {
    const { getStorageStats } = require('../services/storageService');
    const stats = await getStorageStats();

    res.json({
      success: true,
      ...stats,
    });

  } catch (error) {
    console.error('[RAG Storage Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /rag/gemini/:fileName
 * Gemini File API에서 파일 삭제
 */
router.delete('/gemini/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: '파일명이 필요합니다.',
      });
    }

    await deleteFromGemini(fileName);

    res.json({
      success: true,
      message: `파일 삭제 완료: ${fileName}`,
    });

  } catch (error) {
    console.error('[RAG Gemini Delete] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /rag/gemini/files
 * 업로드된 Gemini 파일 목록 조회
 */
router.get('/gemini/files', async (req, res) => {
  try {
    const { listGeminiFiles } = require('../services/geminiFileService');
    const files = await listGeminiFiles();

    res.json({
      success: true,
      files,
      count: files.length,
    });

  } catch (error) {
    console.error('[RAG Gemini List] Error:', error);
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
      // Legacy RAG (임베딩 방식)
      embeddingModel: 'gemini-embedding-001',
      embeddingDimension: 3072,
      // Gemini File API (Long Context 방식)
      geminiFileApi: {
        enabled: true,
        maxFileSize: '100MB',
        supportedFormats: Object.keys(SUPPORTED_MIME_TYPES),
        expiresIn: '48 hours',
      },
      maxFileSize: '500MB',
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.csv', '.xlsx', '.pptx'],
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
