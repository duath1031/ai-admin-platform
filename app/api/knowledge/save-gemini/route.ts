/**
 * =============================================================================
 * Save Gemini File Info API
 * =============================================================================
 * RPA Worker에서 Gemini File API로 업로드한 파일 정보를 DB에 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fileName,
      fileType,
      fileSize,
      title,
      category,
      fileUri,
      mimeType,
      geminiFileName,
      expiresAt,
    } = body;

    // 필수 필드 검증
    if (!fileName || !fileUri) {
      return NextResponse.json(
        { success: false, error: "fileName과 fileUri는 필수입니다." },
        { status: 400 }
      );
    }

    // DB에 문서 레코드 생성
    const document = await prisma.knowledgeDocument.create({
      data: {
        fileName,
        fileType: fileType || fileName.split('.').pop()?.toLowerCase() || 'unknown',
        fileSize: fileSize || 0,
        title: title || fileName,
        category: category || '기타',
        status: "completed",
        processingMode: "gemini_file",
        geminiFileUri: fileUri,
        geminiMimeType: mimeType,
        geminiFileName: geminiFileName,
        geminiExpiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    console.log(`[Knowledge Save] Saved Gemini file to DB: ${document.id}`);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: "문서 정보가 저장되었습니다.",
    });

  } catch (error) {
    console.error("[Knowledge Save] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "저장 실패",
      },
      { status: 500 }
    );
  }
}
