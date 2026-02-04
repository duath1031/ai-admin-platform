/**
 * =============================================================================
 * Document Module - 서식 생성 시스템
 * =============================================================================
 * AI 행정 비서의 핵심 기능
 * - 서식 템플릿 관리
 * - 정부24 딥링크 관리
 * - 문서 생성
 */

// 템플릿 시스템
export {
  FORM_TEMPLATES,
  findTemplate,
  getTemplatesByCategory,
  getAllTemplates,
  type FormField,
  type FormTemplate,
} from "./templates";

// 정부24 링크 시스템
export {
  GOV24_SERVICES,
  getGov24SearchUrl,
  findGov24Service,
  getServicesByCategory,
  getAllCategories,
  type Gov24Service,
} from "./gov24Links";

// 문서 생성기
export {
  generateDocx,
  validateFormData,
  generateFileName,
  formatFieldValue,
  getTemplateFields,
  getMissingFields,
  generateResponseMessage,
  getGov24ServiceInfo,
  type GeneratedDocument,
  type FormData,
} from "./generator";

// HWPX 엔진 (Phase 9)
export {
  generateHwpx,
  extractPlaceholders,
  saveHwpxToTemp,
  type HwpxFieldMapping,
  type HwpxGenerateResult,
} from "../hwpx";
