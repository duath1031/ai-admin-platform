/**
 * =============================================================================
 * Google Text Embedding Service (JS Version)
 * =============================================================================
 * Google text-embedding-004 모델을 사용한 텍스트 임베딩 생성
 * - 768차원 벡터 출력
 * - 한국어 지원 우수
 *
 * TypeScript 버전(lib/rag/embeddings.ts)에서 포팅
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// 임베딩 모델 설정
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSION = 768;

// 배치 처리 설정
const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 100; // ms between batches

let genAI = null;

/**
 * Google AI 클라이언트 초기화
 */
function initializeClient() {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * 단일 텍스트 임베딩 생성
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function generateEmbedding(text) {
  try {
    const client = initializeClient();
    const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

    const result = await model.embedContent(text);
    const embedding = result.embedding.values;

    if (embedding.length !== EMBEDDING_DIMENSION) {
      console.warn(`[Embedding] Unexpected dimension: ${embedding.length} (expected ${EMBEDDING_DIMENSION})`);
    }

    return embedding;
  } catch (error) {
    console.error('[Embedding] Error generating embedding:', error);
    throw error;
  }
}

/**
 * 배치 임베딩 생성 (여러 텍스트를 한 번에)
 * @param {string[]} texts
 * @param {function} onProgress - 진행 콜백 (optional)
 * @returns {Promise<number[][]>}
 */
async function generateEmbeddings(texts, onProgress = null) {
  const embeddings = [];

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

    const processed = Math.min(i + BATCH_SIZE, texts.length);
    console.log(`[Embedding] Processed ${processed}/${texts.length} texts`);

    if (onProgress) {
      onProgress({
        processed,
        total: texts.length,
        percentage: Math.round((processed / texts.length) * 100),
      });
    }
  }

  return embeddings;
}

/**
 * 쿼리용 임베딩 생성 (검색 최적화)
 * @param {string} query
 * @returns {Promise<number[]>}
 */
async function generateQueryEmbedding(query) {
  // 쿼리에 검색 의도 프리픽스 추가 (검색 품질 향상)
  const enhancedQuery = `검색 쿼리: ${query}`;
  return generateEmbedding(enhancedQuery);
}

/**
 * 임베딩 차원 반환
 * @returns {number}
 */
function getEmbeddingDimension() {
  return EMBEDDING_DIMENSION;
}

/**
 * 코사인 유사도 계산 (벡터 비교용)
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
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

/**
 * 벡터를 PostgreSQL pgvector 형식으로 변환
 * @param {number[]} embedding
 * @returns {string}
 */
function toPgVector(embedding) {
  return `[${embedding.join(',')}]`;
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  generateQueryEmbedding,
  getEmbeddingDimension,
  cosineSimilarity,
  toPgVector,
  EMBEDDING_DIMENSION,
};
