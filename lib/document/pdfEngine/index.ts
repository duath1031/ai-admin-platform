/**
 * =============================================================================
 * Universal PDF Overlay Engine
 * =============================================================================
 * 범용 PDF 좌표 기반 오버레이 시스템
 * - 원본 PDF에 텍스트/체크박스/이미지 오버레이
 * - JSON 매핑 파일 기반 좌표 관리
 * - 한글 폰트 지원
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { promises as fs } from 'fs';
import path from 'path';
import { loadMapping } from './mappingLoader';
import type {
  PdfMapping,
  UserData,
  PdfGenerationOptions,
  PdfGenerationResult,
  TextFieldMapping,
  CheckboxFieldMapping,
  ImageFieldMapping,
} from './types';

// 기본 폰트 경로
const DEFAULT_FONT_PATH = path.join(process.cwd(), 'public', 'fonts', 'NanumGothic.ttf');
const DEFAULT_FONT_URL = 'https://cdn.jsdelivr.net/gh/nicecss/NanumFont@master/NanumGothic.ttf';

// 템플릿 PDF 경로
const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates');

/**
 * PDF 생성 메인 함수
 * @param serviceCode - 서비스 코드
 * @param userData - 사용자 입력 데이터
 * @param options - 생성 옵션
 * @returns PDF 생성 결과
 */
export async function generatePdf(
  serviceCode: string,
  userData: UserData,
  options: PdfGenerationOptions = {}
): Promise<PdfGenerationResult> {
  const startTime = Date.now();

  try {
    // 1. 매핑 로드
    const mapping = await loadMapping(serviceCode);
    if (!mapping) {
      return {
        success: false,
        error: `매핑을 찾을 수 없습니다: ${serviceCode}`,
      };
    }

    // 2. 템플릿 PDF 로드
    const templatePath = path.join(TEMPLATES_DIR, mapping.templateFile);
    let pdfBytes: ArrayBuffer;

    try {
      pdfBytes = await fs.readFile(templatePath);
    } catch (error) {
      return {
        success: false,
        error: `템플릿 PDF를 찾을 수 없습니다: ${mapping.templateFile}`,
      };
    }

    // 3. PDF 문서 로드
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    // 4. 한글 폰트 로드
    const font = await loadKoreanFont(pdfDoc, options);

    // 5. 필드 채우기
    const pages = pdfDoc.getPages();
    let fieldsProcessed = 0;

    // 텍스트 필드 처리
    for (const field of mapping.fields || []) {
      const value = userData[field.fieldId];
      if (value !== undefined && value !== null && value !== '') {
        const page = pages[field.page || 0];
        if (page) {
          await drawTextField(page, field, String(value), font);
          fieldsProcessed++;
        }
      }
    }

    // 체크박스 필드 처리
    for (const checkbox of mapping.checkboxes || []) {
      const value = userData[checkbox.fieldId];
      if (value !== undefined) {
        const page = pages[checkbox.page || 0];
        if (page) {
          await drawCheckbox(page, checkbox, Boolean(value), font);
          fieldsProcessed++;
        }
      }
    }

    // 이미지 필드 처리
    for (const imageField of mapping.images || []) {
      const value = userData[imageField.fieldId];
      if (value && typeof value === 'string') {
        const page = pages[imageField.page || 0];
        if (page) {
          await drawImage(pdfDoc, page, imageField, value);
          fieldsProcessed++;
        }
      }
    }

    // 6. PDF 저장
    const filledPdfBytes = await pdfDoc.save({
      useObjectStreams: options.compress !== false,
    });

    const generationTime = Date.now() - startTime;

    console.log(`[PDF Engine] Generated: ${serviceCode} (${fieldsProcessed} fields, ${generationTime}ms)`);

    return {
      success: true,
      pdfData: filledPdfBytes,
      filename: `${mapping.serviceName}_${new Date().toISOString().slice(0, 10)}.pdf`,
      stats: {
        fieldsProcessed,
        pageCount: pages.length,
        generationTime,
      },
    };

  } catch (error) {
    console.error('[PDF Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF 생성 중 오류 발생',
    };
  }
}

/**
 * 한글 폰트 로드
 */
async function loadKoreanFont(
  pdfDoc: PDFDocument,
  options: PdfGenerationOptions
): Promise<PDFFont> {
  // 1. 옵션에서 지정된 경로 시도
  if (options.fontPath) {
    try {
      const fontBytes = await fs.readFile(options.fontPath);
      return await pdfDoc.embedFont(fontBytes);
    } catch (e) {
      console.warn('[PDF Engine] Custom font not found:', options.fontPath);
    }
  }

  // 2. 기본 로컬 폰트 시도
  try {
    const fontBytes = await fs.readFile(DEFAULT_FONT_PATH);
    return await pdfDoc.embedFont(fontBytes);
  } catch (e) {
    console.warn('[PDF Engine] Local font not found, trying URL');
  }

  // 3. URL에서 폰트 다운로드
  const fontUrl = options.fontUrl || DEFAULT_FONT_URL;
  try {
    const response = await fetch(fontUrl);
    if (response.ok) {
      const fontBytes = await response.arrayBuffer();
      return await pdfDoc.embedFont(fontBytes);
    }
  } catch (e) {
    console.warn('[PDF Engine] Font download failed:', fontUrl);
  }

  // 4. 폴백: 기본 폰트 (한글 미지원)
  console.warn('[PDF Engine] Using Helvetica (Korean not supported)');
  return await pdfDoc.embedFont(StandardFonts.Helvetica);
}

/**
 * 텍스트 필드 그리기
 */
async function drawTextField(
  page: PDFPage,
  field: TextFieldMapping,
  value: string,
  font: PDFFont
): Promise<void> {
  const fontSize = field.fontSize || 10;
  const lineHeight = field.lineHeight || 1.2;

  // 색상 파싱
  const color = parseColor(field.fontColor || '#000000');

  // 최대 너비가 지정된 경우 줄바꿈 처리
  if (field.maxWidth) {
    const lines = wrapText(value, font, fontSize, field.maxWidth);
    let yOffset = 0;

    for (const line of lines) {
      const x = calculateX(line, field, font, fontSize);

      page.drawText(line, {
        x,
        y: field.y - yOffset,
        size: fontSize,
        font,
        color,
      });

      yOffset += fontSize * lineHeight;
    }
  } else {
    const x = calculateX(value, field, font, fontSize);

    page.drawText(value, {
      x,
      y: field.y,
      size: fontSize,
      font,
      color,
    });
  }
}

/**
 * 체크박스 그리기
 */
async function drawCheckbox(
  page: PDFPage,
  field: CheckboxFieldMapping,
  checked: boolean,
  font: PDFFont
): Promise<void> {
  const fontSize = field.fontSize || 12;
  const text = checked
    ? (field.trueValue || 'V')
    : (field.falseValue || '');

  if (text) {
    page.drawText(text, {
      x: field.x,
      y: field.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

/**
 * 이미지 그리기 (도장, 서명 등)
 */
async function drawImage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  field: ImageFieldMapping,
  imageData: string
): Promise<void> {
  try {
    let image;

    // Base64 또는 URL 처리
    if (imageData.startsWith('data:image/png')) {
      const base64Data = imageData.split(',')[1];
      const imageBytes = Buffer.from(base64Data, 'base64');
      image = await pdfDoc.embedPng(imageBytes);
    } else if (imageData.startsWith('data:image/jpeg') || imageData.startsWith('data:image/jpg')) {
      const base64Data = imageData.split(',')[1];
      const imageBytes = Buffer.from(base64Data, 'base64');
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      // URL인 경우 다운로드
      const response = await fetch(imageData);
      const imageBytes = await response.arrayBuffer();

      if (imageData.toLowerCase().includes('.png')) {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        image = await pdfDoc.embedJpg(imageBytes);
      }
    }

    page.drawImage(image, {
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
    });

  } catch (error) {
    console.error(`[PDF Engine] Image embedding failed for ${field.fieldId}:`, error);
  }
}

/**
 * 텍스트 줄바꿈
 */
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const words = text.split('');  // 한글은 글자 단위로 분리

  let currentLine = '';

  for (const char of words) {
    const testLine = currentLine + char;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * X 좌표 계산 (정렬 적용)
 */
function calculateX(
  text: string,
  field: TextFieldMapping,
  font: PDFFont,
  fontSize: number
): number {
  if (!field.align || field.align === 'left') {
    return field.x;
  }

  const textWidth = font.widthOfTextAtSize(text, fontSize);

  if (field.align === 'center' && field.maxWidth) {
    return field.x + (field.maxWidth - textWidth) / 2;
  }

  if (field.align === 'right' && field.maxWidth) {
    return field.x + field.maxWidth - textWidth;
  }

  return field.x;
}

/**
 * 색상 파싱 (hex -> rgb)
 */
function parseColor(hex: string): ReturnType<typeof rgb> {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    );
  }
  return rgb(0, 0, 0);
}

/**
 * 지원되는 서비스 코드 목록 조회
 */
export async function getAvailableTemplates(): Promise<string[]> {
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    return files
      .filter(f => f.endsWith('.pdf'))
      .map(f => f.replace('.pdf', ''));
  } catch {
    return [];
  }
}

// Re-export types
export * from './types';
export * from './mappingLoader';
