/**
 * =============================================================================
 * PDF Mapping Loader
 * =============================================================================
 * JSON 매핑 파일 로드 및 검증
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  PdfMapping,
  MappingValidationResult,
  TextFieldMapping,
  CheckboxFieldMapping,
} from './types';

// 매핑 파일 기본 경로
const MAPPINGS_DIR = path.join(process.cwd(), 'data', 'mappings');

// 메모리 캐시
const mappingCache = new Map<string, PdfMapping>();

/**
 * 매핑 파일 로드
 * @param serviceCode - 서비스 코드
 * @returns 매핑 정보
 */
export async function loadMapping(serviceCode: string): Promise<PdfMapping | null> {
  // 캐시 확인
  if (mappingCache.has(serviceCode)) {
    return mappingCache.get(serviceCode)!;
  }

  const filePath = path.join(MAPPINGS_DIR, `${serviceCode}.json`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const mapping: PdfMapping = JSON.parse(content);

    // 캐시 저장
    mappingCache.set(serviceCode, mapping);

    return mapping;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`[MappingLoader] Mapping not found: ${serviceCode}`);
      return null;
    }
    console.error(`[MappingLoader] Error loading mapping: ${serviceCode}`, error);
    throw error;
  }
}

/**
 * 모든 매핑 파일 목록 조회
 * @returns 사용 가능한 서비스 코드 목록
 */
export async function listAvailableMappings(): Promise<string[]> {
  try {
    const files = await fs.readdir(MAPPINGS_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (error) {
    console.error('[MappingLoader] Error listing mappings:', error);
    return [];
  }
}

/**
 * 매핑 파일 저장
 * @param mapping - 매핑 정보
 */
export async function saveMapping(mapping: PdfMapping): Promise<void> {
  const filePath = path.join(MAPPINGS_DIR, `${mapping.serviceCode}.json`);

  // 디렉토리 확인/생성
  await fs.mkdir(MAPPINGS_DIR, { recursive: true });

  // JSON 저장
  await fs.writeFile(
    filePath,
    JSON.stringify(mapping, null, 2),
    'utf-8'
  );

  // 캐시 갱신
  mappingCache.set(mapping.serviceCode, mapping);
}

/**
 * 매핑 검증
 * @param mapping - 검증할 매핑
 * @returns 검증 결과
 */
export function validateMapping(mapping: PdfMapping): MappingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 필수 필드 검증
  if (!mapping.serviceCode) {
    errors.push('serviceCode는 필수입니다.');
  }
  if (!mapping.serviceName) {
    errors.push('serviceName은 필수입니다.');
  }
  if (!mapping.templateFile) {
    errors.push('templateFile은 필수입니다.');
  }
  if (!mapping.version) {
    errors.push('version은 필수입니다.');
  }

  // 필드 검증
  if (!mapping.fields || mapping.fields.length === 0) {
    warnings.push('텍스트 필드가 정의되지 않았습니다.');
  } else {
    const fieldIds = new Set<string>();

    for (const field of mapping.fields) {
      // 중복 ID 검사
      if (fieldIds.has(field.fieldId)) {
        errors.push(`중복된 fieldId: ${field.fieldId}`);
      }
      fieldIds.add(field.fieldId);

      // 좌표 검증
      if (field.x < 0 || field.y < 0) {
        warnings.push(`필드 ${field.fieldId}의 좌표가 음수입니다.`);
      }

      // 페이지 번호 검증
      if (field.page !== undefined && field.page < 0) {
        errors.push(`필드 ${field.fieldId}의 page가 음수입니다.`);
      }
    }

    // 체크박스 검증
    if (mapping.checkboxes) {
      for (const checkbox of mapping.checkboxes) {
        if (fieldIds.has(checkbox.fieldId)) {
          errors.push(`중복된 fieldId: ${checkbox.fieldId}`);
        }
        fieldIds.add(checkbox.fieldId);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 캐시 초기화
 */
export function clearMappingCache(): void {
  mappingCache.clear();
}

/**
 * 특정 매핑 캐시 제거
 * @param serviceCode - 서비스 코드
 */
export function invalidateMapping(serviceCode: string): void {
  mappingCache.delete(serviceCode);
}

/**
 * 매핑에서 필드 ID 목록 추출
 * @param mapping - 매핑 정보
 * @returns 필드 ID 목록
 */
export function getFieldIds(mapping: PdfMapping): string[] {
  const ids: string[] = [];

  if (mapping.fields) {
    ids.push(...mapping.fields.map(f => f.fieldId));
  }
  if (mapping.checkboxes) {
    ids.push(...mapping.checkboxes.map(f => f.fieldId));
  }
  if (mapping.images) {
    ids.push(...mapping.images.map(f => f.fieldId));
  }

  return ids;
}

/**
 * 기본 매핑 템플릿 생성
 * @param serviceCode - 서비스 코드
 * @param serviceName - 서비스명
 * @returns 기본 매핑
 */
export function createDefaultMapping(
  serviceCode: string,
  serviceName: string
): PdfMapping {
  return {
    serviceCode,
    serviceName,
    templateFile: `${serviceCode}.pdf`,
    version: new Date().toISOString().slice(0, 7), // YYYY-MM
    fields: [],
    checkboxes: [],
    images: [],
    metadata: {
      lastVerified: new Date().toISOString(),
      notes: '',
    },
  };
}

/**
 * 매핑 병합 (업데이트용)
 * @param existing - 기존 매핑
 * @param updates - 업데이트할 내용
 * @returns 병합된 매핑
 */
export function mergeMapping(
  existing: PdfMapping,
  updates: Partial<PdfMapping>
): PdfMapping {
  return {
    ...existing,
    ...updates,
    fields: updates.fields || existing.fields,
    checkboxes: updates.checkboxes || existing.checkboxes,
    images: updates.images || existing.images,
    metadata: {
      ...existing.metadata,
      ...updates.metadata,
    },
  };
}
