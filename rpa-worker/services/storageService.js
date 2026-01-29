/**
 * =============================================================================
 * Storage Service (The Vault)
 * =============================================================================
 * 영구 저장소 관리 서비스
 * - 모든 파일은 Gemini 업로드 전에 먼저 여기에 저장
 * - 추후 AWS S3, GCS로 확장 가능한 구조
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 저장소 기본 경로
const STORAGE_BASE = process.env.STORAGE_PATH || path.join(__dirname, '../data/storage');

// 저장소 디렉토리 확인 및 생성
function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_BASE)) {
    fs.mkdirSync(STORAGE_BASE, { recursive: true });
    console.log(`[Storage] Created storage directory: ${STORAGE_BASE}`);
  }
}

/**
 * 고유한 파일 ID 생성
 * @param {string} originalName - 원본 파일명
 * @returns {string} 고유 ID
 */
function generateFileId(originalName) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName).toLowerCase();
  return `${timestamp}_${random}${ext}`;
}

/**
 * 파일을 영구 저장소에 저장
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} originalName - 원본 파일명
 * @returns {Promise<{fileId: string, storagePath: string, fileSize: number}>}
 */
async function saveToStorage(buffer, originalName) {
  ensureStorageDir();

  const fileId = generateFileId(originalName);
  const storagePath = path.join(STORAGE_BASE, fileId);

  await fs.promises.writeFile(storagePath, buffer);

  console.log(`[Storage] Saved file: ${originalName} -> ${fileId} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  return {
    fileId,
    storagePath: fileId, // 상대 경로로 저장 (S3 마이그레이션 용이)
    absolutePath: storagePath,
    fileSize: buffer.length,
  };
}

/**
 * 저장소에서 파일 읽기
 * @param {string} storagePath - 저장 경로 (상대 경로)
 * @returns {Promise<Buffer>} 파일 버퍼
 */
async function readFromStorage(storagePath) {
  const absolutePath = path.join(STORAGE_BASE, storagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${storagePath}`);
  }

  const buffer = await fs.promises.readFile(absolutePath);
  console.log(`[Storage] Read file: ${storagePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  return buffer;
}

/**
 * 저장소에서 파일 삭제
 * @param {string} storagePath - 저장 경로
 */
async function deleteFromStorage(storagePath) {
  const absolutePath = path.join(STORAGE_BASE, storagePath);

  if (fs.existsSync(absolutePath)) {
    await fs.promises.unlink(absolutePath);
    console.log(`[Storage] Deleted file: ${storagePath}`);
  }
}

/**
 * 파일 존재 여부 확인
 * @param {string} storagePath - 저장 경로
 * @returns {boolean}
 */
function fileExists(storagePath) {
  const absolutePath = path.join(STORAGE_BASE, storagePath);
  return fs.existsSync(absolutePath);
}

/**
 * 저장소 통계 조회
 * @returns {Promise<{totalFiles: number, totalSize: number}>}
 */
async function getStorageStats() {
  ensureStorageDir();

  const files = await fs.promises.readdir(STORAGE_BASE);
  let totalSize = 0;

  for (const file of files) {
    const filePath = path.join(STORAGE_BASE, file);
    const stat = await fs.promises.stat(filePath);
    totalSize += stat.size;
  }

  return {
    totalFiles: files.length,
    totalSize,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    storagePath: STORAGE_BASE,
  };
}

module.exports = {
  saveToStorage,
  readFromStorage,
  deleteFromStorage,
  fileExists,
  getStorageStats,
  STORAGE_BASE,
};
