/**
 * Gemini File API 래퍼 (Long Context 방식)
 *
 * NotebookLM과 동일한 방식으로 대용량 문서를 처리합니다.
 * - 임베딩/청킹 없이 전체 파일을 Gemini에 직접 전달
 * - 파일은 Google 서버에 48시간 동안 저장됨
 * - 50MB+ 파일도 빠르게 처리 가능
 */

import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// File Manager 인스턴스
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_AI_API_KEY || "");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

// 지원 파일 형식
export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  "pdf": "application/pdf",
  "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "doc": "application/msword",
  "txt": "text/plain",
  "html": "text/html",
  "csv": "text/csv",
  "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "hwp": "application/x-hwp", // HWP는 지원 안될 수 있음
  "hwpx": "application/hwp+zip",
};

// 최대 파일 크기 (100MB - Gemini File API 제한)
export const MAX_FILE_SIZE_MB = 100;

/**
 * 파일을 Google File API에 업로드
 */
export async function uploadToGemini(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  displayName?: string
): Promise<{
  fileUri: string;
  mimeType: string;
  name: string;
  displayName: string;
  expiresAt: Date;
}> {
  // 임시 파일로 저장 (File API는 파일 경로 필요)
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `gemini_upload_${Date.now()}_${fileName}`);

  try {
    fs.writeFileSync(tempPath, fileBuffer);

    console.log(`[Knowledge] Uploading to Gemini: ${fileName} (${mimeType})`);

    const uploadResponse = await fileManager.uploadFile(tempPath, {
      mimeType: mimeType,
      displayName: displayName || fileName,
    });

    console.log(`[Knowledge] Upload complete: ${uploadResponse.file.uri}`);

    // 파일이 ACTIVE 상태가 될 때까지 대기
    let file = await fileManager.getFile(uploadResponse.file.name);
    while (file.state === FileState.PROCESSING) {
      console.log(`[Knowledge] Processing file... state: ${file.state}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      file = await fileManager.getFile(uploadResponse.file.name);
    }

    if (file.state === FileState.FAILED) {
      throw new Error(`File processing failed: ${file.name}`);
    }

    // 만료 시간 계산 (48시간)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    return {
      fileUri: file.uri,
      mimeType: file.mimeType,
      name: file.name,
      displayName: file.displayName || fileName,
      expiresAt,
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
 */
export async function deleteFromGemini(fileName: string): Promise<void> {
  try {
    await fileManager.deleteFile(fileName);
    console.log(`[Knowledge] Deleted from Gemini: ${fileName}`);
  } catch (error) {
    console.error(`[Knowledge] Failed to delete from Gemini: ${fileName}`, error);
    // 삭제 실패해도 진행 (이미 만료되었을 수 있음)
  }
}

/**
 * 업로드된 파일 목록 조회
 */
export async function listGeminiFiles(): Promise<Array<{
  name: string;
  displayName: string;
  mimeType: string;
  state: string;
  uri: string;
}>> {
  const response = await fileManager.listFiles();
  return response.files?.map(file => ({
    name: file.name,
    displayName: file.displayName || file.name,
    mimeType: file.mimeType,
    state: String(file.state),
    uri: file.uri,
  })) || [];
}

/**
 * 파일 상태 확인
 */
export async function getFileStatus(fileName: string): Promise<{
  state: string;
  uri?: string;
  error?: string;
}> {
  try {
    const file = await fileManager.getFile(fileName);
    return {
      state: file.state,
      uri: file.uri,
    };
  } catch (error: any) {
    return {
      state: "NOT_FOUND",
      error: error.message,
    };
  }
}

/**
 * 지식베이스 문서 업로드 (DB 저장 포함)
 */
export async function uploadKnowledgeDocument(
  fileBuffer: Buffer,
  fileName: string,
  options: {
    title?: string;
    category?: string;
    description?: string;
    uploadedBy?: string;
  } = {}
): Promise<{
  documentId: string;
  fileUri: string;
  status: string;
}> {
  // 파일 확장자에서 MIME 타입 추출
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeType = SUPPORTED_MIME_TYPES[ext];

  if (!mimeType) {
    throw new Error(`지원하지 않는 파일 형식입니다: ${ext}`);
  }

  // 파일 크기 확인
  const fileSizeMB = fileBuffer.length / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE_MB}MB까지 지원합니다.`);
  }

  // DB에 문서 레코드 생성 (pending 상태)
  const document = await prisma.knowledgeDocument.create({
    data: {
      fileName,
      fileType: ext,
      fileSize: fileBuffer.length,
      title: options.title || fileName,
      category: options.category,
      description: options.description,
      uploadedBy: options.uploadedBy,
      status: "uploading",
      processingMode: "gemini_file",
    },
  });

  try {
    // Google File API에 업로드
    const uploadResult = await uploadToGemini(
      fileBuffer,
      fileName,
      mimeType,
      options.title || fileName
    );

    // DB 업데이트
    await prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        geminiFileUri: uploadResult.fileUri,
        geminiMimeType: uploadResult.mimeType,
        geminiFileName: uploadResult.name,
        geminiExpiresAt: uploadResult.expiresAt,
        status: "completed",
      },
    });

    return {
      documentId: document.id,
      fileUri: uploadResult.fileUri,
      status: "completed",
    };
  } catch (error: any) {
    // 실패 시 DB 업데이트
    await prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        status: "failed",
        errorMessage: error.message,
      },
    });
    throw error;
  }
}

/**
 * 지식베이스 문서 삭제 (DB + Google 파일 삭제)
 */
export async function deleteKnowledgeDocument(documentId: string): Promise<void> {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error("문서를 찾을 수 없습니다.");
  }

  // Google File API에서 삭제
  if (document.geminiFileName) {
    await deleteFromGemini(document.geminiFileName);
  }

  // 관련 청크 삭제 (legacy 데이터)
  await prisma.knowledgeChunk.deleteMany({
    where: { documentId },
  });

  // DB에서 문서 삭제
  await prisma.knowledgeDocument.delete({
    where: { id: documentId },
  });
}

// RPA Worker URL (Smart Renewal용)
const RPA_WORKER_URL = process.env.RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';

/**
 * Gemini 캐시 유효성 확인
 * @param expiresAt - 만료 시간
 * @param bufferMinutes - 안전 마진 (분)
 */
function isGeminiCacheValid(expiresAt: Date | null, bufferMinutes: number = 30): boolean {
  if (!expiresAt) return false;
  const now = new Date();
  const bufferMs = bufferMinutes * 60 * 1000;
  return expiresAt.getTime() - bufferMs > now.getTime();
}

/**
 * 만료된 Gemini 캐시 갱신 (Smart Renewal)
 * - RPA Worker의 영구 저장소에서 파일을 읽어 재업로드
 */
async function renewGeminiCache(document: {
  id: string;
  storagePath: string | null;
  fileName: string;
  title: string | null;
}): Promise<{
  fileUri: string;
  mimeType: string;
  expiresAt: Date;
} | null> {
  if (!document.storagePath) {
    console.warn(`[Knowledge] Cannot renew - no storagePath for document ${document.id}`);
    return null;
  }

  try {
    console.log(`[Knowledge] Renewing Gemini cache for: ${document.id}`);

    const response = await fetch(`${RPA_WORKER_URL}/rag/renew-gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': WORKER_API_KEY,
      },
      body: JSON.stringify({
        storagePath: document.storagePath,
        originalName: document.fileName,
        title: document.title || document.fileName,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      console.error(`[Knowledge] Renewal failed for ${document.id}:`, data.error);
      return null;
    }

    // DB 업데이트
    await prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        geminiFileUri: data.fileUri,
        geminiMimeType: data.mimeType,
        geminiFileName: data.fileName,
        geminiExpiresAt: new Date(data.expiresAt),
        status: "completed",
      },
    });

    console.log(`[Knowledge] Renewed cache for ${document.id}: expires ${data.expiresAt}`);

    return {
      fileUri: data.fileUri,
      mimeType: data.mimeType,
      expiresAt: new Date(data.expiresAt),
    };

  } catch (error) {
    console.error(`[Knowledge] Renewal error for ${document.id}:`, error);
    return null;
  }
}

/**
 * 활성 문서 목록 조회 (Smart Caching 적용)
 * - 만료된 캐시는 자동으로 갱신
 */
export async function getActiveKnowledgeDocuments(category?: string): Promise<Array<{
  id: string;
  title: string;
  category: string | null;
  fileUri: string;
  mimeType: string;
  expiresAt: Date | null;
}>> {
  const where: any = {
    status: "completed",
    processingMode: "gemini_file",
  };

  if (category) {
    where.category = category;
  }

  const documents = await prisma.knowledgeDocument.findMany({
    where,
    select: {
      id: true,
      title: true,
      category: true,
      fileName: true,
      storagePath: true,
      geminiFileUri: true,
      geminiMimeType: true,
      geminiExpiresAt: true,
    },
  });

  const activeDocuments: Array<{
    id: string;
    title: string;
    category: string | null;
    fileUri: string;
    mimeType: string;
    expiresAt: Date | null;
  }> = [];

  for (const doc of documents) {
    // 캐시 유효성 확인
    if (isGeminiCacheValid(doc.geminiExpiresAt)) {
      // HIT: 캐시가 유효함
      activeDocuments.push({
        id: doc.id,
        title: doc.title || "제목 없음",
        category: doc.category,
        fileUri: doc.geminiFileUri!,
        mimeType: doc.geminiMimeType!,
        expiresAt: doc.geminiExpiresAt,
      });
    } else if (doc.storagePath) {
      // MISS: 캐시 만료 - 자동 갱신 시도
      console.log(`[Knowledge] Cache expired for ${doc.id}, attempting renewal...`);
      const renewed = await renewGeminiCache({
        id: doc.id,
        storagePath: doc.storagePath,
        fileName: doc.fileName,
        title: doc.title,
      });

      if (renewed) {
        activeDocuments.push({
          id: doc.id,
          title: doc.title || "제목 없음",
          category: doc.category,
          fileUri: renewed.fileUri,
          mimeType: renewed.mimeType,
          expiresAt: renewed.expiresAt,
        });
      }
    } else {
      // 영구 저장소가 없는 레거시 문서 - 건너뜀
      console.warn(`[Knowledge] Skipping ${doc.id} - no permanent storage`);
    }
  }

  return activeDocuments;
}

/**
 * 만료된 문서 갱신 (48시간 후 재업로드 필요)
 */
export async function refreshExpiredDocuments(): Promise<{
  refreshed: number;
  failed: number;
}> {
  const now = new Date();

  // 만료된 문서 조회
  const expiredDocs = await prisma.knowledgeDocument.findMany({
    where: {
      processingMode: "gemini_file",
      status: "completed",
      geminiExpiresAt: { lt: now },
    },
  });

  let refreshed = 0;
  let failed = 0;

  for (const doc of expiredDocs) {
    // 재업로드 로직은 원본 파일이 필요하므로 상태만 업데이트
    await prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: {
        status: "expired",
        errorMessage: "파일이 만료되었습니다. 재업로드가 필요합니다.",
      },
    });
    failed++;
  }

  return { refreshed, failed };
}

/**
 * 지식베이스를 활용한 Gemini 질의
 * - fileData 파라미터로 문서 URI를 직접 전달
 */
export async function queryWithKnowledge(
  query: string,
  options: {
    category?: string;
    systemPrompt?: string;
    maxDocuments?: number;
    modelName?: string;
  } = {}
): Promise<{
  answer: string;
  sources: Array<{ title: string; id: string }>;
}> {
  const {
    category,
    systemPrompt = "",
    maxDocuments = 5,
    modelName = "gemini-2.0-flash"
  } = options;

  // 활성 문서 조회
  const documents = await getActiveKnowledgeDocuments(category);

  if (documents.length === 0) {
    return {
      answer: "참고할 지식베이스 문서가 없습니다.",
      sources: [],
    };
  }

  // 최대 문서 수 제한
  const selectedDocs = documents.slice(0, maxDocuments);

  // Gemini 모델 생성
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt || "제공된 문서를 참고하여 질문에 정확하게 답변하세요.",
  });

  // fileData 파라미터로 문서 URI 전달
  const fileParts = selectedDocs.map(doc => ({
    fileData: {
      fileUri: doc.fileUri,
      mimeType: doc.mimeType,
    },
  }));

  console.log(`[Knowledge] Querying with ${selectedDocs.length} documents`);

  const result = await model.generateContent([
    ...fileParts,
    { text: query },
  ]);

  const response = result.response;
  const answer = response.text();

  return {
    answer,
    sources: selectedDocs.map(doc => ({
      title: doc.title,
      id: doc.id,
    })),
  };
}

/**
 * 채팅 컨텍스트에 지식베이스 문서 추가
 * - 기존 chatWithGemini와 호환되는 형식으로 반환
 */
export async function getKnowledgeContext(
  category?: string,
  maxDocuments: number = 3
): Promise<{
  fileParts: Array<{ fileData: { fileUri: string; mimeType: string } }>;
  documentTitles: string[];
}> {
  const documents = await getActiveKnowledgeDocuments(category);
  const selectedDocs = documents.slice(0, maxDocuments);

  return {
    fileParts: selectedDocs.map(doc => ({
      fileData: {
        fileUri: doc.fileUri,
        mimeType: doc.mimeType,
      },
    })),
    documentTitles: selectedDocs.map(doc => doc.title),
  };
}

export default {
  uploadToGemini,
  deleteFromGemini,
  listGeminiFiles,
  getFileStatus,
  uploadKnowledgeDocument,
  deleteKnowledgeDocument,
  getActiveKnowledgeDocuments,
  refreshExpiredDocuments,
  queryWithKnowledge,
  getKnowledgeContext,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE_MB,
};
