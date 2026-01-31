/**
 * Knowledge Base Query Functions (With Auto-Renewal)
 * - 채팅 API에서 사용하는 함수
 * - 만료된 Gemini 파일 자동 갱신
 * - @google/generative-ai/server import 없이 동작
 */

import { prisma } from "@/lib/prisma";

// RPA Worker URL (Smart Renewal용)
const RPA_WORKER_URL = process.env.RPA_WORKER_URL || process.env.NEXT_PUBLIC_RPA_URL || 'https://admini-rpa-worker-production.up.railway.app';
const WORKER_API_KEY = process.env.RPA_WORKER_API_KEY || process.env.WORKER_API_KEY || '';

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

/**
 * Fast Knowledge Context (채팅 요청 전용 - 자동 갱신 없음)
 * - DB WHERE 조건으로 만료 전 문서만 조회 (geminiExpiresAt > NOW + 30분 버퍼)
 * - 네트워크 호출 0회, DB 쿼리 1회만 실행
 * - 만료된 문서는 건너뜀 (별도 관리자 재업로드 또는 cron으로 처리)
 * - 예상 소요: 50~100ms
 */
export async function getKnowledgeContextFast(
  category?: string,
  maxDocuments: number = 1
): Promise<{
  fileParts: Array<{ fileData: { fileUri: string; mimeType: string } }>;
  documentTitles: string[];
  documentTags: string[][];
}> {
  try {
    const bufferMs = 30 * 60 * 1000;
    const cutoffTime = new Date(Date.now() + bufferMs);

    const where: Record<string, unknown> = {
      status: "completed",
      processingMode: "gemini_file",
      geminiFileUri: { not: null },
      geminiMimeType: { not: null },
      geminiExpiresAt: { gt: cutoffTime },
    };

    if (category) {
      where.category = category;
    }

    const documents = await prisma.knowledgeDocument.findMany({
      where,
      select: {
        id: true,
        title: true,
        tags: true,
        geminiFileUri: true,
        geminiMimeType: true,
      },
      orderBy: { updatedAt: "desc" },
      take: maxDocuments,
    });

    console.log(`[Knowledge Fast] 유효 문서 ${documents.length}개 (카테고리: ${category || '전체'}, 최대: ${maxDocuments})`);

    return {
      fileParts: documents.map(doc => ({
        fileData: {
          fileUri: doc.geminiFileUri!,
          mimeType: doc.geminiMimeType!,
        },
      })),
      documentTitles: documents.map(doc => doc.title || "제목 없음"),
      documentTags: documents.map(doc => parseTags(doc.tags)),
    };
  } catch (error) {
    console.error("[Knowledge Fast] DB 쿼리 오류:", error);
    return {
      fileParts: [],
      documentTitles: [],
      documentTags: [],
    };
  }
}

// =============================================================================
// Smart Tag 기반 검색 (Phase 2)
// =============================================================================

/** JSON 문자열로 저장된 tags를 배열로 파싱 */
function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 태그 기반 지식베이스 검색 (Smart Tag Search)
 * - 사용자 질문에서 추출한 키워드를 DB의 tags 필드와 매칭
 * - 카테고리 제약 없이 태그 매칭으로 관련 문서 검색
 * - 예상 소요: 50~150ms
 */
export async function getKnowledgeByTags(
  keywords: string[],
  maxDocuments: number = 5
): Promise<{
  fileParts: Array<{ fileData: { fileUri: string; mimeType: string } }>;
  documentTitles: string[];
  documentTags: string[][];
  matchScores: number[];
}> {
  try {
    if (keywords.length === 0) {
      return { fileParts: [], documentTitles: [], documentTags: [], matchScores: [] };
    }

    const bufferMs = 30 * 60 * 1000;
    const cutoffTime = new Date(Date.now() + bufferMs);

    // 유효한 모든 문서를 가져와서 태그 매칭 (tags 필드가 String이므로 앱 레벨에서 필터링)
    const documents = await prisma.knowledgeDocument.findMany({
      where: {
        status: "completed",
        processingMode: "gemini_file",
        geminiFileUri: { not: null },
        geminiMimeType: { not: null },
        geminiExpiresAt: { gt: cutoffTime },
        tags: { not: null },
      },
      select: {
        id: true,
        title: true,
        tags: true,
        category: true,
        geminiFileUri: true,
        geminiMimeType: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // 태그 매칭 점수 계산
    const scored = documents.map(doc => {
      const docTags = parseTags(doc.tags);
      const titleLower = (doc.title || "").toLowerCase();
      let matchCount = 0;

      for (const keyword of keywords) {
        const kw = keyword.toLowerCase();
        // 태그에 키워드가 포함되어 있는지 확인 (부분 일치)
        if (docTags.some(tag => tag.toLowerCase().includes(kw) || kw.includes(tag.toLowerCase()))) {
          matchCount++;
        }
        // 제목에도 키워드가 포함되어 있는지 확인 (보조)
        if (titleLower.includes(kw)) {
          matchCount += 0.5;
        }
      }

      const score = keywords.length > 0 ? matchCount / keywords.length : 0;

      return { doc, docTags, score };
    });

    // 점수 내림차순 정렬, 0점 제외
    const filtered = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxDocuments);

    console.log(`[Knowledge Tags] 키워드 [${keywords.join(", ")}] → ${filtered.length}/${documents.length}개 매칭`);
    if (filtered.length > 0) {
      console.log(`[Knowledge Tags] 상위 매칭: ${filtered.map(f => `${f.doc.title}(${f.score.toFixed(2)})`).join(", ")}`);
    }

    return {
      fileParts: filtered.map(f => ({
        fileData: {
          fileUri: f.doc.geminiFileUri!,
          mimeType: f.doc.geminiMimeType!,
        },
      })),
      documentTitles: filtered.map(f => f.doc.title || "제목 없음"),
      documentTags: filtered.map(f => f.docTags),
      matchScores: filtered.map(f => f.score),
    };
  } catch (error) {
    console.error("[Knowledge Tags] 태그 검색 오류:", error);
    return { fileParts: [], documentTitles: [], documentTags: [], matchScores: [] };
  }
}
