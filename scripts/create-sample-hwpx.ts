/**
 * 샘플 HWPX 파일 생성 스크립트
 *
 * HWPX는 ZIP 구조이므로 adm-zip으로 최소한의 구조를 만든다.
 * 실제 한글(HWP)에서 생성한 HWPX와 동일한 XML 구조를 따른다.
 *
 * 실행: npx ts-node scripts/create-sample-hwpx.ts
 */

import AdmZip from 'adm-zip';
import * as path from 'path';
import * as fs from 'fs';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'templates', 'hwpx');

// =============================================================================
// HWPX XML Templates (최소 구조)
// =============================================================================

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/Contents/content.hpf" ContentType="application/hwp+xml"/>
  <Override PartName="/Contents/section0.xml" ContentType="application/hwp-section+xml"/>
  <Override PartName="/Contents/header0.xml" ContentType="application/hwp-header+xml"/>
</Types>`;

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
  </rootfiles>
</container>`;

const CONTENT_HPF = `<?xml version="1.0" encoding="UTF-8"?>
<hpf:package xmlns:hpf="urn:hancom:hwpml:pkg" version="1.0">
  <hpf:manifest>
    <hpf:item id="section0" href="section0.xml" media-type="application/xml"/>
    <hpf:item id="header0" href="header0.xml" media-type="application/xml"/>
  </hpf:manifest>
  <hpf:spine>
    <hpf:itemref idref="section0"/>
  </hpf:spine>
</hpf:package>`;

// 식품영업신고서 본문 (section0.xml)
const SECTION0_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hp:sec xmlns:hp="urn:hancom:hwpml:paragraph"
        xmlns:hs="urn:hancom:hwpml:section"
        xmlns:hc="urn:hancom:hwpml:common">

  <!-- 제목 -->
  <hp:p>
    <hp:run>
      <hp:rPr><hp:sz val="2400"/><hp:b/></hp:rPr>
      <hp:t>식 품 영 업 신 고 서</hp:t>
    </hp:run>
  </hp:p>

  <hp:p><hp:run><hp:t> </hp:t></hp:run></hp:p>

  <!-- 1. 영업소 정보 -->
  <hp:p>
    <hp:run>
      <hp:rPr><hp:b/></hp:rPr>
      <hp:t>1. 영업소 정보</hp:t>
    </hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  영 업 소 명 칭 : {{상호}}</hp:t></hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  영 업 소 소재지 : {{소재지}}</hp:t></hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  영 업 의 종 류 : {{영업종류}}</hp:t></hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  영 업 장 면 적 : {{영업장면적}} m²</hp:t></hp:run>
  </hp:p>

  <hp:p><hp:run><hp:t> </hp:t></hp:run></hp:p>

  <!-- 2. 신고인 정보 -->
  <hp:p>
    <hp:run>
      <hp:rPr><hp:b/></hp:rPr>
      <hp:t>2. 신고인 정보</hp:t>
    </hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  성          명 : {{성명}}</hp:t></hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  생 년 월 일 : {{생년월일}}</hp:t></hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  전 화 번 호 : {{전화번호}}</hp:t></hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  주          소 : {{주소}}</hp:t></hp:run>
  </hp:p>

  <hp:p><hp:run><hp:t> </hp:t></hp:run></hp:p>

  <!-- 3. 사업자 정보 -->
  <hp:p>
    <hp:run>
      <hp:rPr><hp:b/></hp:rPr>
      <hp:t>3. 사업자 정보</hp:t>
    </hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  사업자등록번호 : {{사업자등록번호}}</hp:t></hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  대 표 자 명 : {{대표자명}}</hp:t></hp:run>
  </hp:p>

  <hp:p><hp:run><hp:t> </hp:t></hp:run></hp:p>

  <!-- 4. 위생교육 -->
  <hp:p>
    <hp:run>
      <hp:rPr><hp:b/></hp:rPr>
      <hp:t>4. 위생교육 이수 정보</hp:t>
    </hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  교 육 이수일 : {{교육이수일}}</hp:t></hp:run>
  </hp:p>

  <hp:p>
    <hp:run><hp:t>  교 육 기 관 : {{교육기관}}</hp:t></hp:run>
  </hp:p>

  <hp:p><hp:run><hp:t> </hp:t></hp:run></hp:p>

  <!-- 신고 문구 -->
  <hp:p>
    <hp:run>
      <hp:t>「식품위생법」 제37조제4항 및 같은 법 시행규칙 제42조에 따라</hp:t>
    </hp:run>
  </hp:p>
  <hp:p>
    <hp:run>
      <hp:t>위와 같이 식품영업을 신고합니다.</hp:t>
    </hp:run>
  </hp:p>

  <hp:p><hp:run><hp:t> </hp:t></hp:run></hp:p>

  <!-- 날짜 -->
  <hp:p>
    <hp:run>
      <hp:t>       {{신고년도}}년  {{신고월}}월  {{신고일}}일</hp:t>
    </hp:run>
  </hp:p>

  <hp:p><hp:run><hp:t> </hp:t></hp:run></hp:p>

  <!-- 신고인 서명 -->
  <hp:p>
    <hp:run>
      <hp:t>                          신고인 : {{성명}}   (서명 또는 인)</hp:t>
    </hp:run>
  </hp:p>

  <hp:p><hp:run><hp:t> </hp:t></hp:run></hp:p>

  <!-- 수신처 -->
  <hp:p>
    <hp:run>
      <hp:rPr><hp:b/></hp:rPr>
      <hp:t>{{관할관청}} 귀하</hp:t>
    </hp:run>
  </hp:p>

</hp:sec>`;

// 헤더 (header0.xml) - 분할된 플레이스홀더 테스트 포함
const HEADER0_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hp:sec xmlns:hp="urn:hancom:hwpml:paragraph">
  <hp:p>
    <hp:run><hp:t>[{{상호}}] 식품영업신고서</hp:t></hp:run>
  </hp:p>
</hp:sec>`;

// =============================================================================
// Build HWPX
// =============================================================================

function createSampleHwpx(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const zip = new AdmZip();

  // HWPX 필수 파일 추가
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf8'));
  zip.addFile('META-INF/container.xml', Buffer.from(CONTAINER_XML, 'utf8'));
  zip.addFile('Contents/content.hpf', Buffer.from(CONTENT_HPF, 'utf8'));
  zip.addFile('Contents/section0.xml', Buffer.from(SECTION0_XML, 'utf8'));
  zip.addFile('Contents/header0.xml', Buffer.from(HEADER0_XML, 'utf8'));

  const outputPath = path.join(OUTPUT_DIR, '식품영업신고서.hwpx');
  zip.writeZip(outputPath);

  console.log(`\n=== 샘플 HWPX 생성 완료 ===`);
  console.log(`경로: ${outputPath}`);
  console.log(`크기: ${fs.statSync(outputPath).size} bytes`);

  // 내용 검증
  const verify = new AdmZip(outputPath);
  const entries = verify.getEntries();
  console.log(`\nHWPX 내부 구조:`);
  for (const entry of entries) {
    console.log(`  ${entry.entryName} (${entry.header.size} bytes)`);
  }
}

createSampleHwpx();
