/**
 * =============================================================================
 * PDF Overlay Engine - Type Definitions
 * =============================================================================
 * 범용 PDF 좌표 기반 오버레이 시스템의 타입 정의
 */

/**
 * 텍스트 필드 좌표
 */
export interface TextFieldMapping {
  fieldId: string;           // 필드 고유 ID
  x: number;                 // X 좌표 (좌측 기준)
  y: number;                 // Y 좌표 (하단 기준, PDF 좌표계)
  fontSize?: number;         // 폰트 크기 (기본값: 10)
  maxWidth?: number;         // 최대 너비 (넘치면 줄바꿈)
  page?: number;             // 페이지 번호 (0부터 시작, 기본값: 0)
  align?: 'left' | 'center' | 'right';  // 정렬
  fontColor?: string;        // 폰트 색상 (hex, 기본값: #000000)
  lineHeight?: number;       // 줄 높이 (기본값: 1.2)
}

/**
 * 체크박스 필드 좌표
 */
export interface CheckboxFieldMapping {
  fieldId: string;           // 필드 고유 ID
  x: number;                 // X 좌표
  y: number;                 // Y 좌표
  page?: number;             // 페이지 번호
  trueValue?: string;        // 체크 시 표시할 문자 (기본값: "V")
  falseValue?: string;       // 미체크 시 표시할 문자 (기본값: "")
  fontSize?: number;         // 폰트 크기 (기본값: 12)
}

/**
 * 이미지 필드 좌표 (도장, 서명 등)
 */
export interface ImageFieldMapping {
  fieldId: string;           // 필드 고유 ID
  x: number;                 // X 좌표
  y: number;                 // Y 좌표
  width: number;             // 이미지 너비
  height: number;            // 이미지 높이
  page?: number;             // 페이지 번호
}

/**
 * PDF 매핑 설정
 */
export interface PdfMapping {
  serviceCode: string;       // 서비스 코드 (예: "MAIL_ORDER_SALES")
  serviceName: string;       // 서비스명 (예: "통신판매업 신고서")
  templateFile: string;      // 템플릿 PDF 파일명
  version: string;           // 버전 (예: "2025-01")
  pageCount?: number;        // 총 페이지 수
  description?: string;      // 설명

  fields: TextFieldMapping[];          // 텍스트 필드들
  checkboxes?: CheckboxFieldMapping[]; // 체크박스 필드들
  images?: ImageFieldMapping[];        // 이미지 필드들

  metadata?: {
    source?: string;         // 출처 (예: "국가법령정보센터")
    lastVerified?: string;   // 마지막 검증일
    notes?: string;          // 비고
  };
}

/**
 * 사용자 입력 데이터
 */
export interface UserData {
  [fieldId: string]: string | boolean | number | undefined;
}

/**
 * PDF 생성 옵션
 */
export interface PdfGenerationOptions {
  fontPath?: string;         // 한글 폰트 경로
  fontUrl?: string;          // 한글 폰트 URL (fallback)
  compress?: boolean;        // PDF 압축 여부
  flatten?: boolean;         // 폼 필드 병합 여부
}

/**
 * PDF 생성 결과
 */
export interface PdfGenerationResult {
  success: boolean;
  pdfData?: Uint8Array;
  filename?: string;
  error?: string;
  stats?: {
    fieldsProcessed: number;
    pageCount: number;
    generationTime: number;
  };
}

/**
 * 매핑 검증 결과
 */
export interface MappingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 필드 유형
 */
export type FieldType = 'text' | 'checkbox' | 'image';

/**
 * 좌표 추출 도구용 - 클릭 포인트
 */
export interface ClickPoint {
  x: number;
  y: number;
  page: number;
  fieldId?: string;
  fieldType?: FieldType;
}
