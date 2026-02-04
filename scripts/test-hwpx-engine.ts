/**
 * HWPX 엔진 통합 테스트
 *
 * 1. 플레이스홀더 추출 테스트
 * 2. 데이터 치환 생성 테스트
 * 3. 생성된 파일 검증 테스트
 *
 * 실행: npx ts-node scripts/test-hwpx-engine.ts
 */

import { generateHwpx, extractPlaceholders, saveHwpxToTemp } from '../lib/hwpx';
import AdmZip from 'adm-zip';
import * as path from 'path';
import * as fs from 'fs';

const TEMPLATE_PATH = path.join(process.cwd(), 'public', 'templates', 'hwpx', '식품영업신고서.hwpx');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${testName}${detail ? ' - ' + detail : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== HWPX Engine Test Suite ===\n');

  // ------------------------------------------------------------------
  // Test 1: 템플릿 파일 존재 확인
  // ------------------------------------------------------------------
  console.log('[Test 1] 샘플 템플릿 파일 존재 확인');
  assert(fs.existsSync(TEMPLATE_PATH), '식품영업신고서.hwpx 존재');

  // ------------------------------------------------------------------
  // Test 2: 플레이스홀더 추출
  // ------------------------------------------------------------------
  console.log('\n[Test 2] 플레이스홀더 추출');
  const placeholders = extractPlaceholders(TEMPLATE_PATH);
  console.log(`  추출된 플레이스홀더: [${placeholders.join(', ')}]`);

  assert(placeholders.length > 0, `플레이스홀더 개수 > 0 (실제: ${placeholders.length})`);
  assert(placeholders.includes('상호'), '{{상호}} 포함');
  assert(placeholders.includes('성명'), '{{성명}} 포함');
  assert(placeholders.includes('소재지'), '{{소재지}} 포함');
  assert(placeholders.includes('영업종류'), '{{영업종류}} 포함');
  assert(placeholders.includes('사업자등록번호'), '{{사업자등록번호}} 포함');
  assert(placeholders.includes('대표자명'), '{{대표자명}} 포함');
  assert(placeholders.includes('전화번호'), '{{전화번호}} 포함');
  assert(placeholders.includes('관할관청'), '{{관할관청}} 포함');

  // ------------------------------------------------------------------
  // Test 3: HWPX 생성 (전체 필드)
  // ------------------------------------------------------------------
  console.log('\n[Test 3] HWPX 생성 - 전체 필드 치환');
  const fullData = {
    '상호': '맛있는 분식',
    '소재지': '서울특별시 강남구 테헤란로 123, 1층',
    '영업종류': '일반음식점',
    '영업장면적': '65.5',
    '성명': '김철수',
    '생년월일': '1985-03-15',
    '전화번호': '010-1234-5678',
    '주소': '서울특별시 서초구 서초대로 456',
    '사업자등록번호': '123-45-67890',
    '대표자명': '김철수',
    '교육이수일': '2026-01-20',
    '교육기관': '한국식품안전관리인증원',
    '신고년도': '2026',
    '신고월': '02',
    '신고일': '04',
    '관할관청': '강남구청장',
  };

  const result = await generateHwpx(TEMPLATE_PATH, fullData);
  assert(result.success === true, '생성 성공');
  assert(result.buffer !== undefined, '버퍼 존재');
  assert((result.replacedCount || 0) > 0, `치환 횟수 > 0 (실제: ${result.replacedCount})`);
  console.log(`  파일명: ${result.fileName}`);
  console.log(`  크기: ${result.buffer?.length} bytes`);
  console.log(`  치환 수: ${result.replacedCount}`);

  // ------------------------------------------------------------------
  // Test 4: 생성된 파일 내용 검증
  // ------------------------------------------------------------------
  console.log('\n[Test 4] 생성된 HWPX 내용 검증');
  if (result.buffer) {
    const zip = new AdmZip(result.buffer);

    // section0.xml 확인
    const section0 = zip.getEntry('Contents/section0.xml');
    assert(section0 !== null, 'Contents/section0.xml 존재');

    if (section0) {
      const xml = section0.getData().toString('utf8');
      assert(xml.includes('맛있는 분식'), '{{상호}} → "맛있는 분식" 치환됨');
      assert(xml.includes('김철수'), '{{성명}} → "김철수" 치환됨');
      assert(xml.includes('서울특별시 강남구 테헤란로 123, 1층'), '{{소재지}} 치환됨');
      assert(xml.includes('일반음식점'), '{{영업종류}} 치환됨');
      assert(xml.includes('123-45-67890'), '{{사업자등록번호}} 치환됨');
      assert(xml.includes('강남구청장'), '{{관할관청}} 치환됨');
      assert(!xml.includes('{{상호}}'), '{{상호}} 플레이스홀더 제거됨');
      assert(!xml.includes('{{성명}}'), '{{성명}} 플레이스홀더 제거됨');
      assert(!xml.includes('{{소재지}}'), '{{소재지}} 플레이스홀더 제거됨');
    }

    // header0.xml 확인
    const header0 = zip.getEntry('Contents/header0.xml');
    assert(header0 !== null, 'Contents/header0.xml 존재');

    if (header0) {
      const xml = header0.getData().toString('utf8');
      assert(xml.includes('맛있는 분식'), '헤더에서도 {{상호}} 치환됨');
    }
  }

  // ------------------------------------------------------------------
  // Test 5: XML 특수문자 이스케이프 테스트
  // ------------------------------------------------------------------
  console.log('\n[Test 5] XML 특수문자 이스케이프');
  const dangerousData = {
    '상호': '김&이 <푸드> "맛집"',
    '성명': '홍길동',
    '소재지': 'A&B 빌딩',
  };

  const escResult = await generateHwpx(TEMPLATE_PATH, dangerousData);
  assert(escResult.success === true, '특수문자 포함 데이터 생성 성공');

  if (escResult.buffer) {
    const zip = new AdmZip(escResult.buffer);
    const section0 = zip.getEntry('Contents/section0.xml');
    if (section0) {
      const xml = section0.getData().toString('utf8');
      assert(xml.includes('김&amp;이 &lt;푸드&gt; &quot;맛집&quot;'), 'XML 특수문자 이스케이프 처리됨');
      assert(xml.includes('A&amp;B 빌딩'), '& 이스케이프 처리됨');

      // XML 파싱이 깨지지 않는지 확인
      assert(!xml.includes('김&이'), '원본 &가 직접 포함되지 않음');
    }
  }

  // ------------------------------------------------------------------
  // Test 6: 부분 데이터 치환 (일부 필드만)
  // ------------------------------------------------------------------
  console.log('\n[Test 6] 부분 데이터 치환');
  const partialData = {
    '상호': '부분테스트식당',
    '성명': '이영희',
  };

  const partialResult = await generateHwpx(TEMPLATE_PATH, partialData);
  assert(partialResult.success === true, '부분 데이터 생성 성공');

  if (partialResult.buffer) {
    const zip = new AdmZip(partialResult.buffer);
    const section0 = zip.getEntry('Contents/section0.xml');
    if (section0) {
      const xml = section0.getData().toString('utf8');
      assert(xml.includes('부분테스트식당'), '제공된 필드 치환됨');
      assert(xml.includes('{{소재지}}'), '미제공 필드는 플레이스홀더 유지');
      assert(xml.includes('{{영업종류}}'), '미제공 필드는 플레이스홀더 유지');
    }
  }

  // ------------------------------------------------------------------
  // Test 7: 임시 파일 저장 (RPA용)
  // ------------------------------------------------------------------
  console.log('\n[Test 7] 임시 파일 저장 (RPA용)');
  if (result.buffer && result.fileName) {
    const tempPath = await saveHwpxToTemp(result.buffer, result.fileName);
    assert(fs.existsSync(tempPath), `임시 파일 생성됨: ${tempPath}`);
    assert(fs.statSync(tempPath).size === result.buffer.length, '파일 크기 일치');

    // 정리
    fs.unlinkSync(tempPath);
    console.log(`  정리: ${tempPath} 삭제`);
  }

  // ------------------------------------------------------------------
  // Test 8: 존재하지 않는 템플릿
  // ------------------------------------------------------------------
  console.log('\n[Test 8] 에러 핸들링');
  const errResult = await generateHwpx('/nonexistent/path.hwpx', { '상호': 'test' });
  assert(errResult.success === false, '존재하지 않는 파일 → 실패');
  assert(errResult.error !== undefined, '에러 메시지 반환');
  console.log(`  에러: ${errResult.error}`);

  // ------------------------------------------------------------------
  // 결과 요약
  // ------------------------------------------------------------------
  console.log(`\n${'='.repeat(50)}`);
  console.log(`테스트 결과: ${passed} passed, ${failed} failed (총 ${passed + failed})`);
  console.log(`${'='.repeat(50)}`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('테스트 실행 오류:', err);
  process.exit(1);
});
