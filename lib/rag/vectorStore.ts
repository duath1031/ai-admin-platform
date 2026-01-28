/**
 * =============================================================================
 * Supabase pgvector Vector Store
 * =============================================================================
 * PostgreSQL pgvector extension을 사용한 벡터 저장 및 검색
 * - Supabase에서 pgvector extension 활성화 필요
 * - 3072차원 벡터 (Google gemini-embedding-001)
 *
 * [Supabase SQL Setup]
 * 1. Extensions 활성화:
 *    CREATE EXTENSION IF NOT EXISTS vector;
 *
 * 2. 임베딩 컬럼 추가:
 *    ALTER TABLE "KnowledgeChunk"
 *    ADD COLUMN IF NOT EXISTS embedding vector(3072);
 *
 * 3. 인덱스: 3072차원은 HNSW/IVFFlat 인덱스 제한(2000차원) 초과로 생략
 */

import prisma from "@/lib/prisma";
import { generateEmbedding, generateQueryEmbedding, getEmbeddingDimension } from "./embeddings";
import { Prisma } from "@prisma/client";

const EMBEDDING_DIMENSION = getEmbeddingDimension();

// 검색 결과 타입
export interface VectorSearchResult {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  sectionTitle: string | null;
  similarity: number;
  // Document metadata
  document?: {
    id: string;
    fileName: string;
    title: string | null;
    category: string | null;
  };
}

/**
 * 청크에 임베딩 저장
 */
export async function saveChunkEmbedding(
  chunkId: string,
  embedding: number[]
): Promise<void> {
  // 벡터를 PostgreSQL 형식으로 변환
  const vectorString = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
    UPDATE "KnowledgeChunk"
    SET embedding = ${vectorString}::vector
    WHERE id = ${chunkId}
  `;
}

/**
 * 여러 청크에 임베딩 일괄 저장
 */
export async function saveChunkEmbeddings(
  chunks: Array<{ id: string; embedding: number[] }>
): Promise<void> {
  // 트랜잭션으로 일괄 처리
  await prisma.$transaction(
    chunks.map(chunk => {
      const vectorString = `[${chunk.embedding.join(",")}]`;
      return prisma.$executeRaw`
        UPDATE "KnowledgeChunk"
        SET embedding = ${vectorString}::vector
        WHERE id = ${chunk.id}
      `;
    })
  );
}

/**
 * 유사도 검색 (Similarity Search)
 * @param query - 검색 쿼리 텍스트
 * @param topK - 반환할 최대 결과 수
 * @param threshold - 최소 유사도 임계값 (0-1)
 * @param category - 특정 카테고리로 필터링 (선택)
 */
export async function searchSimilar(
  query: string,
  topK: number = 5,
  threshold: number = 0.5,
  category?: string
): Promise<VectorSearchResult[]> {
  // 쿼리 임베딩 생성
  const queryEmbedding = await generateQueryEmbedding(query);
  const vectorString = `[${queryEmbedding.join(",")}]`;

  // pgvector 코사인 유사도 검색
  // 1 - (a <=> b) = cosine similarity (pgvector에서 <=>는 cosine distance)
  let results: VectorSearchResult[];

  if (category) {
    results = await prisma.$queryRaw`
      SELECT
        c.id,
        c."documentId",
        c.content,
        c."chunkIndex",
        c."pageNumber",
        c."sectionTitle",
        1 - (c.embedding <=> ${vectorString}::vector) as similarity,
        d.id as "docId",
        d."fileName",
        d.title,
        d.category
      FROM "KnowledgeChunk" c
      JOIN "KnowledgeDocument" d ON c."documentId" = d.id
      WHERE d.status IN ('ready', 'completed')
        AND d.category = ${category}
        AND c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> ${vectorString}::vector) >= ${threshold}
      ORDER BY c.embedding <=> ${vectorString}::vector
      LIMIT ${topK}
    `;
  } else {
    results = await prisma.$queryRaw`
      SELECT
        c.id,
        c."documentId",
        c.content,
        c."chunkIndex",
        c."pageNumber",
        c."sectionTitle",
        1 - (c.embedding <=> ${vectorString}::vector) as similarity,
        d.id as "docId",
        d."fileName",
        d.title,
        d.category
      FROM "KnowledgeChunk" c
      JOIN "KnowledgeDocument" d ON c."documentId" = d.id
      WHERE d.status IN ('ready', 'completed')
        AND c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> ${vectorString}::vector) >= ${threshold}
      ORDER BY c.embedding <=> ${vectorString}::vector
      LIMIT ${topK}
    `;
  }

  // 결과 포맷팅
  return results.map((r: any) => ({
    id: r.id,
    documentId: r.documentId,
    content: r.content,
    chunkIndex: r.chunkIndex,
    pageNumber: r.pageNumber,
    sectionTitle: r.sectionTitle,
    similarity: Number(r.similarity),
    document: {
      id: r.docId,
      fileName: r.fileName,
      title: r.title,
      category: r.category,
    },
  }));
}

/**
 * 임베딩 벡터로 직접 검색
 */
export async function searchByVector(
  embedding: number[],
  topK: number = 5,
  threshold: number = 0.5
): Promise<VectorSearchResult[]> {
  const vectorString = `[${embedding.join(",")}]`;

  const results = await prisma.$queryRaw`
    SELECT
      c.id,
      c."documentId",
      c.content,
      c."chunkIndex",
      c."pageNumber",
      c."sectionTitle",
      1 - (c.embedding <=> ${vectorString}::vector) as similarity,
      d.id as "docId",
      d."fileName",
      d.title,
      d.category
    FROM "KnowledgeChunk" c
    JOIN "KnowledgeDocument" d ON c."documentId" = d.id
    WHERE d.status IN ('ready', 'completed')
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> ${vectorString}::vector) >= ${threshold}
    ORDER BY c.embedding <=> ${vectorString}::vector
    LIMIT ${topK}
  `;

  return (results as any[]).map((r: any) => ({
    id: r.id,
    documentId: r.documentId,
    content: r.content,
    chunkIndex: r.chunkIndex,
    pageNumber: r.pageNumber,
    sectionTitle: r.sectionTitle,
    similarity: Number(r.similarity),
    document: {
      id: r.docId,
      fileName: r.fileName,
      title: r.title,
      category: r.category,
    },
  }));
}

/**
 * 특정 문서의 모든 임베딩 삭제
 */
export async function deleteDocumentEmbeddings(documentId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "KnowledgeChunk"
    SET embedding = NULL
    WHERE "documentId" = ${documentId}
  `;
}

/**
 * pgvector extension 및 컬럼 설정 확인
 */
export async function checkVectorSetup(): Promise<{
  extensionExists: boolean;
  columnExists: boolean;
  indexExists: boolean;
}> {
  try {
    // Extension 확인
    const extensionResult = await prisma.$queryRaw<any[]>`
      SELECT 1 FROM pg_extension WHERE extname = 'vector'
    `;

    // 컬럼 확인
    const columnResult = await prisma.$queryRaw<any[]>`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'KnowledgeChunk'
        AND column_name = 'embedding'
    `;

    // 인덱스 확인
    const indexResult = await prisma.$queryRaw<any[]>`
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'KnowledgeChunk'
        AND indexname = 'knowledge_chunk_embedding_idx'
    `;

    return {
      extensionExists: extensionResult.length > 0,
      columnExists: columnResult.length > 0,
      indexExists: indexResult.length > 0,
    };
  } catch (error) {
    console.error("[VectorStore] Setup check failed:", error);
    return {
      extensionExists: false,
      columnExists: false,
      indexExists: false,
    };
  }
}

/**
 * 벡터 통계 조회
 */
export async function getVectorStats(): Promise<{
  totalChunks: number;
  chunksWithEmbedding: number;
  totalDocuments: number;
}> {
  const stats = await prisma.$queryRaw<any[]>`
    SELECT
      (SELECT COUNT(*) FROM "KnowledgeChunk") as "totalChunks",
      (SELECT COUNT(*) FROM "KnowledgeChunk" WHERE embedding IS NOT NULL) as "chunksWithEmbedding",
      (SELECT COUNT(*) FROM "KnowledgeDocument" WHERE status IN ('ready', 'completed')) as "totalDocuments"
  `;

  return {
    totalChunks: Number(stats[0]?.totalChunks || 0),
    chunksWithEmbedding: Number(stats[0]?.chunksWithEmbedding || 0),
    totalDocuments: Number(stats[0]?.totalDocuments || 0),
  };
}
