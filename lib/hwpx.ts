/**
 * =============================================================================
 * Phase 9: HWPX Document Engine
 * =============================================================================
 *
 * HWPX (한글 표준 문서) 파일을 ZIP으로 해체하여 내부 XML의
 * {{placeholder}} 텍스트만 치환한 뒤 다시 압축하는 엔진.
 * 레이아웃은 100% 보존된다.
 *
 * HWPX 구조:
 *   *.hwpx (ZIP)
 *   ├── [Content_Types].xml
 *   ├── META-INF/
 *   ├── Contents/
 *   │   ├── header0.xml, header1.xml ...
 *   │   ├── section0.xml  ← 본문 (치환 대상)
 *   │   └── content.hpf
 *   └── Preview/
 *
 * @module lib/hwpx
 */

import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

export interface HwpxFieldMapping {
  [placeholder: string]: string; // e.g. { "상호": "주식회사 어드미니", "성명": "염현수" }
}

export interface HwpxGenerateResult {
  success: boolean;
  buffer?: Buffer;
  fileName?: string;
  error?: string;
  replacedCount?: number;
}

// =============================================================================
// XML Safety
// =============================================================================

/**
 * XML 특수문자 이스케이프
 * HWPX 내부 XML이 깨지지 않도록 치환 데이터의 특수문자를 처리한다.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =============================================================================
// Core: Placeholder Replacement in XML
// =============================================================================

/**
 * XML 텍스트 내에서 {{key}} 패턴을 찾아 치환한다.
 *
 * HWPX에서는 한글 에디터가 {{상호}} 같은 텍스트를 여러 XML 런(run) 태그에
 * 걸쳐 분할 저장할 수 있다. 예:
 *   <hp:t>{{상</hp:t><hp:t>호}}</hp:t>
 *
 * 이를 처리하기 위해 두 단계로 접근:
 * 1단계: 단순 replaceAll (분할되지 않은 경우)
 * 2단계: 태그를 제거한 텍스트에서 위치를 찾아 원본 XML을 재조합 (분할된 경우)
 */
function replacePlaceholders(xml: string, data: HwpxFieldMapping): { result: string; count: number } {
  let result = xml;
  let totalCount = 0;

  // 1단계: 직접 치환 (태그 내에 온전히 존재하는 플레이스홀더)
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    const safeValue = escapeXml(value);
    const before = result;
    result = result.replaceAll(placeholder, safeValue);
    if (result !== before) {
      const occurrences = (before.split(placeholder).length - 1);
      totalCount += occurrences;
    }
  }

  // 2단계: XML 태그에 의해 분할된 플레이스홀더 처리
  // <hp:t> 태그 사이에 걸쳐있는 {{...}} 패턴을 찾아 치환
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    const safeValue = escapeXml(value);

    // hp:t 태그들의 텍스트를 합쳐서 placeholder가 있는지 확인
    const tagPattern = new RegExp('<hp:t[^>]*>(.*?)<\\/hp:t>', 'g');
    let segments: Array<{ fullMatch: string; text: string; start: number; end: number }> = [];
    let match;

    while ((match = tagPattern.exec(result)) !== null) {
      segments.push({
        fullMatch: match[0],
        text: match[1],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // 연속된 세그먼트들의 텍스트를 이어 붙여서 placeholder를 찾는다
    for (let i = 0; i < segments.length; i++) {
      let combined = '';
      let endIdx = i;

      for (let j = i; j < segments.length && j < i + 10; j++) {
        combined += segments[j].text;
        if (combined.includes(placeholder)) {
          endIdx = j;
          break;
        }
        // 연속되지 않는 세그먼트면 중단
        if (j + 1 < segments.length) {
          const gap = result.substring(segments[j].end, segments[j + 1].start);
          // 태그 사이에 다른 텍스트 태그가 아닌 것만 허용
          if (gap.includes('<hp:t')) break;
        }
      }

      if (combined.includes(placeholder) && endIdx > i) {
        // 분할된 placeholder 발견: 첫 번째 태그에 치환된 값을 넣고 나머지는 비운다
        const replaced = combined.replace(placeholder, safeValue);
        const firstSegment = segments[i];
        const lastSegment = segments[endIdx];

        // 첫 번째 세그먼트에 전체 치환 결과를 넣는다
        const newFirst = firstSegment.fullMatch.replace(
          `>${firstSegment.text}</hp:t>`,
          `>${replaced}</hp:t>`
        );

        // 중간~마지막 세그먼트의 텍스트를 비운다
        let rebuilt = result.substring(0, firstSegment.start) + newFirst;
        for (let k = i + 1; k <= endIdx; k++) {
          const betweenStart = k === i + 1 ? firstSegment.end : segments[k - 1].end;
          rebuilt += result.substring(betweenStart, segments[k].start);
          rebuilt += segments[k].fullMatch.replace(
            `>${segments[k].text}</hp:t>`,
            `></hp:t>`
          );
        }
        rebuilt += result.substring(lastSegment.end);
        result = rebuilt;
        totalCount++;

        // 세그먼트 인덱스가 바뀌었으므로 다시 파싱
        segments = [];
        const reparse = new RegExp('<hp:t[^>]*>(.*?)<\\/hp:t>', 'g');
        while ((match = reparse.exec(result)) !== null) {
          segments.push({
            fullMatch: match[0],
            text: match[1],
            start: match.index,
            end: match.index + match[0].length,
          });
        }
      }
    }
  }

  // 3단계: 미치환 플레이스홀더 정리 (사용자에게 {{}} 노출 방지)
  const beforeCleanup = result;
  result = result.replace(/\{\{check_[^}]+\}\}/g, '\u25A1'); // 미체크 체크박스 → □
  result = result.replace(/\{\{[^}]+\}\}/g, '');              // 나머지 → 빈문자열
  const cleaned = (beforeCleanup.match(/\{\{[^}]+\}\}/g) || []).length;
  if (cleaned > 0) {
    console.log(`[HWPX] ${cleaned}개 미치환 플레이스홀더 정리됨`);
  }

  return { result, count: totalCount };
}

// =============================================================================
// Main API: generateHwpx
// =============================================================================

/**
 * HWPX 템플릿에서 플레이스홀더를 치환하여 새 HWPX 파일을 생성한다.
 *
 * @param templatePath - HWPX 템플릿 파일의 절대 경로 또는 public 기준 상대 경로
 * @param data - 치환할 데이터 맵핑 (e.g. { "상호": "주식회사 어드미니" })
 * @param outputFileName - 출력 파일명 (선택, 기본값: 원본명_생성.hwpx)
 * @returns HwpxGenerateResult
 */
export async function generateHwpx(
  templatePath: string,
  data: HwpxFieldMapping,
  outputFileName?: string
): Promise<HwpxGenerateResult> {
  try {
    // 경로 결정: 절대 경로가 아니면 public/ 기준
    let fullPath = templatePath;
    if (!path.isAbsolute(templatePath)) {
      fullPath = path.join(process.cwd(), 'public', templatePath);
    }

    // 파일 존재 확인
    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        error: `템플릿 파일을 찾을 수 없습니다: ${fullPath}`,
      };
    }

    // HWPX 파일 읽기 (ZIP)
    const zip = new AdmZip(fullPath);
    const entries = zip.getEntries();

    let totalReplaced = 0;

    // 본문 XML 파일들에서 플레이스홀더 치환
    // HWPX 본문은 Contents/sectionN.xml에 위치
    const targetPatterns = [
      /^Contents\/section\d+\.xml$/,
      /^Contents\/header\d+\.xml$/,
      /^Contents\/footer\d+\.xml$/,
    ];

    for (const entry of entries) {
      const isTarget = targetPatterns.some((pattern) => pattern.test(entry.entryName));
      if (!isTarget) continue;

      const xmlContent = entry.getData().toString('utf8');
      const { result, count } = replacePlaceholders(xmlContent, data);

      if (count > 0) {
        zip.updateFile(entry.entryName, Buffer.from(result, 'utf8'));
        totalReplaced += count;
        console.log(`[HWPX] ${entry.entryName}: ${count}개 플레이스홀더 치환`);
      }
    }

    // 출력 파일명 결정
    const baseName = path.basename(fullPath, '.hwpx');
    const finalName = outputFileName || `${baseName}_생성_${Date.now()}.hwpx`;

    // 새 ZIP 버퍼 생성
    const outputBuffer = zip.toBuffer();

    console.log(`[HWPX] 생성 완료: ${finalName} (${totalReplaced}개 치환, ${outputBuffer.length} bytes)`);

    return {
      success: true,
      buffer: outputBuffer,
      fileName: finalName,
      replacedCount: totalReplaced,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[HWPX] 생성 실패:`, msg);
    return {
      success: false,
      error: `HWPX 생성 실패: ${msg}`,
    };
  }
}

// =============================================================================
// Utility: Extract Placeholders from HWPX
// =============================================================================

/**
 * HWPX 템플릿에서 모든 {{...}} 플레이스홀더를 추출한다.
 * sync-hwpx 스크립트나 관리자 페이지에서 필드 목록을 확인할 때 사용.
 */
export function extractPlaceholders(templatePath: string): string[] {
  try {
    let fullPath = templatePath;
    if (!path.isAbsolute(templatePath)) {
      fullPath = path.join(process.cwd(), 'public', templatePath);
    }

    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const zip = new AdmZip(fullPath);
    const placeholders = new Set<string>();

    const targetPatterns = [
      /^Contents\/section\d+\.xml$/,
      /^Contents\/header\d+\.xml$/,
      /^Contents\/footer\d+\.xml$/,
    ];

    for (const entry of zip.getEntries()) {
      const isTarget = targetPatterns.some((pattern) => pattern.test(entry.entryName));
      if (!isTarget) continue;

      const content = entry.getData().toString('utf8');
      // XML 태그를 제거하고 텍스트만 추출하여 플레이스홀더를 찾는다
      const textOnly = content.replace(/<[^>]+>/g, '');
      const matches = textOnly.matchAll(/\{\{([^}]+)\}\}/g);
      for (const match of matches) {
        placeholders.add(match[1]);
      }
    }

    return Array.from(placeholders);
  } catch (error) {
    console.error(`[HWPX] 플레이스홀더 추출 실패:`, error);
    return [];
  }
}

// =============================================================================
// Utility: Save HWPX buffer to temp path (for RPA)
// =============================================================================

/**
 * 생성된 HWPX 버퍼를 임시 경로에 저장한다.
 * RPA 엔진이 정부24에 업로드할 때 사용.
 */
// =============================================================================
// Data Transformation: User Input → HWPX Placeholders (공용)
// =============================================================================

export interface HwpxFieldDef {
  name: string;
  type: string;
  options?: string[];
  checkPrefix?: string;
}

/**
 * 사용자 입력 데이터를 HWPX 플레이스홀더 형태로 변환.
 * - select 필드 → check_XXX 체크박스 (■/□)
 * - date 필드 → 연도/월/일 분리
 * - address → 관할관청 자동 매핑
 * - 테스트 폴백: 주민등록번호 누락 시 임시값
 */
export function transformDataForHwpx(
  data: Record<string, string>,
  fields: HwpxFieldDef[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    result[key] = String(value);
  }

  // 1. 체크박스 확장 (select → check_XXX)
  for (const field of fields) {
    if (field.type === 'select' && field.options?.length) {
      const selectedValue = data[field.name] || '';
      const selectedNormalized = selectedValue.replace(/[\s·ㆍ\-]/g, '');
      const prefix = field.checkPrefix || '';
      for (const option of field.options) {
        const normalized = option.replace(/[\s·ㆍ\-]/g, '');
        const checkKey = `check_${prefix}${normalized}`;
        result[checkKey] = (normalized === selectedNormalized || option === selectedValue) ? '■' : '□';
      }
    }
  }

  // 2. 날짜 분리 (date → 연도/월/일)
  let dateParsed = false;
  for (const field of fields) {
    if (field.type === 'date' && data[field.name]) {
      const date = new Date(data[field.name]);
      if (!isNaN(date.getTime())) {
        result['신고연도'] = String(date.getFullYear());
        result['신고월'] = String(date.getMonth() + 1);
        result['신고일'] = String(date.getDate());
        result['신청연도'] = String(date.getFullYear());
        result['신청월'] = String(date.getMonth() + 1);
        result['신청일'] = String(date.getDate());
        dateParsed = true;
      }
    }
  }
  if (!dateParsed && !result['신고연도']) {
    const today = new Date();
    result['신고연도'] = String(today.getFullYear());
    result['신고월'] = String(today.getMonth() + 1);
    result['신고일'] = String(today.getDate());
    result['신청연도'] = String(today.getFullYear());
    result['신청월'] = String(today.getMonth() + 1);
    result['신청일'] = String(today.getDate());
  }

  // 3. 관할관청 자동 매핑
  const address = data['영업장소재지'] || data['주소'] || data['소재지'] || '';
  if (address && !result['관할관청']) {
    result['관할관청'] = deriveJurisdiction(address);
  }

  // 4. 테스트 폴백: 주민등록번호 누락 시 임시값
  if (!result['주민등록번호']) {
    result['주민등록번호'] = '000000-0000000';
    console.log('[HWPX] 주민등록번호 누락 — 테스트 임시값 적용');
  }

  console.log('[HWPX] 데이터 변환:', Object.keys(result).length, '키,',
    Object.keys(result).filter(k => k.startsWith('check_')).length, '체크박스');
  return result;
}

/**
 * 주소에서 관할관청 추출
 */
export function deriveJurisdiction(address: string): string {
  const metroMatch = address.match(
    /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시)\s+([\w가-힣]+구)/
  );
  if (metroMatch) return `${metroMatch[1]} ${metroMatch[2]}청장`;

  if (address.includes('세종특별자치시')) return '세종특별자치시장';

  const doMatch = address.match(
    /(경기도|충청[남북]도|전라[남북]도|전북특별자치도|경상[남북]도|강원특별자치도|제주특별자치도)\s+([\w가-힣]+[시군])/
  );
  if (doMatch) {
    const district = doMatch[2];
    if (district.endsWith('군')) return `${doMatch[1]} ${district}수`;
    return `${doMatch[1]} ${district}장`;
  }

  const simpleMatch = address.match(/([\w가-힣]+)(구|군|시)/);
  if (simpleMatch) {
    const d = simpleMatch[1] + simpleMatch[2];
    if (simpleMatch[2] === '구') return `${d}청장`;
    if (simpleMatch[2] === '군') return `${d}수`;
    return `${d}장`;
  }

  return '';
}

/**
 * 필수 필드 누락 검사. 누락된 필드 라벨 목록 반환.
 */
export function validateRequiredFields(
  data: Record<string, string>,
  fields: Array<{ name: string; label?: string; required?: boolean }>
): string[] {
  const missing: string[] = [];
  for (const field of fields) {
    if (field.required && !data[field.name]) {
      missing.push(field.label || field.name);
    }
  }
  return missing;
}

// =============================================================================
// Utility: Save HWPX buffer to temp path (for RPA)
// =============================================================================

export async function saveHwpxToTemp(buffer: Buffer, fileName: string): Promise<string> {
  const tempDir = process.env.VERCEL
    ? path.join('/tmp', 'hwpx')
    : path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, buffer);
  console.log(`[HWPX] 임시 파일 저장: ${filePath}`);
  return filePath;
}
