/**
 * =============================================================================
 * Knowledge Process API (백그라운드 임베딩 처리)
 * =============================================================================
 * POST /api/knowledge/process
 *
 * pending_embedding 상태인 문서의 임베딩을 생성
 * - 한 번에 하나의 문서만 처리 (타임아웃 방지)
 * - 청크 단위로 임베딩 생성
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateEmbedding } from "@/lib/rag/embeddings";
import { saveChunkEmbeddings } from "@/lib/rag/vectorStore";

// 관리자 이메일 목록
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);

// 한 번에 처리할 청크 수 (타임아웃 방지)
const CHUNKS_PER_BATCH = 10;

export async function POST(req: NextRequest) {
  try {
    // 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const documentId = body.documentId;

    // 처리할 문서 찾기
    let document;
    if (documentId) {
      // 특정 문서 처리
      document = await prisma.knowledgeDocument.findFirst({
        where: {
          id: documentId,
          status: { in: ["pending_embedding", "processing"] },
        },
      });
    } else {
      // pending_embedding 상태인 문서 중 가장 오래된 것
      document = await prisma.knowledgeDocument.findFirst({
        where: { status: "pending_embedding" },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!document) {
      return NextResponse.json({
        success: true,
        message: "처리할 문서가 없습니다.",
        processed: 0,
      });
    }

    console.log(`[Knowledge Process] Processing document: ${document.id} (${document.title})`);

    // 문서 상태를 processing으로 변경
    await prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: { status: "processing" },
    });

    // 임베딩이 없는 청크 찾기
    const chunksWithoutEmbedding = await prisma.$queryRaw<Array<{ id: string; content: string }>>`
      SELECT id, content FROM "KnowledgeChunk"
      WHERE "documentId" = ${document.id}
      AND (embedding IS NULL OR embedding = '[]'::vector)
      ORDER BY "chunkIndex"
      LIMIT ${CHUNKS_PER_BATCH}
    `;

    if (chunksWithoutEmbedding.length === 0) {
      // 모든 청크 처리 완료
      await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: "completed" },
      });

      return NextResponse.json({
        success: true,
        message: "문서 처리 완료",
        documentId: document.id,
        processed: 0,
        completed: true,
      });
    }

    console.log(`[Knowledge Process] Processing ${chunksWithoutEmbedding.length} chunks`);

    // 임베딩 생성
    const chunkEmbeddings: Array<{ id: string; embedding: number[] }> = [];

    for (const chunk of chunksWithoutEmbedding) {
      try {
        const embedding = await generateEmbedding(chunk.content);
        chunkEmbeddings.push({ id: chunk.id, embedding });
      } catch (error) {
        console.error(`[Knowledge Process] Failed to embed chunk ${chunk.id}:`, error);
        // 개별 청크 실패는 건너뛰고 계속 진행
      }
    }

    // 임베딩 저장
    if (chunkEmbeddings.length > 0) {
      await saveChunkEmbeddings(chunkEmbeddings);
      console.log(`[Knowledge Process] Saved ${chunkEmbeddings.length} embeddings`);
    }

    // 남은 청크 확인
    const remainingCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "KnowledgeChunk"
      WHERE "documentId" = ${document.id}
      AND (embedding IS NULL OR embedding = '[]'::vector)
    `;

    const remaining = Number(remainingCount[0]?.count || 0);

    if (remaining === 0) {
      // 모든 청크 처리 완료
      await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: "completed" },
      });
    } else {
      // 아직 처리할 청크 남음
      await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: "pending_embedding" },
      });
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      processed: chunkEmbeddings.length,
      remaining,
      completed: remaining === 0,
      message: remaining === 0
        ? "문서 처리 완료!"
        : `${chunkEmbeddings.length}개 청크 처리됨. 남은 청크: ${remaining}개`,
    });
  } catch (error) {
    console.error("[Knowledge Process] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge/process
 * 처리 대기 중인 문서 목록
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ success: false, error: "권한 없음" }, { status: 403 });
    }

    const pendingDocs = await prisma.knowledgeDocument.findMany({
      where: { status: { in: ["pending_embedding", "processing"] } },
      select: {
        id: true,
        title: true,
        status: true,
        totalChunks: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // 각 문서의 처리 진행률 계산
    const docsWithProgress = await Promise.all(
      pendingDocs.map(async (doc) => {
        const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM "KnowledgeChunk"
          WHERE "documentId" = ${doc.id}
          AND embedding IS NOT NULL
          AND embedding != '[]'::vector
        `;
        const processedChunks = Number(result[0]?.count || 0);
        const progress = doc.totalChunks > 0
          ? Math.round((processedChunks / doc.totalChunks) * 100)
          : 0;

        return {
          ...doc,
          processedChunks,
          progress,
        };
      })
    );

    return NextResponse.json({
      success: true,
      documents: docsWithProgress,
      total: docsWithProgress.length,
    });
  } catch (error) {
    console.error("[Knowledge Process] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류" },
      { status: 500 }
    );
  }
}
