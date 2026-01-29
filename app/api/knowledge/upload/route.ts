/**
 * =============================================================================
 * Knowledge Upload API - Gemini File API 방식 (Long Context)
 * =============================================================================
 * POST /api/knowledge/upload
 *
 * 관리자 전용 - 지식 문서 업로드
 * NotebookLM과 동일한 방식으로 대용량 파일을 Google에 직접 업로드
 *
 * 장점:
 * - 임베딩/청킹 불필요 → 업로드 속도 대폭 향상
 * - 50MB+ 파일도 10초 이내 처리
 * - 문서 전체 컨텍스트 유지 (Long Context)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  uploadKnowledgeDocument,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE_MB,
} from "@/lib/ai/knowledge";

// 관리자 이메일 목록
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);

export async function POST(req: NextRequest) {
  const startTime = Date.now();

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

    // FormData 파싱
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const category = formData.get("category") as string | null;
    const description = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "파일이 필요합니다." },
        { status: 400 }
      );
    }

    // 파일 확장자 확인
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_MIME_TYPES[ext]) {
      const supportedFormats = Object.keys(SUPPORTED_MIME_TYPES).join(", ");
      return NextResponse.json(
        {
          success: false,
          error: `지원하지 않는 파일 형식입니다. 지원 형식: ${supportedFormats}`,
        },
        { status: 400 }
      );
    }

    // 파일 크기 확인
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      return NextResponse.json(
        {
          success: false,
          error: `파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE_MB}MB까지 지원합니다. (현재: ${fileSizeMB.toFixed(1)}MB)`,
        },
        { status: 400 }
      );
    }

    console.log(`[Knowledge Upload] Starting: ${file.name} (${fileSizeMB.toFixed(1)}MB)`);

    // Gemini File API에 업로드
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadKnowledgeDocument(buffer, file.name, {
      title: title || file.name.replace(/\.[^/.]+$/, ""),
      category: category || undefined,
      description: description || undefined,
      uploadedBy: session.user.email,
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Knowledge Upload] Completed in ${elapsedTime}s: ${file.name}`);

    // 문서 정보 조회
    const document = await prisma.knowledgeDocument.findUnique({
      where: { id: result.documentId },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        title: true,
        category: true,
        description: true,
        status: true,
        geminiFileUri: true,
        geminiExpiresAt: true,
        processingMode: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `업로드 완료! (${elapsedTime}초)`,
      document,
      processingMode: "gemini_file",
      elapsedSeconds: parseFloat(elapsedTime),
    });
  } catch (error) {
    console.error("[Knowledge Upload] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "서버 오류",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge/upload
 * 업로드된 문서 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
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

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const processingMode = searchParams.get("processingMode");

    // 문서 목록 조회
    const documents = await prisma.knowledgeDocument.findMany({
      where: {
        ...(category && { category }),
        ...(status && { status }),
        ...(processingMode && { processingMode }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        title: true,
        category: true,
        description: true,
        status: true,
        totalChunks: true,
        totalTokens: true,
        errorMessage: true,
        uploadedBy: true,
        createdAt: true,
        updatedAt: true,
        // Gemini File API 필드
        geminiFileUri: true,
        geminiMimeType: true,
        geminiExpiresAt: true,
        processingMode: true,
      },
    });

    // 통계 계산
    const stats = {
      total: documents.length,
      completed: documents.filter(d => d.status === "completed").length,
      processing: documents.filter(d => d.status === "processing" || d.status === "uploading").length,
      failed: documents.filter(d => d.status === "failed").length,
      expired: documents.filter(d => d.status === "expired").length,
      geminiFileMode: documents.filter(d => d.processingMode === "gemini_file").length,
      legacyRagMode: documents.filter(d => d.processingMode === "legacy_rag").length,
    };

    return NextResponse.json({
      success: true,
      documents,
      stats,
    });
  } catch (error) {
    console.error("[Knowledge List] Error:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류" },
      { status: 500 }
    );
  }
}
