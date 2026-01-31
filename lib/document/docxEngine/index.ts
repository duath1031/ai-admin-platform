/**
 * =============================================================================
 * DOCX Template Engine (The Writer)
 * =============================================================================
 * 텍스트 치환(Placeholder) 기반 문서 생성 시스템
 * - {{변수명}} 형태의 플레이스홀더 치환
 * - HWP 파일은 DOCX로 변환 후 처리
 * - 좌표 매핑 불필요, 수천 개 서식에 즉시 대응 가능
 */

import createReport from 'docx-templates';
import { promises as fs } from 'fs';
import path from 'path';

// 템플릿 디렉토리
const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates', 'docx');

/**
 * 문서 생성 결과 타입
 */
export interface DocxGenerationResult {
  success: boolean;
  docxData?: Uint8Array;
  filename?: string;
  error?: string;
  stats?: {
    templateName: string;
    fieldsReplaced: number;
    generationTime: number;
  };
}

/**
 * 템플릿 메타데이터 타입
 */
export interface TemplateMetadata {
  code: string;
  name: string;
  category: string;
  description: string;
  fields: TemplateField[];
  gov24Link?: string;
  requiredDocuments?: string[];
}

export interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'phone' | 'email' | 'address';
  required?: boolean;
  placeholder?: string;
  options?: string[]; // for select type
  validation?: string; // regex pattern
  defaultValue?: string;
}

/**
 * DOCX 문서 생성 메인 함수
 * @param templateCode - 템플릿 코드 (예: MAIL_ORDER_SALES)
 * @param data - 치환할 데이터
 * @param templateBuffer - 직접 전달할 DOCX Buffer (DB 템플릿용, 선택)
 * @returns 생성된 DOCX 바이너리
 */
export async function generateDocx(
  templateCode: string,
  data: Record<string, unknown>,
  templateBuffer?: Buffer
): Promise<DocxGenerationResult> {
  const startTime = Date.now();

  try {
    // 1. 템플릿 파일 로드: Buffer 직접 전달 또는 파일시스템
    if (!templateBuffer) {
      const templatePath = path.join(TEMPLATES_DIR, `${templateCode}.docx`);
      try {
        templateBuffer = await fs.readFile(templatePath);
      } catch (error) {
        return {
          success: false,
          error: `템플릿을 찾을 수 없습니다: ${templateCode}.docx`,
        };
      }
    }

    // 2. 데이터 전처리 (날짜, 숫자 포맷팅 등)
    const processedData = preprocessData(data);

    // 3. docx-templates로 문서 생성
    const buffer = await createReport({
      template: templateBuffer,
      data: processedData,
      cmdDelimiter: ['{{', '}}'], // Mustache 스타일 구분자
      processLineBreaks: true, // \n을 줄바꿈으로 처리
      failFast: false, // 에러가 있어도 계속 진행
    });

    const generationTime = Date.now() - startTime;

    // 치환된 필드 수 추정 (데이터 키 개수)
    const fieldsReplaced = Object.keys(data).filter(
      key => data[key] !== undefined && data[key] !== null && data[key] !== ''
    ).length;

    console.log(`[DOCX Engine] Generated: ${templateCode} (${fieldsReplaced} fields, ${generationTime}ms)`);

    return {
      success: true,
      docxData: new Uint8Array(buffer),
      filename: `${templateCode}_${formatDate(new Date())}.docx`,
      stats: {
        templateName: templateCode,
        fieldsReplaced,
        generationTime,
      },
    };

  } catch (error) {
    console.error('[DOCX Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '문서 생성 중 오류 발생',
    };
  }
}

/**
 * 데이터 전처리
 * - 날짜 포맷팅
 * - 전화번호 포맷팅
 * - 금액 포맷팅
 */
function preprocessData(data: Record<string, unknown>): Record<string, unknown> {
  const processed: Record<string, unknown> = { ...data };

  // 현재 날짜 자동 추가
  const now = new Date();
  processed.today = formatDate(now);
  processed.todayYear = now.getFullYear().toString();
  processed.todayMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  processed.todayDay = now.getDate().toString().padStart(2, '0');

  // 각 필드 처리
  for (const [key, value] of Object.entries(processed)) {
    if (value === undefined || value === null) {
      processed[key] = '';
      continue;
    }

    // 전화번호 포맷팅
    if (key.toLowerCase().includes('phone') || key.toLowerCase().includes('tel')) {
      processed[key] = formatPhoneNumber(String(value));
    }

    // 금액 포맷팅
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('price')) {
      processed[key] = formatMoney(value);
    }

    // 날짜 포맷팅 (ISO 형식인 경우)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        processed[key] = formatDate(date);
        processed[`${key}Year`] = date.getFullYear().toString();
        processed[`${key}Month`] = (date.getMonth() + 1).toString().padStart(2, '0');
        processed[`${key}Day`] = date.getDate().toString().padStart(2, '0');
      }
    }
  }

  return processed;
}

/**
 * 날짜 포맷팅 (YYYY년 MM월 DD일)
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 전화번호 포맷팅
 */
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
  }

  return phone;
}

/**
 * 금액 포맷팅 (천 단위 콤마)
 */
function formatMoney(value: unknown): string {
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num)) return String(value);
  return num.toLocaleString('ko-KR');
}

/**
 * 사용 가능한 템플릿 목록 조회
 */
export async function getAvailableTemplates(): Promise<string[]> {
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    const files = await fs.readdir(TEMPLATES_DIR);
    return files
      .filter(f => f.endsWith('.docx') && !f.startsWith('~'))
      .map(f => f.replace('.docx', ''));
  } catch (error) {
    console.error('[DOCX Engine] Error listing templates:', error);
    return [];
  }
}

/**
 * 템플릿 메타데이터 조회
 * 템플릿과 같은 이름의 .json 파일에서 메타데이터 로드
 */
export async function getTemplateMetadata(templateCode: string): Promise<TemplateMetadata | null> {
  try {
    const metadataPath = path.join(TEMPLATES_DIR, `${templateCode}.json`);
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content) as TemplateMetadata;
  } catch {
    // 메타데이터 파일이 없으면 기본값 반환
    return null;
  }
}

/**
 * 모든 템플릿 메타데이터 조회
 */
export async function getAllTemplateMetadata(): Promise<TemplateMetadata[]> {
  const templates = await getAvailableTemplates();
  const metadataList: TemplateMetadata[] = [];

  for (const code of templates) {
    const metadata = await getTemplateMetadata(code);
    if (metadata) {
      metadataList.push(metadata);
    } else {
      // 메타데이터 없는 템플릿은 기본 정보로 추가
      metadataList.push({
        code,
        name: code,
        category: '기타',
        description: '',
        fields: [],
      });
    }
  }

  return metadataList;
}

/**
 * 템플릿 파일 저장 (관리자용)
 */
export async function saveTemplate(
  templateCode: string,
  docxBuffer: Buffer,
  metadata?: TemplateMetadata
): Promise<boolean> {
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });

    // DOCX 파일 저장
    const templatePath = path.join(TEMPLATES_DIR, `${templateCode}.docx`);
    await fs.writeFile(templatePath, docxBuffer);

    // 메타데이터 저장
    if (metadata) {
      const metadataPath = path.join(TEMPLATES_DIR, `${templateCode}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    console.log(`[DOCX Engine] Template saved: ${templateCode}`);
    return true;
  } catch (error) {
    console.error('[DOCX Engine] Error saving template:', error);
    return false;
  }
}

/**
 * 템플릿 삭제 (관리자용)
 */
export async function deleteTemplate(templateCode: string): Promise<boolean> {
  try {
    const templatePath = path.join(TEMPLATES_DIR, `${templateCode}.docx`);
    const metadataPath = path.join(TEMPLATES_DIR, `${templateCode}.json`);

    await fs.unlink(templatePath).catch(() => {});
    await fs.unlink(metadataPath).catch(() => {});

    console.log(`[DOCX Engine] Template deleted: ${templateCode}`);
    return true;
  } catch (error) {
    console.error('[DOCX Engine] Error deleting template:', error);
    return false;
  }
}
