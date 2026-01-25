/**
 * =============================================================================
 * Knowledge Document API (단일 문서)
 * =============================================================================
 * DELETE /api/knowledge/[id] - 문서 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// 관리자 이메일 목록
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);

/**
 * DELETE /api/knowledge/[id]
 * 문서 및 관련 청크 삭제
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
      include: {
        chunks: {
          select: { id: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    console.log(`[Knowledge Delete] Deleting document: ${document.title} (${document.chunks.length} chunks)`);

    // 청크 먼저 삭제 (외래키 제약)
    await prisma.knowledgeChunk.deleteMany({
      where: { documentId: id },
    });

    // 문서 삭제
    await prisma.knowledgeDocument.delete({
      where: { id },
    });

    console.log(`[Knowledge Delete] Successfully deleted document: ${id}`);

    return NextResponse.json({
      success: true,
      message: "문서가 삭제되었습니다.",
      deletedChunks: document.chunks.length,
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
