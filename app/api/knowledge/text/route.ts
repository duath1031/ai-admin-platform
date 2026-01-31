/**
 * =============================================================================
 * Knowledge Text API
 * =============================================================================
 * POST /api/knowledge/text
 *
 * 텍스트 직접 입력으로 지식 추가 (대용량 문서 지원)
 * - 파일 업로드 없이 텍스트만 받아서 처리
 * - 청킹은 즉시, 임베딩은 백그라운드로
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { chunkText, getChunkStats } from "@/lib/rag/chunker";
import { cleanExtractedText } from "@/lib/rag/documentProcessor";

// 관리자 이메일 목록
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);

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

    const body = await req.json();
    const { text, title, category, description } = body;

    if (!text || text.trim().length < 100) {
      return NextResponse.json(
        { success: false, error: "텍스트는 최소 100자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { success: false, error: "제목을 입력해주세요." },
        { status: 400 }
      );
    }

    console.log(`[Knowledge Text] Processing: ${title} (${text.length} chars)`);

    // 텍스트 정리
    const cleanedText = cleanExtractedText(text);

    // 1. DB에 문서 레코드 생성
    const document = await prisma.knowledgeDocument.create({
      data: {
        fileName: `${title}.txt`,
        fileType: "txt",
        fileSize: Buffer.byteLength(cleanedText, "utf8"),
        title,
        category: category || null,
        description: description || null,
        status: "processing",
        uploadedBy: session.user.email,
      },
    });

    try {
      // 2. 청킹 (이건 빠름)
      const chunks = chunkText(cleanedText, {
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const chunkStats = getChunkStats(chunks);
      console.log(`[Knowledge Text] Created ${chunks.length} chunks`);

      // 3. 청크 레코드 생성 (임베딩 없이)
      await prisma.$transaction(
        chunks.map((chunk) =>
          prisma.knowledgeChunk.create({
            data: {
              documentId: document.id,
              content: chunk.content,
              chunkIndex: chunk.index,
              tokenCount: chunk.tokenCount,
            },
          })
        )
      );

      // 4. 문서 상태 업데이트 (pending_embedding - 임베딩 대기)
      const updatedDocument = await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: "pending_embedding",
          totalChunks: chunks.length,
          totalTokens: chunkStats.estimatedTokens,
        },
      });

      console.log(`[Knowledge Text] Document saved, pending embedding: ${document.id}`);

      return NextResponse.json({
        success: true,
        document: {
          id: updatedDocument.id,
          title: updatedDocument.title,
          totalChunks: updatedDocument.totalChunks,
          totalTokens: updatedDocument.totalTokens,
          status: updatedDocument.status,
        },
        message: "텍스트가 저장되었습니다. 임베딩 처리를 시작하세요.",
      });
    } catch (error) {
      // 처리 중 오류
      await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "처리 중 오류",
        },
      });
      throw error;
    }
  } catch (error) {
    console.error("[Knowledge Text] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}
