/**
 * =============================================================================
 * PDF 양식 채우기 시스템
 * =============================================================================
 * 국가법령정보센터 공식 PDF 양식에 데이터를 채워서 반환
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { FormData } from "../generator";

// 공식 PDF 양식 URL (국가법령정보센터)
export const OFFICIAL_PDF_URLS: Record<string, string> = {
  "통신판매업신고서": "https://law.go.kr/LSW/flDownload.do?flSeq=148998367",
  // 추가 양식 URL들...
};

// 각 양식별 필드 좌표 정의
interface FieldCoordinate {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

// 통신판매업 신고서 필드 좌표 (PDF 좌표계: 좌하단 기준)
const MAIL_ORDER_SALES_COORDINATES: Record<string, FieldCoordinate> = {
  companyName: { x: 200, y: 645, fontSize: 10 },
  corporateNumber: { x: 430, y: 645, fontSize: 10 },
  companyAddress: { x: 200, y: 620, fontSize: 9, maxWidth: 300 },
  companyPhone: { x: 200, y: 595, fontSize: 10 },
  representativeName: { x: 200, y: 570, fontSize: 10 },
  residentNumber: { x: 430, y: 570, fontSize: 10 },
  representativeAddress: { x: 200, y: 545, fontSize: 9, maxWidth: 300 },
  email: { x: 200, y: 520, fontSize: 10 },
  businessNumber: { x: 430, y: 520, fontSize: 10 },
  domainName: { x: 200, y: 495, fontSize: 10, maxWidth: 300 },
  hostServer: { x: 200, y: 470, fontSize: 10 },
};

/**
 * 공식 PDF 양식 다운로드
 */
async function downloadOfficialPdf(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PDF 다운로드 실패: ${response.status}`);
  }
  return await response.arrayBuffer();
}

/**
 * 한글 폰트 로드 (NanumGothic 또는 시스템 폰트)
 */
async function loadKoreanFont(): Promise<ArrayBuffer | null> {
  // 구글 폰트에서 나눔고딕 로드 시도
  try {
    const fontUrl = "https://cdn.jsdelivr.net/gh/nicecss/NanumFont@master/NanumGothic.ttf";
    const response = await fetch(fontUrl);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch (e) {
    console.error("Font download failed:", e);
  }
  return null;
}

/**
 * PDF에 텍스트 채우기
 */
export async function fillPdfForm(
  templateKey: string,
  data: FormData
): Promise<{ success: boolean; pdfData?: Uint8Array; error?: string }> {
  try {
    const pdfUrl = OFFICIAL_PDF_URLS[templateKey];

    if (!pdfUrl) {
      return { success: false, error: `지원하지 않는 양식입니다: ${templateKey}` };
    }

    // 공식 PDF 다운로드
    console.log(`[PDF Filler] Downloading official PDF: ${templateKey}`);
    const pdfBytes = await downloadOfficialPdf(pdfUrl);

    // PDF 문서 로드
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // fontkit 등록 (한글 폰트 지원)
    pdfDoc.registerFontkit(fontkit);

    // 한글 폰트 로드 및 임베드
    const koreanFontBytes = await loadKoreanFont();
    let font;

    if (koreanFontBytes) {
      font = await pdfDoc.embedFont(koreanFontBytes);
    } else {
      // 폴백: 기본 폰트 (한글 지원 안 됨)
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      console.warn("[PDF Filler] Korean font not available, using Helvetica");
    }

    // 첫 번째 페이지 가져오기
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // 필드별 좌표 가져오기
    const coordinates = getCoordinates(templateKey);

    if (!coordinates) {
      return { success: false, error: `좌표 정의가 없습니다: ${templateKey}` };
    }

    // 데이터 채우기
    for (const [fieldId, coord] of Object.entries(coordinates)) {
      const value = data[fieldId];
      if (value !== undefined && value !== null && value !== "") {
        const text = String(value);
        const fontSize = coord.fontSize || 10;

        firstPage.drawText(text, {
          x: coord.x,
          y: coord.y,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
          maxWidth: coord.maxWidth,
        });
      }
    }

    // PDF 저장
    const filledPdfBytes = await pdfDoc.save();

    console.log(`[PDF Filler] Successfully filled PDF: ${templateKey}`);

    return {
      success: true,
      pdfData: filledPdfBytes,
    };
  } catch (error) {
    console.error("[PDF Filler] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "PDF 생성 중 오류 발생",
    };
  }
}

/**
 * 템플릿별 좌표 가져오기
 */
function getCoordinates(templateKey: string): Record<string, FieldCoordinate> | null {
  switch (templateKey) {
    case "통신판매업신고서":
      return MAIL_ORDER_SALES_COORDINATES;
    default:
      return null;
  }
}

/**
 * 지원하는 PDF 양식인지 확인
 */
export function hasPdfTemplate(templateKey: string): boolean {
  return templateKey in OFFICIAL_PDF_URLS;
}
