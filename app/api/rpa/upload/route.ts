/**
 * =============================================================================
 * Phase 10 Infra: 파일 업로드 API (PDF/JPG/PNG/HWPX)
 * =============================================================================
 *
 * POST /api/rpa/upload
 *   - multipart/form-data로 파일 업로드
 *   - JPG/PNG → PDF 자동 변환 (pdf-lib)
 *   - 파일 유효성 검증 후 temp/ 에 저장
 *   - 변환된 파일 경로 반환
 *
 * 지원 파일 형식: .pdf, .jpg, .jpeg, .png, .hwpx
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { imageToPdf, getMimeFromExtension } from '@/lib/pdfUtils';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Constants
// =============================================================================

const UPLOAD_DIR = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(process.cwd(), 'temp', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/octet-stream': ['.hwpx'],
  'application/hwpx': ['.hwpx'],
  'application/vnd.hancom.hwpx': ['.hwpx'],
};

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.hwpx']);

// =============================================================================
// Helpers
// =============================================================================

function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function getFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

function generateFileName(originalName: string, extension: string): string {
  const timestamp = Date.now();
  const baseName = path.basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
    .substring(0, 50);
  return `${baseName}_${timestamp}${extension}`;
}

// PDF 변환은 lib/pdfUtils.ts의 imageToPdf 사용

// =============================================================================
// POST: File Upload
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 필요합니다. (field name: "file")' },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `파일 크기가 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과합니다.` },
        { status: 400 }
      );
    }

    // 확장자 검증
    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `지원하지 않는 파일 형식: ${ext}`,
          allowedExtensions: Array.from(ALLOWED_EXTENSIONS),
        },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let savedFileName: string;
    let convertedFrom: string | null = null;
    let finalFileType: string;

    // JPG/PNG → PDF 자동 변환 (lib/pdfUtils 사용)
    let finalBuffer: Buffer;

    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      console.log(`[Upload] 이미지 → PDF 변환: ${file.name} (${ext})`);
      const mime = getMimeFromExtension(ext) || 'image/jpeg';
      const convertResult = await imageToPdf(fileBuffer, mime);
      if (!convertResult.success || !convertResult.buffer) {
        return NextResponse.json(
          { success: false, error: `PDF 변환 실패: ${convertResult.error}` },
          { status: 500 }
        );
      }
      savedFileName = generateFileName(file.name, '.pdf');
      finalBuffer = convertResult.buffer;
      convertedFrom = ext;
      finalFileType = 'pdf';
      console.log(`[Upload] 변환 완료: ${savedFileName} (${finalBuffer.length} bytes)`);
    } else {
      // PDF, HWPX는 그대로
      savedFileName = generateFileName(file.name, ext);
      finalBuffer = fileBuffer;
      finalFileType = ext.replace('.', '');
      console.log(`[Upload] 파일 처리: ${savedFileName} (${finalBuffer.length} bytes)`);
    }

    // base64로 클라이언트에 반환 (서버 디스크 저장 X, 임시 전달)
    const base64 = finalBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      file: {
        originalName: file.name,
        savedName: savedFileName,
        savedPath: savedFileName, // 식별용 이름만 (실제 경로 아님)
        fileType: finalFileType,
        originalSize: file.size,
        savedSize: finalBuffer.length,
        convertedFrom,
      },
      base64,
      message: convertedFrom
        ? `${convertedFrom.toUpperCase()} → PDF 변환 완료`
        : '파일 업로드 완료',
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '업로드 실패' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET: Upload Status / Temp Files List
// =============================================================================

export async function GET() {
  ensureUploadDir();

  const files = fs.readdirSync(UPLOAD_DIR).map((name) => {
    const filePath = path.join(UPLOAD_DIR, name);
    const stat = fs.statSync(filePath);
    return {
      name,
      size: stat.size,
      createdAt: stat.birthtime,
      ageMinutes: Math.round((Date.now() - stat.birthtimeMs) / 60000),
    };
  });

  return NextResponse.json({
    success: true,
    uploadDir: UPLOAD_DIR,
    files,
    totalFiles: files.length,
    allowedExtensions: Array.from(ALLOWED_EXTENSIONS),
    maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
  });
}
