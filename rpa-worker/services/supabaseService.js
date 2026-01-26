/**
 * =============================================================================
 * Supabase Database Service
 * =============================================================================
 * Supabase(PostgreSQL)에 직접 연결하여 RAG 데이터 저장
 * Prisma 없이 pg 드라이버 사용
 */

const { Pool } = require('pg');

let pool = null;

/**
 * 데이터베이스 연결 풀 초기화
 */
function initializePool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL 또는 SUPABASE_DATABASE_URL 환경변수가 설정되지 않았습니다.');
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Supabase는 SSL 필수
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('[Supabase] Unexpected pool error:', err);
    });
  }

  return pool;
}

/**
 * 데이터베이스 연결 테스트
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const db = initializePool();
    const result = await db.query('SELECT NOW()');
    console.log('[Supabase] Connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('[Supabase] Connection failed:', error);
    return false;
  }
}

/**
 * 지식 문서 생성
 * @param {Object} document
 * @returns {Promise<Object>}
 */
async function createKnowledgeDocument(document) {
  const db = initializePool();

  const {
    title,
    category = 'general',
    fileType = 'pdf',
    originalFileName,
    fileSize,
    totalChunks = 0,
    status = 'processing',
    metadata = {},
  } = document;

  const id = generateUUID();
  const now = new Date().toISOString();

  const query = `
    INSERT INTO "KnowledgeDocument" (
      "id", "title", "category", "fileType", "originalFileName",
      "fileSize", "totalChunks", "status", "metadata", "createdAt", "updatedAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;

  const values = [
    id, title, category, fileType, originalFileName,
    fileSize, totalChunks, status, JSON.stringify(metadata), now, now
  ];

  const result = await db.query(query, values);
  return result.rows[0];
}

/**
 * 지식 문서 상태 업데이트
 * @param {string} documentId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateKnowledgeDocument(documentId, updates) {
  const db = initializePool();

  const setClause = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    const dbKey = key === 'metadata' ? `"${key}"` : `"${key}"`;
    setClause.push(`${dbKey} = $${paramIndex}`);
    values.push(key === 'metadata' ? JSON.stringify(value) : value);
    paramIndex++;
  }

  setClause.push(`"updatedAt" = $${paramIndex}`);
  values.push(new Date().toISOString());
  paramIndex++;

  values.push(documentId);

  const query = `
    UPDATE "KnowledgeDocument"
    SET ${setClause.join(', ')}
    WHERE "id" = $${paramIndex}
    RETURNING *
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

/**
 * 지식 청크 배치 삽입
 * @param {Array} chunks - 청크 배열
 * @param {string} documentId - 문서 ID
 * @returns {Promise<number>} - 삽입된 청크 수
 */
async function insertKnowledgeChunks(chunks, documentId) {
  const db = initializePool();

  if (chunks.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();
  let insertedCount = 0;

  // 배치 단위로 삽입 (100개씩)
  const BATCH_SIZE = 100;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (const chunk of batch) {
      const id = generateUUID();
      const embeddingVector = chunk.embedding
        ? `[${chunk.embedding.join(',')}]`
        : null;

      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`
      );

      values.push(
        id,                                    // id
        documentId,                            // documentId
        chunk.content,                         // content
        chunk.index,                           // chunkIndex
        chunk.pageNumber || null,              // pageNumber
        chunk.sectionTitle || null,            // sectionTitle
        embeddingVector,                       // embedding (pgvector format)
        now,                                   // createdAt
        now                                    // updatedAt
      );

      paramIndex += 9;
    }

    const query = `
      INSERT INTO "KnowledgeChunk" (
        "id", "documentId", "content", "chunkIndex", "pageNumber",
        "sectionTitle", "embedding", "createdAt", "updatedAt"
      )
      VALUES ${placeholders.join(', ')}
    `;

    await db.query(query, values);
    insertedCount += batch.length;

    console.log(`[Supabase] Inserted chunks: ${insertedCount}/${chunks.length}`);
  }

  return insertedCount;
}

/**
 * 문서 청크 수 조회
 * @param {string} documentId
 * @returns {Promise<number>}
 */
async function getChunkCount(documentId) {
  const db = initializePool();

  const query = `
    SELECT COUNT(*) as count
    FROM "KnowledgeChunk"
    WHERE "documentId" = $1
  `;

  const result = await db.query(query, [documentId]);
  return parseInt(result.rows[0].count, 10);
}

/**
 * 문서 조회
 * @param {string} documentId
 * @returns {Promise<Object|null>}
 */
async function getKnowledgeDocument(documentId) {
  const db = initializePool();

  const query = `
    SELECT * FROM "KnowledgeDocument"
    WHERE "id" = $1
  `;

  const result = await db.query(query, [documentId]);
  return result.rows[0] || null;
}

/**
 * 벡터 유사도 검색
 * @param {number[]} queryEmbedding
 * @param {Object} options
 * @returns {Promise<Array>}
 */
async function searchByVector(queryEmbedding, options = {}) {
  const db = initializePool();

  const {
    limit = 10,
    threshold = 0.5,
    category = null,
  } = options;

  const embeddingVector = `[${queryEmbedding.join(',')}]`;

  let query = `
    SELECT
      kc."id",
      kc."content",
      kc."chunkIndex",
      kc."pageNumber",
      kc."sectionTitle",
      kc."documentId",
      kd."title" as "documentTitle",
      kd."category",
      1 - (kc."embedding" <=> $1::vector) as similarity
    FROM "KnowledgeChunk" kc
    JOIN "KnowledgeDocument" kd ON kc."documentId" = kd."id"
    WHERE kc."embedding" IS NOT NULL
      AND kd."status" = 'ready'
  `;

  const params = [embeddingVector];

  if (category) {
    params.push(category);
    query += ` AND kd."category" = $${params.length}`;
  }

  params.push(threshold);
  query += ` AND 1 - (kc."embedding" <=> $1::vector) > $${params.length}`;

  params.push(limit);
  query += ` ORDER BY kc."embedding" <=> $1::vector LIMIT $${params.length}`;

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * UUID 생성
 * @returns {string}
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 연결 종료
 */
async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  initializePool,
  testConnection,
  createKnowledgeDocument,
  updateKnowledgeDocument,
  insertKnowledgeChunks,
  getChunkCount,
  getKnowledgeDocument,
  searchByVector,
  closeConnection,
  generateUUID,
};
