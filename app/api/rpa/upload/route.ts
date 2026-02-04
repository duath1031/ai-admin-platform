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
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Constants
// =============================================================================

const UPLOAD_DIR = path.join(process.cwd(), 'temp', 'uploads');
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

/**
 * JPG/PNG 이미지를 PDF로 변환한다.
 */
async function convertImageToPdf(imageBuffer: Buffer, mimeType: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  let image;
  if (mimeType === 'image/jpeg') {
    image = await pdfDoc.embedJpg(imageBuffer);
  } else if (mimeType === 'image/png') {
    image = await pdfDoc.embedPng(imageBuffer);
  } else {
    throw new Error(`지원하지 않는 이미지 형식: ${mimeType}`);
  }

  // A4 사이즈 (595.28 x 841.89 points)
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  // 이미지를 A4에 맞게 스케일링 (여백 포함)
  const margin = 36; // 0.5 inch margin
  const maxWidth = A4_WIDTH - margin * 2;
  const maxHeight = A4_HEIGHT - margin * 2;

  const imgWidth = image.width;
  const imgHeight = image.height;
  const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);

  const scaledWidth = imgWidth * scale;
  const scaledHeight = imgHeight * scale;

  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawImage(image, {
    x: (A4_WIDTH - scaledWidth) / 2,
    y: (A4_HEIGHT - scaledHeight) / 2,
    width: scaledWidth,
    height: scaledHeight,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

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

    ensureUploadDir();

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let savedFileName: string;
    let savedFilePath: string;
    let convertedFrom: string | null = null;
    let finalFileType: string;

    // JPG/PNG → PDF 자동 변환
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      console.log(`[Upload] 이미지 → PDF 변환: ${file.name} (${ext})`);
      const pdfBuffer = await convertImageToPdf(fileBuffer, file.type || `image/${ext.replace('.', '')}`);
      savedFileName = generateFileName(file.name, '.pdf');
      savedFilePath = path.join(UPLOAD_DIR, savedFileName);
      fs.writeFileSync(savedFilePath, pdfBuffer);
      convertedFrom = ext;
      finalFileType = 'pdf';
      console.log(`[Upload] 변환 완료: ${savedFileName} (${pdfBuffer.length} bytes)`);
    } else {
      // PDF, HWPX는 그대로 저장
      savedFileName = generateFileName(file.name, ext);
      savedFilePath = path.join(UPLOAD_DIR, savedFileName);
      fs.writeFileSync(savedFilePath, fileBuffer);
      finalFileType = ext.replace('.', '');
      console.log(`[Upload] 파일 저장: ${savedFileName} (${fileBuffer.length} bytes)`);
    }

    return NextResponse.json({
      success: true,
      file: {
        originalName: file.name,
        savedName: savedFileName,
        savedPath: savedFilePath,
        fileType: finalFileType,
        originalSize: file.size,
        savedSize: fs.statSync(savedFilePath).size,
        convertedFrom,
      },
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
