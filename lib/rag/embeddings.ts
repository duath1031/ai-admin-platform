/**
 * =============================================================================
 * Google Text Embedding Service
 * =============================================================================
 * Google text-embedding-004 모델을 사용한 텍스트 임베딩 생성
 * - 768차원 벡터 출력
 * - 한국어 지원 우수
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

// 임베딩 모델 (text-embedding-004)
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSION = 768;

// 배치 처리 설정
const BATCH_SIZE = 100; // Google API 배치 제한
const RATE_LIMIT_DELAY = 100; // ms between batches

/**
 * 단일 텍스트 임베딩 생성
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    const result = await model.embedContent(text);
    const embedding = result.embedding.values;

    if (embedding.length !== EMBEDDING_DIMENSION) {
      console.warn(`[Embedding] Unexpected dimension: ${embedding.length} (expected ${EMBEDDING_DIMENSION})`);
    }

    return embedding;
  } catch (error) {
    console.error("[Embedding] Error generating embedding:", error);
    throw error;
  }
}

/**
 * 배치 임베딩 생성 (여러 텍스트를 한 번에)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  // 배치 단위로 처리
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(text => generateEmbedding(text));
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);

    // Rate limiting
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }

    console.log(`[Embedding] Processed ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length} texts`);
  }

  return embeddings;
}

/**
 * 쿼리용 임베딩 생성 (검색 최적화)
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  // 쿼리에 검색 의도 프리픽스 추가 (검색 품질 향상)
  const enhancedQuery = `검색 쿼리: ${query}`;
  return generateEmbedding(enhancedQuery);
}

/**
 * 임베딩 차원 반환
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIMENSION;
}

/**
 * 코사인 유사도 계산 (벡터 비교용)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same dimension");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
