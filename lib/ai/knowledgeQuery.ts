/**
 * Knowledge Base Query Functions (With Auto-Renewal)
 * - 채팅 API에서 사용하는 함수
 * - 만료된 Gemini 파일 자동 갱신
 * - @google/generative-ai/server import 없이 동작
 */

import { prisma } from "@/lib/prisma";

// RPA Worker URL (Smart Renewal용)
const RPA_WORKER_URL = process.env.RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';

/**
 * Gemini 캐시가 유효한지 확인
 * - 버퍼를 60분으로 설정하여 만료 직전 파일 사용 방지
 */
function isGeminiCacheValid(expiresAt: Date | null, bufferMinutes: number = 60): boolean {
  if (!expiresAt) return false;
  const now = new Date();
  const bufferMs = bufferMinutes * 60 * 1000;
  return new Date(expiresAt).getTime() - bufferMs > now.getTime();
}

/**
 * 만료된 Gemini 캐시 갱신 (RPA Worker 호출)
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
    console.warn(`[Knowledge] 갱신 불가 - storagePath 없음: ${document.id}`);
    return null;
  }

  try {
    console.log(`[Knowledge] Gemini 캐시 갱신 시작: ${document.title || document.fileName}`);

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

    if (!response.ok) {
      console.error(`[Knowledge] 갱신 API 오류: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      console.error(`[Knowledge] 갱신 실패: ${data.error}`);
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

    console.log(`[Knowledge] 캐시 갱신 완료: ${document.title} (만료: ${data.expiresAt})`);

    return {
      fileUri: data.fileUri,
      mimeType: data.mimeType,
      expiresAt: new Date(data.expiresAt),
    };

  } catch (error) {
    console.error(`[Knowledge] 갱신 오류: ${document.id}`, error);
    return null;
  }
}

/**
 * 활성 문서 목록 조회 (Auto-Renewal 포함)
 * - DB 조회 실패 시 빈 배열 반환 (채팅 계속 진행)
 */
export async function getActiveKnowledgeDocuments(category?: string): Promise<Array<{
  id: string;
  title: string;
  category: string | null;
  fileUri: string;
  mimeType: string;
  expiresAt: Date | null;
}>> {
  try {
    const where: Record<string, unknown> = {
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
    // geminiFileUri가 없는 문서는 건너뜀
    if (!doc.geminiFileUri || !doc.geminiMimeType) {
      console.warn(`[Knowledge] Gemini URI 없음 - 건너뜀: ${doc.title}`);
      continue;
    }

    // 캐시 유효성 확인
    if (!isGeminiCacheValid(doc.geminiExpiresAt)) {
      console.log(`[Knowledge] 캐시 만료됨: ${doc.title} (만료: ${doc.geminiExpiresAt})`);

      // 자동 갱신 시도
      const renewed = await renewGeminiCache({
        id: doc.id,
        storagePath: doc.storagePath,
        fileName: doc.fileName,
        title: doc.title,
      });

      if (renewed) {
        // 갱신 성공 - 새 URI 사용
        activeDocuments.push({
          id: doc.id,
          title: doc.title || "제목 없음",
          category: doc.category,
          fileUri: renewed.fileUri,
          mimeType: renewed.mimeType,
          expiresAt: renewed.expiresAt,
        });
      } else {
        // 갱신 실패 - 이 문서만 건너뜀 (전체 에러 아님!)
        console.warn(`[Knowledge] 갱신 실패로 건너뜀: ${doc.title}`);
      }
      continue;
    }

    // 캐시 유효 - 그대로 사용
    activeDocuments.push({
      id: doc.id,
      title: doc.title || "제목 없음",
      category: doc.category,
      fileUri: doc.geminiFileUri,
      mimeType: doc.geminiMimeType,
      expiresAt: doc.geminiExpiresAt,
    });
  }

    console.log(`[Knowledge] 총 ${documents.length}개 중 유효한 문서 ${activeDocuments.length}개`);
    return activeDocuments;
  } catch (error) {
    console.error("[Knowledge] getActiveKnowledgeDocuments 오류:", error);
    return [];
  }
}

/**
 * 채팅 컨텍스트에 지식베이스 문서 추가
 * - 만료된 파일은 자동 갱신 또는 제외
 * - 절대 전체 에러를 발생시키지 않음
 */
export async function getKnowledgeContext(
  category?: string,
  maxDocuments: number = 3
): Promise<{
  fileParts: Array<{ fileData: { fileUri: string; mimeType: string } }>;
  documentTitles: string[];
}> {
  try {
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
  } catch (error) {
    // 어떤 오류가 발생해도 빈 결과 반환 (채팅은 계속 진행)
    console.error("[Knowledge] getKnowledgeContext 오류:", error);
    return {
      fileParts: [],
      documentTitles: [],
    };
  }
}
