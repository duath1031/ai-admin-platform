/**
 * =============================================================================
 * Gemini File API Service (Long Context)
 * =============================================================================
 * Google File API를 사용한 대용량 문서 업로드
 * NotebookLM과 동일한 방식 - 임베딩 불필요, 10초 이내 완료
 */

const { GoogleAIFileManager, FileState } = require("@google/generative-ai/server");
const fs = require('fs');
const path = require('path');
const os = require('os');

// File Manager 인스턴스
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_AI_API_KEY || "");

// 지원 파일 형식
const SUPPORTED_MIME_TYPES = {
  "pdf": "application/pdf",
  "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "doc": "application/msword",
  "txt": "text/plain",
  "html": "text/html",
  "csv": "text/csv",
  "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "hwp": "application/x-hwp",
};

/**
 * 파일을 Google File API에 업로드
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} fileName - 파일명
 * @param {string} displayName - 표시명
 * @returns {Promise<Object>} 업로드 결과
 */
async function uploadToGemini(buffer, fileName, displayName) {
  // 파일 확장자에서 MIME 타입 추출
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeType = SUPPORTED_MIME_TYPES[ext];

  if (!mimeType) {
    throw new Error(`지원하지 않는 파일 형식입니다: ${ext}`);
  }

  // 임시 파일로 저장 (File API는 파일 경로 필요)
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `gemini_upload_${Date.now()}_${fileName}`);

  try {
    fs.writeFileSync(tempPath, buffer);

    console.log(`[Gemini File] Uploading: ${fileName} (${mimeType})`);

    const uploadResponse = await fileManager.uploadFile(tempPath, {
      mimeType: mimeType,
      displayName: displayName || fileName,
    });

    console.log(`[Gemini File] Upload complete: ${uploadResponse.file.uri}`);

    // 파일이 ACTIVE 상태가 될 때까지 대기
    let file = await fileManager.getFile(uploadResponse.file.name);
    let waitCount = 0;
    const maxWait = 30; // 최대 60초 대기

    while (file.state === FileState.PROCESSING) {
      console.log(`[Gemini File] Processing... (${waitCount * 2}s)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      file = await fileManager.getFile(uploadResponse.file.name);
      waitCount++;

      if (waitCount >= maxWait) {
        throw new Error('파일 처리 시간 초과 (60초)');
      }
    }

    if (file.state === FileState.FAILED) {
      throw new Error(`파일 처리 실패: ${file.name}`);
    }

    // 만료 시간 계산 (48시간)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    return {
      fileUri: file.uri,
      mimeType: file.mimeType,
      name: file.name,
      displayName: file.displayName || fileName,
      state: String(file.state),
      expiresAt: expiresAt.toISOString(),
    };
  } finally {
    // 임시 파일 삭제
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

/**
 * Google File API에서 파일 삭제
 * @param {string} fileName - Google 파일명
 */
async function deleteFromGemini(fileName) {
  try {
    await fileManager.deleteFile(fileName);
    console.log(`[Gemini File] Deleted: ${fileName}`);
  } catch (error) {
    console.error(`[Gemini File] Delete failed: ${fileName}`, error.message);
    // 삭제 실패해도 진행 (이미 만료되었을 수 있음)
  }
}

/**
 * 파일 상태 확인
 * @param {string} fileName - Google 파일명
 */
async function getFileStatus(fileName) {
  try {
    const file = await fileManager.getFile(fileName);
    return {
      state: String(file.state),
      uri: file.uri,
      mimeType: file.mimeType,
    };
  } catch (error) {
    return {
      state: "NOT_FOUND",
      error: error.message,
    };
  }
}

/**
 * 업로드된 파일 목록 조회
 */
async function listGeminiFiles() {
  const response = await fileManager.listFiles();
  return response.files?.map(file => ({
    name: file.name,
    displayName: file.displayName || file.name,
    mimeType: file.mimeType,
    state: String(file.state),
    uri: file.uri,
  })) || [];
}

module.exports = {
  uploadToGemini,
  deleteFromGemini,
  getFileStatus,
  listGeminiFiles,
  SUPPORTED_MIME_TYPES,
};
