/**
 * RAG 시스템 자동 설정 API
 * GET /api/admin/setup-rag - 현재 상태 확인
 * POST /api/admin/setup-rag - 자동 설정 실행
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET: 현재 상태 확인
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await checkRAGStatus();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("[Setup RAG] GET Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

// POST: 자동 설정 실행
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: string[] = [];

    // 1. pgvector extension 확인 및 생성
    try {
      await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
      results.push("✅ pgvector extension 확인/생성 완료");
    } catch (e: any) {
      results.push(`⚠️ pgvector extension: ${e.message}`);
    }

    // 2. embedding 컬럼 확인
    const columnCheck = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'KnowledgeChunk' AND column_name = 'embedding'
    `;

    if (columnCheck.length === 0) {
      // 컬럼이 없으면 추가
      try {
        await prisma.$executeRaw`
          ALTER TABLE "KnowledgeChunk"
          ADD COLUMN embedding vector(3072)
        `;
        results.push("✅ embedding 컬럼 추가 완료 (3072 차원)");
      } catch (e: any) {
        results.push(`❌ embedding 컬럼 추가 실패: ${e.message}`);
      }
    } else {
      results.push("✅ embedding 컬럼 이미 존재");

      // 차원 확인 (vector(3072)인지)
      const udtName = columnCheck[0]?.udt_name;
      if (udtName === 'vector') {
        results.push("✅ 벡터 타입 확인됨");
      }
    }

    // 3. 테이블 통계
    const stats = await prisma.$queryRaw<any[]>`
      SELECT
        (SELECT COUNT(*) FROM "KnowledgeDocument") as total_documents,
        (SELECT COUNT(*) FROM "KnowledgeDocument" WHERE status IN ('ready', 'completed')) as ready_documents,
        (SELECT COUNT(*) FROM "KnowledgeChunk") as total_chunks,
        (SELECT COUNT(*) FROM "KnowledgeChunk" WHERE embedding IS NOT NULL) as chunks_with_embedding
    `;

    const stat = stats[0];
    results.push(`📊 문서: ${stat.total_documents}개 (준비완료: ${stat.ready_documents}개)`);
    results.push(`📊 청크: ${stat.total_chunks}개 (임베딩있음: ${stat.chunks_with_embedding}개)`);

    // 4. 임베딩 없는 청크가 있으면 경고
    const chunksNeedingEmbedding = Number(stat.total_chunks) - Number(stat.chunks_with_embedding);
    if (chunksNeedingEmbedding > 0) {
      results.push(`⚠️ 임베딩이 필요한 청크: ${chunksNeedingEmbedding}개 (RPA Worker로 재업로드 필요)`);
    }

    // 5. 청크가 0인 문서 확인
    const docsWithoutChunks = await prisma.$queryRaw<any[]>`
      SELECT d.id, d.title, d."fileName", d.status
      FROM "KnowledgeDocument" d
      LEFT JOIN "KnowledgeChunk" c ON d.id = c."documentId"
      WHERE c.id IS NULL
    `;

    if (docsWithoutChunks.length > 0) {
      results.push(`⚠️ 청크 없는 문서 ${docsWithoutChunks.length}개:`);
      for (const doc of docsWithoutChunks.slice(0, 5)) {
        results.push(`   - ${doc.title || doc.fileName} (${doc.status})`);
      }
      if (docsWithoutChunks.length > 5) {
        results.push(`   ... 외 ${docsWithoutChunks.length - 5}개`);
      }
    }

    // 최종 상태 확인
    const finalStatus = await checkRAGStatus();

    return NextResponse.json({
      success: true,
      results,
      finalStatus,
      message: finalStatus.ready
        ? "🎉 RAG 시스템이 준비되었습니다!"
        : "⚠️ 추가 설정이 필요합니다. 문서를 RPA Worker로 다시 업로드해주세요.",
    });

  } catch (error) {
    console.error("[Setup RAG] POST Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

async function checkRAGStatus() {
  // Extension 확인
  const extCheck = await prisma.$queryRaw<any[]>`
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  `;

  // Column 확인
  const colCheck = await prisma.$queryRaw<any[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'KnowledgeChunk' AND column_name = 'embedding'
  `;

  // 통계
  const stats = await prisma.$queryRaw<any[]>`
    SELECT
      (SELECT COUNT(*) FROM "KnowledgeDocument" WHERE status IN ('ready', 'completed')) as docs,
      (SELECT COUNT(*) FROM "KnowledgeChunk" WHERE embedding IS NOT NULL) as chunks
  `;

  const hasExtension = extCheck.length > 0;
  const hasColumn = colCheck.length > 0;
  const hasDocs = Number(stats[0]?.docs || 0) > 0;
  const hasChunks = Number(stats[0]?.chunks || 0) > 0;

  return {
    ready: hasExtension && hasColumn && hasChunks,
    extension: hasExtension,
    embeddingColumn: hasColumn,
    documentsCount: Number(stats[0]?.docs || 0),
    chunksWithEmbedding: Number(stats[0]?.chunks || 0),
  };
}
