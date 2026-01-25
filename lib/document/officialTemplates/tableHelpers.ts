/**
 * =============================================================================
 * 공통 테이블 헬퍼 함수
 * =============================================================================
 * 모든 공식 양식 템플릿에서 공유하는 테이블 관련 함수
 */

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
  TableLayoutType,
} from "docx";

// 표준 테두리 스타일
export const borderStyle = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

// 헤더 셀 스타일 (회색 배경)
export const headerCellStyle = {
  shading: { fill: "F5F5F5" },
};

// 표준 테이블 너비 (A4 용지 기준, 좌우 마진 제외)
export const TABLE_WIDTH = 9500; // DXA 단위

/**
 * 표준 테이블 옵션 생성
 */
export function getTableOptions() {
  return {
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
  };
}

/**
 * 너비를 퍼센트에서 DXA로 변환
 * @param percent 퍼센트 (0-100)
 */
export function percentToDxa(percent: number): number {
  return Math.round((TABLE_WIDTH * percent) / 100);
}

/**
 * 셀 문단 생성
 */
export function createCellParagraph(text: string, bold: boolean): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold,
        size: 20,
      }),
    ],
    alignment: AlignmentType.CENTER,
  });
}

/**
 * 헤더 셀 생성 (회색 배경)
 */
export function createHeaderCell(text: string, widthDxa: number, colSpan?: number): TableCell {
  return new TableCell({
    children: [createCellParagraph(text, true)],
    width: { size: widthDxa, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: colSpan,
    ...headerCellStyle,
    borders: borderStyle,
  });
}

/**
 * 데이터 셀 생성
 */
export function createDataCell(text: string, widthDxa: number): TableCell {
  return new TableCell({
    children: [createCellParagraph(text, false)],
    width: { size: widthDxa, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    borders: borderStyle,
  });
}

/**
 * 병합된 데이터 셀 생성
 */
export function createMergedDataCell(text: string, widthDxa: number, colSpan: number): TableCell {
  return new TableCell({
    children: [createCellParagraph(text, false)],
    width: { size: widthDxa, type: WidthType.DXA },
    columnSpan: colSpan,
    verticalAlign: VerticalAlign.CENTER,
    borders: borderStyle,
  });
}

/**
 * 전화번호 포맷팅
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD -> YYYY년 MM월 DD일)
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("-")) {
    const [year, month, day] = dateStr.split("-");
    return `${year}년 ${month}월 ${day}일`;
  }
  return dateStr;
}

/**
 * 주민등록번호 포맷팅 (앞 6자리 + 마스킹)
 */
export function formatResidentNumber(num: string): string {
  const digits = num.replace(/\D/g, "");
  if (digits.length >= 6) {
    return `${digits.slice(0, 6)}-*******`;
  }
  return num;
}
