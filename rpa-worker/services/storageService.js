/**
 * =============================================================================
 * Storage Service (The Vault) - Supabase Storage
 * =============================================================================
 * 영구 저장소 관리 서비스
 * - Supabase Storage를 사용한 영구 파일 보관
 * - 재배포/서버 재시작에도 파일 유지
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Storage] Supabase credentials not found. Storage will not work.');
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// 저장소 버킷 이름
const BUCKET_NAME = 'knowledge-files';
const STORAGE_PROVIDER = 'supabase';

/**
 * 고유한 파일 ID 생성
 * @param {string} originalName - 원본 파일명
 * @returns {string} 고유 ID
 */
function generateFileId(originalName) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName).toLowerCase();
  // 한글 파일명 처리를 위해 ID만 사용
  return `${timestamp}_${random}${ext}`;
}

/**
 * 버킷 존재 확인 및 생성
 */
async function ensureBucket() {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!exists) {
      console.log(`[Storage] Creating bucket: ${BUCKET_NAME}`);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false, // 비공개 버킷
        fileSizeLimit: 100 * 1024 * 1024, // 100MB
      });

      if (error) {
        // 이미 존재하는 경우 무시
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('[Storage] Bucket check/create error:', error.message);
    throw error;
  }
}

/**
 * 파일을 Supabase Storage에 저장
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} originalName - 원본 파일명
 * @returns {Promise<{fileId: string, storagePath: string, fileSize: number, publicUrl: string}>}
 */
async function saveToStorage(buffer, originalName) {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  }

  await ensureBucket();

  const fileId = generateFileId(originalName);
  const storagePath = `documents/${fileId}`;

  console.log(`[Storage] Uploading to Supabase: ${originalName} -> ${storagePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  // 파일 확장자에서 MIME 타입 추출
  const ext = path.extname(originalName).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true, // 덮어쓰기 허용
    });

  if (error) {
    console.error('[Storage] Upload error:', error);
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }

  console.log(`[Storage] Saved: ${storagePath}`);

  return {
    fileId,
    storagePath,
    storageProvider: STORAGE_PROVIDER,
    fileSize: buffer.length,
    originalName,
  };
}

/**
 * Supabase Storage에서 파일 읽기
 * @param {string} storagePath - 저장 경로
 * @returns {Promise<Buffer>} 파일 버퍼
 */
async function readFromStorage(storagePath) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  console.log(`[Storage] Reading from Supabase: ${storagePath}`);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) {
    console.error('[Storage] Download error:', error);
    throw new Error(`파일 다운로드 실패: ${error.message}`);
  }

  // Blob을 Buffer로 변환
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`[Storage] Read: ${storagePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  return buffer;
}

/**
 * Supabase Storage에서 파일 삭제
 * @param {string} storagePath - 저장 경로
 */
async function deleteFromStorage(storagePath) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error('[Storage] Delete error:', error);
    throw new Error(`파일 삭제 실패: ${error.message}`);
  }

  console.log(`[Storage] Deleted: ${storagePath}`);
}

/**
 * 파일 존재 여부 확인
 * @param {string} storagePath - 저장 경로
 * @returns {Promise<boolean>}
 */
async function fileExists(storagePath) {
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(path.dirname(storagePath), {
        search: path.basename(storagePath),
      });

    return !error && data && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * 저장소 통계 조회
 * @returns {Promise<{totalFiles: number, totalSize: number, provider: string}>}
 */
async function getStorageStats() {
  if (!supabase) {
    return {
      totalFiles: 0,
      totalSize: 0,
      totalSizeMB: '0.00',
      provider: STORAGE_PROVIDER,
      status: 'not_configured',
    };
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('documents', {
        limit: 1000,
      });

    if (error) {
      throw error;
    }

    const totalFiles = data?.length || 0;
    const totalSize = data?.reduce((sum, file) => sum + (file.metadata?.size || 0), 0) || 0;

    return {
      totalFiles,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      provider: STORAGE_PROVIDER,
      bucketName: BUCKET_NAME,
      status: 'active',
    };
  } catch (error) {
    console.error('[Storage] Stats error:', error);
    return {
      totalFiles: 0,
      totalSize: 0,
      totalSizeMB: '0.00',
      provider: STORAGE_PROVIDER,
      status: 'error',
      error: error.message,
    };
  }
}

module.exports = {
  saveToStorage,
  readFromStorage,
  deleteFromStorage,
  fileExists,
  getStorageStats,
  BUCKET_NAME,
  STORAGE_PROVIDER,
};
