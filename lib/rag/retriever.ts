/**
 * =============================================================================
 * Knowledge Base Retriever
 * =============================================================================
 * RAG 파이프라인의 검색(Retrieval) 단계 구현
 * - 사용자 질문에서 관련 지식 검색
 * - 검색 결과를 컨텍스트로 포맷팅
 */

import { searchSimilar, VectorSearchResult, getVectorStats } from "./vectorStore";

// 검색 설정
const DEFAULT_TOP_K = 5;
const DEFAULT_THRESHOLD = 0.5;

// 검색 결과 타입
export interface RetrievalResult {
  success: boolean;
  query: string;
  results: VectorSearchResult[];
  context: string;           // 프롬프트에 삽입할 컨텍스트
  metadata: {
    totalFound: number;
    avgSimilarity: number;
    sources: string[];       // 출처 문서 목록
  };
  error?: string;
}

/**
 * 질문에 대한 관련 지식 검색
 */
export async function retrieveKnowledge(
  query: string,
  options: {
    topK?: number;
    threshold?: number;
    category?: string;
  } = {}
): Promise<RetrievalResult> {
  const { topK = DEFAULT_TOP_K, threshold = DEFAULT_THRESHOLD, category } = options;

  try {
    // 벡터 검색 수행
    const results = await searchSimilar(query, topK, threshold, category);

    if (results.length === 0) {
      return {
        success: true,
        query,
        results: [],
        context: "",
        metadata: {
          totalFound: 0,
          avgSimilarity: 0,
          sources: [],
        },
      };
    }

    // 검색 결과를 컨텍스트로 포맷팅
    const context = formatResultsAsContext(results);

    // 메타데이터 계산
    const avgSimilarity = results.reduce((a, r) => a + r.similarity, 0) / results.length;
    const sources = [...new Set(results.map(r => r.document?.fileName || "Unknown"))];

    return {
      success: true,
      query,
      results,
      context,
      metadata: {
        totalFound: results.length,
        avgSimilarity: Math.round(avgSimilarity * 100) / 100,
        sources,
      },
    };
  } catch (error) {
    console.error("[Retriever] Search error:", error);
    return {
      success: false,
      query,
      results: [],
      context: "",
      metadata: {
        totalFound: 0,
        avgSimilarity: 0,
        sources: [],
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 검색 결과를 프롬프트 컨텍스트로 포맷팅
 */
function formatResultsAsContext(results: VectorSearchResult[]): string {
  if (results.length === 0) {
    return "";
  }

  const sections: string[] = [];

  // 문서별로 그룹화
  const byDocument = new Map<string, VectorSearchResult[]>();
  for (const result of results) {
    const docId = result.documentId;
    if (!byDocument.has(docId)) {
      byDocument.set(docId, []);
    }
    byDocument.get(docId)!.push(result);
  }

  // 각 문서별로 포맷팅
  for (const [docId, docResults] of byDocument) {
    const doc = docResults[0].document;
    const docTitle = doc?.title || doc?.fileName || "참고 문서";
    const category = doc?.category ? ` (${doc.category})` : "";

    sections.push(`### ${docTitle}${category}`);

    // 청크 순서대로 정렬
    docResults.sort((a, b) => a.chunkIndex - b.chunkIndex);

    for (const result of docResults) {
      const pageInfo = result.pageNumber ? ` [p.${result.pageNumber}]` : "";
      const sectionInfo = result.sectionTitle ? ` - ${result.sectionTitle}` : "";
      const similarity = Math.round(result.similarity * 100);

      sections.push(`${pageInfo}${sectionInfo} (관련도: ${similarity}%)`);
      sections.push(result.content);
      sections.push(""); // 빈 줄 추가
    }
  }

  return sections.join("\n");
}

/**
 * 채팅 API용 RAG 컨텍스트 생성
 * - 기존 시스템 프롬프트에 [참고 자료] 섹션 추가
 */
export async function getRAGContext(
  query: string,
  options: {
    topK?: number;
    threshold?: number;
    category?: string;
  } = {}
): Promise<string> {
  const result = await retrieveKnowledge(query, options);

  if (!result.success || result.results.length === 0) {
    return "";
  }

  // [참고 자료] 섹션으로 포맷팅
  const header = `\n\n[참고 자료 - Knowledge Base]\n`;
  const sourcesInfo = `출처: ${result.metadata.sources.join(", ")}\n`;
  const separator = "---\n";

  return header + sourcesInfo + separator + result.context + separator;
}

/**
 * 질문이 Knowledge Base 검색이 필요한지 판단
 */
export function shouldSearchKnowledge(message: string): boolean {
  // 일반적인 인사나 단순 질문은 제외
  const skipPatterns = [
    /^(안녕|하이|헬로|hi|hello)/i,
    /^(감사|고마워|땡큐|thanks)/i,
    /^(네|아니|예|응|음)/,
    /^(ㅋ+|ㅎ+|ㅠ+)/,
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(message.trim())) {
      return false;
    }
  }

  // 최소 길이 체크
  if (message.trim().length < 5) {
    return false;
  }

  // 질문 형태인지 체크 (물음표, 의문사 등)
  const questionIndicators = [
    "?",
    "어떻게",
    "무엇",
    "뭐",
    "언제",
    "어디",
    "왜",
    "누가",
    "얼마",
    "방법",
    "절차",
    "필요",
    "가능",
    "해야",
    "하려면",
    "알려",
    "설명",
    "질문",
  ];

  return questionIndicators.some(indicator => message.includes(indicator));
}

/**
 * Knowledge Base 상태 확인
 */
export async function checkKnowledgeBaseStatus(): Promise<{
  available: boolean;
  stats: {
    totalChunks: number;
    chunksWithEmbedding: number;
    totalDocuments: number;
  };
}> {
  try {
    const stats = await getVectorStats();
    return {
      available: stats.chunksWithEmbedding > 0,
      stats,
    };
  } catch (error) {
    console.error("[Retriever] Status check failed:", error);
    return {
      available: false,
      stats: {
        totalChunks: 0,
        chunksWithEmbedding: 0,
        totalDocuments: 0,
      },
    };
  }
}
