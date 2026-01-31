/**
 * =============================================================================
 * Knowledge Document API (단일 문서) - Gemini File API
 * =============================================================================
 * DELETE /api/knowledge/[id] - 문서 삭제 (DB + Google 파일)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteKnowledgeDocument } from "@/lib/ai/knowledge";

// 관리자 이메일 목록
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);

/**
 * DELETE /api/knowledge/[id]
 * 문서 삭제 (DB + Google File API)
 */
export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
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

    // Next.js 14/15 호환
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;

    // 문서 존재 확인
    const document = await prisma.knowledgeDocument.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        fileName: true,
        processingMode: true,
        geminiFileName: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    console.log(`[Knowledge Delete] Deleting document: ${document.title || document.fileName}`);

    // Gemini File API 방식인 경우 Google에서도 삭제
    if (document.processingMode === "gemini_file") {
      await deleteKnowledgeDocument(id);
      console.log(`[Knowledge Delete] Deleted from Google: ${document.geminiFileName}`);
    } else {
      // Legacy RAG 방식 - DB에서만 삭제
      await prisma.knowledgeChunk.deleteMany({
        where: { documentId: id },
      });
      await prisma.knowledgeDocument.delete({
        where: { id },
      });
    }

    console.log(`[Knowledge Delete] Successfully deleted document: ${id}`);

    return NextResponse.json({
      success: true,
      message: "문서가 삭제되었습니다.",
      deletedFromGoogle: document.processingMode === "gemini_file",
    });
  } catch (error) {
    console.error("[Knowledge Delete] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "삭제 중 오류 발생",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge/[id]
 * 문서 상세 조회
 */
export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;

    const document = await prisma.knowledgeDocument.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error("[Knowledge Get] Error:", error);
    return NextResponse.json(
      { success: false, error: "조회 중 오류 발생" },
      { status: 500 }
    );
  }
}
