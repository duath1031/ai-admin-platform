/**
 * =============================================================================
 * Document Processor
 * =============================================================================
 * 다양한 문서 형식(PDF, HWP, DOCX, TXT)에서 텍스트 추출
 * - PDF: pdf-parse 사용
 * - HWP: hwp.js 또는 fun-hwp 사용
 * - DOCX: mammoth 사용
 * - TXT: 직접 읽기
 */

// PDF 파싱은 동적 import로 처리 (서버 사이드 전용)
// HWP 파싱은 별도 라이브러리 필요

export interface ExtractedDocument {
  text: string;
  pages?: Array<{ pageNumber: number; text: string }>;
  sections?: Array<{ title?: string; content: string }>;
  metadata?: {
    title?: string;
    author?: string;
    createdAt?: string;
    pageCount?: number;
  };
}

export interface ProcessingResult {
  success: boolean;
  document?: ExtractedDocument;
  error?: string;
}

/**
 * 파일 타입에 따라 텍스트 추출
 */
export async function extractTextFromFile(
  buffer: Buffer,
  fileType: string,
  fileName: string
): Promise<ProcessingResult> {
  const type = fileType.toLowerCase();

  try {
    switch (type) {
      case "pdf":
        return await extractFromPDF(buffer);
      case "hwp":
        return await extractFromHWP(buffer);
      case "docx":
        return await extractFromDOCX(buffer);
      case "txt":
        return extractFromTXT(buffer);
      default:
        return {
          success: false,
          error: `Unsupported file type: ${type}`,
        };
    }
  } catch (error) {
    console.error(`[DocumentProcessor] Error processing ${fileName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * PDF 텍스트 추출
 */
async function extractFromPDF(buffer: Buffer): Promise<ProcessingResult> {
  try {
    // 동적 import (서버 사이드 전용)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require("pdf-parse");

    const data = await pdfParse(buffer);

    // 페이지별 텍스트 추출 시도
    // pdf-parse는 기본적으로 전체 텍스트만 제공
    // 페이지 구분이 필요하면 pdf.js 사용 고려

    return {
      success: true,
      document: {
        text: data.text,
        metadata: {
          title: data.info?.Title,
          author: data.info?.Author,
          pageCount: data.numpages,
        },
      },
    };
  } catch (error) {
    console.error("[DocumentProcessor] PDF parsing error:", error);
    return {
      success: false,
      error: `PDF parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * HWP 텍스트 추출
 * 주의: HWP 파일은 현재 지원되지 않음 (hwp.js가 텍스트 추출 기능이 제한적)
 * 사용자에게 PDF 변환 권장
 */
async function extractFromHWP(buffer: Buffer): Promise<ProcessingResult> {
  // hwp.js는 뷰어용이며 텍스트 추출이 제한적
  // 사용자에게 PDF 변환 권장
  console.log("[DocumentProcessor] HWP file detected - recommending PDF conversion");
  return {
    success: false,
    error: "HWP 파일은 현재 지원되지 않습니다. PDF로 변환하여 업로드해주세요. (한글에서 파일 > 다른 이름으로 저장 > PDF)",
  };
}

/**
 * DOCX 텍스트 추출
 */
async function extractFromDOCX(buffer: Buffer): Promise<ProcessingResult> {
  try {
    // mammoth 사용
    // npm install mammoth 필요
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });

    return {
      success: true,
      document: {
        text: result.value,
      },
    };
  } catch (error) {
    console.error("[DocumentProcessor] DOCX parsing error:", error);

    // mammoth 없으면 docx 패키지의 기존 기능 활용 시도
    try {
      const { Document, Packer, Paragraph, TextRun } = await import("docx");
      // docx 패키지는 생성용이라 읽기에 적합하지 않음
      return {
        success: false,
        error: "DOCX 파일 읽기를 위해 mammoth 라이브러리를 설치해주세요: npm install mammoth",
      };
    } catch {
      return {
        success: false,
        error: `DOCX parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}

/**
 * TXT 텍스트 추출
 */
function extractFromTXT(buffer: Buffer): ProcessingResult {
  try {
    // UTF-8 디코딩 시도
    let text = buffer.toString("utf-8");

    // BOM 제거
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    // EUC-KR 감지 및 변환 (한글 깨짐 방지)
    // 실제로는 iconv-lite 같은 라이브러리 필요
    // npm install iconv-lite

    return {
      success: true,
      document: {
        text,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `TXT parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * 파일 확장자로 파일 타입 추출
 */
export function getFileType(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase();

  const supportedTypes: Record<string, string> = {
    pdf: "pdf",
    hwp: "hwp",
    docx: "docx",
    doc: "docx", // .doc은 지원하지 않지만 시도는 해봄
    txt: "txt",
    text: "txt",
    md: "txt",
    markdown: "txt",
  };

  return supportedTypes[extension || ""] || null;
}

/**
 * 지원하는 파일 형식 목록
 */
export function getSupportedFileTypes(): string[] {
  return ["pdf", "hwp", "docx", "txt"];
}

/**
 * 파일 크기 검증
 */
export function validateFileSize(size: number, maxSizeMB: number = 50): {
  valid: boolean;
  error?: string;
} {
  const maxSize = maxSizeMB * 1024 * 1024;

  if (size > maxSize) {
    return {
      valid: false,
      error: `파일 크기가 ${maxSizeMB}MB를 초과합니다.`,
    };
  }

  return { valid: true };
}

/**
 * 추출된 텍스트 정리
 */
export function cleanExtractedText(text: string): string {
  return text
    // 연속된 공백 정리
    .replace(/[ \t]+/g, " ")
    // 연속된 줄바꿈 정리
    .replace(/\n{3,}/g, "\n\n")
    // 시작/끝 공백 제거
    .trim();
}
