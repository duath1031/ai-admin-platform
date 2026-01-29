/**
 * =============================================================================
 * Large File Upload Proxy API
 * =============================================================================
 * 대용량 파일을 RPA Worker로 프록시하여 Gemini File API로 업로드
 * - Vercel 파일 크기 제한 우회
 * - API 키를 서버에서 안전하게 처리
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RPA_WORKER_URL = process.env.RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';

// Next.js App Router에서 대용량 파일 허용
export const maxDuration = 60; // 60초 타임아웃
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // FormData 그대로 전달
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string || '';
    const category = formData.get('category') as string || '기타';

    if (!file) {
      return NextResponse.json(
        { success: false, error: "파일이 없습니다." },
        { status: 400 }
      );
    }

    console.log(`[Upload Large] Proxying to RPA Worker: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // RPA Worker로 전달할 새 FormData 생성
    const workerFormData = new FormData();
    workerFormData.append('file', file);
    workerFormData.append('title', title || file.name.replace(/\.[^/.]+$/, ''));
    workerFormData.append('category', category);

    // RPA Worker에 요청 (API 키 포함)
    const workerResponse = await fetch(`${RPA_WORKER_URL}/rag/upload-gemini`, {
      method: 'POST',
      headers: {
        'X-API-Key': WORKER_API_KEY,
      },
      body: workerFormData,
    });

    const workerData = await workerResponse.json();

    if (!workerResponse.ok || !workerData.success) {
      console.error('[Upload Large] RPA Worker error:', workerData.error);
      return NextResponse.json(
        { success: false, error: workerData.error || 'RPA Worker 업로드 실패' },
        { status: workerResponse.status }
      );
    }

    // DB에 문서 저장
    const document = await prisma.knowledgeDocument.create({
      data: {
        fileName: file.name,
        fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
        fileSize: file.size,
        title: title || file.name.replace(/\.[^/.]+$/, ''),
        category: category,
        status: "completed",
        processingMode: "gemini_file",
        geminiFileUri: workerData.fileUri,
        geminiMimeType: workerData.mimeType,
        geminiFileName: workerData.fileName,
        geminiExpiresAt: workerData.expiresAt ? new Date(workerData.expiresAt) : null,
      },
    });

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

    console.log(`[Upload Large] Success: ${document.id} in ${elapsedSeconds}s`);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileUri: workerData.fileUri,
      elapsedSeconds,
      message: `업로드 완료 (${elapsedSeconds}초)`,
    });

  } catch (error) {
    console.error("[Upload Large] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "업로드 실패",
      },
      { status: 500 }
    );
  }
}
