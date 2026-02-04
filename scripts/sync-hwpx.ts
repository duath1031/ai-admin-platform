/**
 * =============================================================================
 * Phase 9: HWPX Auto-Sync Script
 * =============================================================================
 *
 * public/templates/hwpx/ 폴더를 스캔하여 .hwpx 파일을 자동으로
 * DB(FormTemplate)에 등록하는 스크립트.
 *
 * 실행:
 *   npx ts-node scripts/sync-hwpx.ts
 *
 * 또는 서버 시작 시 자동 실행하도록 연결 가능.
 *
 * @module scripts/sync-hwpx
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { extractPlaceholders } from '../lib/hwpx';

const prisma = new PrismaClient();

// =============================================================================
// Configuration
// =============================================================================

const HWPX_DIR = path.join(process.cwd(), 'public', 'templates', 'hwpx');
const TEMPLATE_URL_PREFIX = '/templates/hwpx/';

/**
 * 파일명에서 서비스 카테고리를 추론한다.
 * 예: "식품영업신고서.hwpx" -> "식품위생"
 */
function inferCategory(fileName: string): string {
  const name = fileName.replace('.hwpx', '');
  const categoryMap: Record<string, string[]> = {
    '식품위생': ['식품', '영업신고', '위생'],
    '건축/인허가': ['건축', '인허가', '건설', '허가', '용도변경'],
    '사업자등록': ['사업자', '법인', '개업'],
    '민원서류': ['민원', '신고', '신청', '등록'],
    '관광/숙박': ['관광', '숙박', '호텔', '펜션'],
    '교육/학원': ['교육', '학원', '학교'],
    '의료/약국': ['의료', '약국', '병원', '의원'],
    '환경': ['환경', '폐기물', '대기', '수질'],
    '노동/고용': ['노동', '고용', '근로', '퇴직'],
    '세무/회계': ['세무', '세금', '부가세', '종합소득'],
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some((kw) => name.includes(kw))) {
      return category;
    }
  }

  return '기타';
}

/**
 * 파일명에서 고유 코드를 생성한다.
 * 예: "식품영업신고서.hwpx" -> "hwpx_식품영업신고서"
 */
function generateCode(fileName: string): string {
  const baseName = fileName.replace('.hwpx', '');
  return `hwpx_${baseName}`;
}

// =============================================================================
// Main Sync Function
// =============================================================================

export async function syncHwpxTemplates(): Promise<{
  added: string[];
  skipped: string[];
  errors: string[];
}> {
  const result = { added: [] as string[], skipped: [] as string[], errors: [] as string[] };

  // 폴더 존재 확인
  if (!fs.existsSync(HWPX_DIR)) {
    fs.mkdirSync(HWPX_DIR, { recursive: true });
    console.log(`[SyncHWPX] 폴더 생성됨: ${HWPX_DIR}`);
    return result;
  }

  // .hwpx 파일 스캔
  const files = fs.readdirSync(HWPX_DIR).filter((f) => f.endsWith('.hwpx'));
  console.log(`[SyncHWPX] ${files.length}개 HWPX 파일 발견`);

  for (const file of files) {
    const code = generateCode(file);
    const name = file.replace('.hwpx', '');
    const category = inferCategory(file);
    const templateUrl = `${TEMPLATE_URL_PREFIX}${file}`;
    const fullPath = path.join(HWPX_DIR, file);

    try {
      // 이미 등록되어 있는지 확인
      const existing = await prisma.formTemplate.findUnique({ where: { code } });

      if (existing) {
        // 파일이 변경되었는지 확인 (크기 비교)
        const stat = fs.statSync(fullPath);
        const existingSize = existing.originalFileUrl ? 0 : -1; // placeholder
        console.log(`[SyncHWPX] 이미 등록됨 (건너뜀): ${file}`);
        result.skipped.push(file);
        continue;
      }

      // 플레이스홀더 추출
      const placeholders = extractPlaceholders(fullPath);
      const fields = placeholders.map((p) => ({
        name: p,
        label: p,
        type: 'text' as const,
        required: true,
      }));

      // DB에 등록
      await prisma.formTemplate.create({
        data: {
          code,
          name,
          category,
          description: `HWPX 서식: ${name}`,
          originalFileUrl: templateUrl,
          originalFileType: 'hwpx',
          fields: JSON.stringify(fields),
          outputFileName: `${name}_작성본.hwpx`,
          status: 'active',
        },
      });

      console.log(`[SyncHWPX] 등록 완료: ${file} (code: ${code}, category: ${category}, fields: ${placeholders.length}개)`);
      result.added.push(file);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[SyncHWPX] 등록 실패: ${file} - ${msg}`);
      result.errors.push(`${file}: ${msg}`);
    }
  }

  // DB에는 있지만 파일이 없는 항목 경고
  const allHwpxTemplates = await prisma.formTemplate.findMany({
    where: { code: { startsWith: 'hwpx_' } },
  });

  for (const tmpl of allHwpxTemplates) {
    const expectedFile = `${tmpl.code.replace('hwpx_', '')}.hwpx`;
    const expectedPath = path.join(HWPX_DIR, expectedFile);
    if (!fs.existsSync(expectedPath)) {
      console.warn(`[SyncHWPX] 경고: DB에 등록되어 있지만 파일이 없음 - ${expectedFile}`);
    }
  }

  console.log(`\n[SyncHWPX] 동기화 완료: 추가 ${result.added.length}, 건너뜀 ${result.skipped.length}, 오류 ${result.errors.length}`);
  return result;
}

// =============================================================================
// CLI Execution
// =============================================================================

if (require.main === module) {
  syncHwpxTemplates()
    .then((result) => {
      console.log('\n=== 동기화 결과 ===');
      console.log('추가:', result.added);
      console.log('건너뜀:', result.skipped);
      console.log('오류:', result.errors);
      process.exit(0);
    })
    .catch((error) => {
      console.error('동기화 실패:', error);
      process.exit(1);
    });
}
