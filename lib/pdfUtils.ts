/**
 * =============================================================================
 * PDF Utility Module
 * =============================================================================
 *
 * pdf-lib 기반 이미지→PDF 변환 유틸리티.
 * 사용자가 휴대폰으로 찍은 서류(JPG/PNG)를 RPA 제출용 PDF로 변환한다.
 *
 * @module lib/pdfUtils
 */

import { PDFDocument } from 'pdf-lib';

// A4 사이즈 (포인트 단위)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const DEFAULT_MARGIN = 36; // 0.5 inch

export interface ConvertResult {
  success: boolean;
  buffer?: Buffer;
  pageCount?: number;
  error?: string;
}

/**
 * 단일 이미지 버퍼를 A4 PDF로 변환한다.
 *
 * @param imageBuffer - JPG 또는 PNG 이미지 버퍼
 * @param mimeType   - 'image/jpeg' | 'image/png'
 * @param margin     - 여백 (포인트, 기본 36 = 0.5인치)
 */
export async function imageToPdf(
  imageBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png',
  margin: number = DEFAULT_MARGIN
): Promise<ConvertResult> {
  try {
    const pdfDoc = await PDFDocument.create();

    let image;
    if (mimeType === 'image/jpeg') {
      image = await pdfDoc.embedJpg(imageBuffer);
    } else {
      image = await pdfDoc.embedPng(imageBuffer);
    }

    const maxWidth = A4_WIDTH - margin * 2;
    const maxHeight = A4_HEIGHT - margin * 2;

    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawImage(image, {
      x: (A4_WIDTH - scaledWidth) / 2,
      y: (A4_HEIGHT - scaledHeight) / 2,
      width: scaledWidth,
      height: scaledHeight,
    });

    const pdfBytes = await pdfDoc.save();
    return {
      success: true,
      buffer: Buffer.from(pdfBytes),
      pageCount: 1,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 여러 이미지를 하나의 PDF로 합친다.
 * (다중 페이지 스캔 문서 처리용)
 *
 * @param images - 이미지 버퍼와 MIME 타입 배열
 */
export async function multiImageToPdf(
  images: Array<{ buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' }>,
  margin: number = DEFAULT_MARGIN
): Promise<ConvertResult> {
  try {
    if (images.length === 0) {
      return { success: false, error: '이미지가 없습니다.' };
    }

    const pdfDoc = await PDFDocument.create();
    const maxWidth = A4_WIDTH - margin * 2;
    const maxHeight = A4_HEIGHT - margin * 2;

    for (const img of images) {
      const image = img.mimeType === 'image/jpeg'
        ? await pdfDoc.embedJpg(img.buffer)
        : await pdfDoc.embedPng(img.buffer);

      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const scaledWidth = image.width * scale;
      const scaledHeight = image.height * scale;

      const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      page.drawImage(image, {
        x: (A4_WIDTH - scaledWidth) / 2,
        y: (A4_HEIGHT - scaledHeight) / 2,
        width: scaledWidth,
        height: scaledHeight,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return {
      success: true,
      buffer: Buffer.from(pdfBytes),
      pageCount: images.length,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 파일 확장자로부터 MIME 타입을 추론한다.
 */
export function getMimeFromExtension(ext: string): 'image/jpeg' | 'image/png' | null {
  const lower = ext.toLowerCase().replace('.', '');
  if (lower === 'jpg' || lower === 'jpeg') return 'image/jpeg';
  if (lower === 'png') return 'image/png';
  return null;
}
