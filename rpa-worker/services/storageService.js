/**
 * =============================================================================
 * Storage Service (The Vault) - Supabase Storage
 * =============================================================================
 * 영구 저장소 관리 서비스
 * - Supabase Storage를 사용한 영구 파일 보관
 * - 재배포/서버 재시작에도 파일 유지
 * - 100MB 이상 대용량 파일 지원
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

// Supabase 클라이언트 초기화
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://upywunyzmblstbdleeio.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

let supabase = null;

function getSupabaseClient() {
  if (!supabase && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[Storage] Supabase client initialized');
  }
  return supabase;
}

// 저장소 버킷 이름 (지침에 따라 admini-knowledge)
const BUCKET_NAME = 'admini-knowledge';
const STORAGE_PROVIDER = 'supabase';

/**
 * UUID 생성
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * 버킷 존재 확인 및 생성
 */
async function ensureBucket() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not initialized. Set SUPABASE_SERVICE_KEY.');
  }

  try {
    const { data: buckets, error: listError } = await client.storage.listBuckets();

    if (listError) {
      console.error('[Storage] List buckets error:', listError);
      throw listError;
    }

    const exists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!exists) {
      console.log(`[Storage] Creating bucket: ${BUCKET_NAME}`);
      const { error: createError } = await client.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 500 * 1024 * 1024, // 500MB
      });

      if (createError && !createError.message?.includes('already exists')) {
        console.error('[Storage] Create bucket error:', createError);
        throw createError;
      }
    }

    return true;
  } catch (error) {
    console.error('[Storage] Bucket setup error:', error);
    throw error;
  }
}

/**
 * 파일을 Supabase Storage에 저장
 */
async function saveToStorage(buffer, originalName) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not initialized. Set SUPABASE_SERVICE_KEY env var.');
  }

  await ensureBucket();

  // 경로 형식: knowledge/{uuid}/{uuid}.{ext}
  // 한글 파일명은 Supabase Storage key에서 지원하지 않으므로 UUID로 대체
  const uuid = generateUUID();
  const ext = path.extname(originalName).toLowerCase() || '.pdf';
  const storagePath = `knowledge/${uuid}/${uuid}${ext}`;

  console.log(`[Storage] Uploading: ${originalName} -> ${storagePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  // MIME 타입 추출
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

  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[Storage] Upload error:', error);
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }

  console.log(`[Storage] Saved: ${storagePath}`);

  return {
    uuid,
    storagePath,
    storageProvider: STORAGE_PROVIDER,
    storageType: 'supabase',
    fileSize: buffer.length,
    originalName,
  };
}

/**
 * Supabase Storage에서 파일 읽기
 */
async function readFromStorage(storagePath) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not initialized');
  }

  console.log(`[Storage] Reading: ${storagePath}`);

  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) {
    console.error('[Storage] Download error:', error);
    throw new Error(`파일 다운로드 실패: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`[Storage] Read: ${storagePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  return buffer;
}

/**
 * Supabase Storage에서 파일 삭제
 */
async function deleteFromStorage(storagePath) {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error('[Storage] Delete error:', error);
  } else {
    console.log(`[Storage] Deleted: ${storagePath}`);
  }
}

/**
 * 파일 존재 여부 확인
 */
async function fileExists(storagePath) {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const dir = path.dirname(storagePath);
    const filename = path.basename(storagePath);

    const { data } = await client.storage
      .from(BUCKET_NAME)
      .list(dir, { search: filename });

    return data && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * 저장소 통계 조회
 */
async function getStorageStats() {
  const client = getSupabaseClient();

  if (!client) {
    return {
      totalFiles: 0,
      totalSize: 0,
      totalSizeMB: '0.00',
      provider: STORAGE_PROVIDER,
      status: 'not_configured',
      message: 'SUPABASE_SERVICE_KEY not set',
    };
  }

  try {
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .list('knowledge', { limit: 1000 });

    if (error) throw error;

    const totalFiles = data?.length || 0;
    // Note: Supabase list doesn't return file sizes easily, would need separate calls

    return {
      totalFiles,
      provider: STORAGE_PROVIDER,
      bucketName: BUCKET_NAME,
      status: 'active',
    };
  } catch (error) {
    return {
      totalFiles: 0,
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
