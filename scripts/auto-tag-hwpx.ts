#!/usr/bin/env tsx
/**
 * =============================================================================
 * Phase 12: HWPX Auto-Tagging Engine (Advanced)
 * =============================================================================
 *
 * 원본 HWPX 파일을 Gemini AI로 분석하여 자동으로 {{placeholder}}를 삽입하고
 * DB에 등록하는 전처리 스크립트.
 *
 * HWPX 서식 특성:
 *   - 라벨과 입력란이 같은 셀에 존재 → "append" 전략
 *   - 체크박스 [  ], [ ] 인라인 패턴 → "replace_pattern" 전략
 *   - 빈칸 노드 → "replace_blank" 전략
 *   - 관할관청 패턴 → "replace_pattern" 전략
 *
 * 사용법:
 *   npx tsx scripts/auto-tag-hwpx.ts                    # 전체 처리
 *   npx tsx scripts/auto-tag-hwpx.ts 식품영업신고서.hwpx  # 특정 파일만
 *   npx tsx scripts/auto-tag-hwpx.ts --force             # 이미 태깅된 파일도 재처리
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';

// =============================================================================
// Config
// =============================================================================

const PROJECT_ROOT = process.cwd();
const RAW_DIR = path.join(PROJECT_ROOT, 'public', 'templates', 'hwpx');
const TAGGED_DIR = path.join(RAW_DIR, 'tagged');

const SECTION_PATTERNS = [
  /^Contents\/section\d+\.xml$/,
  /^Contents\/header\d+\.xml$/,
  /^Contents\/footer\d+\.xml$/,
];

// =============================================================================
// Env Loading
// =============================================================================

function loadEnv(): void {
  const envFiles = ['.env', '.env.local'];
  for (const file of envFiles) {
    const filePath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) continue;
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (file === '.env.local' || !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

// =============================================================================
// Types
// =============================================================================

interface TextNode {
  index: number;
  text: string;
  entryName: string;
  textStart: number; // position of text content start in XML
  textEnd: number;   // position of text content end in XML
}

interface Injection {
  nodeIndex: number;
  action: 'append' | 'replace_pattern' | 'replace_blank';
  /** For append: text appended after existing content */
  appendText?: string;
  /** For replace_pattern: exact string to find */
  find?: string;
  /** For replace_pattern: replacement string */
  replace?: string;
}

interface FieldDef {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface GeminiResult {
  formName: string;
  category: string;
  description: string;
  fields: FieldDef[];
  injections: Injection[];
}

// =============================================================================
// Step 1: Extract PURE text nodes (skip nested XML)
// =============================================================================

function extractTextNodes(xml: string, entryName: string): TextNode[] {
  const nodes: TextNode[] = [];
  // Only match <hp:t> tags whose content does NOT start with '<' (no nested XML)
  const pattern = /<hp:t([^>]*)>([^<]*)<\/hp:t>/g;
  let match;

  while ((match = pattern.exec(xml)) !== null) {
    const textContent = match[2];
    if (textContent.length === 0) continue; // skip truly empty

    const fullMatchStart = match.index;
    const tagPrefix = `<hp:t${match[1]}>`;
    const openTagEnd = fullMatchStart + tagPrefix.length;
    const closeTagStart = openTagEnd + textContent.length;

    nodes.push({
      index: -1,
      text: textContent,
      entryName,
      textStart: openTagEnd,
      textEnd: closeTagStart,
    });
  }

  return nodes;
}

// =============================================================================
// Step 2: Build Text Map for Gemini
// =============================================================================

function buildTextMap(nodes: TextNode[]): string {
  const lines: string[] = [];
  for (const node of nodes) {
    const display = node.text.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    const isBlank = /^[\s\u3000]+$/.test(node.text);
    const suffix = isBlank ? `  [공백 ${node.text.length}자]` : '';
    lines.push(`[${node.index}] "${display}"${suffix}`);
  }
  return lines.join('\n');
}

// =============================================================================
// Step 3: Gemini Analysis (returns fields + injection instructions)
// =============================================================================

async function analyzeWithGemini(textMap: string, fileName: string): Promise<GeminiResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY 환경변수가 설정되지 않았습니다.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
  });

  const prompt = `너는 한국 행정 서식(HWPX) 자동 태깅 전문가다.

아래는 HWPX 서식 "${fileName}"에서 추출한 텍스트 노드 목록이다.
[인덱스] "텍스트" 형식이며, [공백 N자]는 빈칸 노드를 뜻한다.

--- 텍스트 노드 ---
${textMap}
--- 끝 ---

**핵심 배경:**
한국 행정 HWPX 서식은 테이블 기반이며, 라벨("성명", "주소" 등)과 입력란이 **같은 셀** 안에 있는 경우가 많다. 별도의 빈 셀이 아니라 라벨 텍스트 뒤에 공간이 있는 구조다.

**네가 해야 할 일:**
1. 서식 메타정보 (이름, 카테고리, 설명) 파악
2. 사용자 입력 필드 식별
3. 각 필드에 대해 XML 수정 지시(injection) 작성

**injection 유형 3가지:**

(A) **append** — 라벨 노드 뒤에 " {{name}}" 추가
   라벨("성명", "상호" 등)이 있는 텍스트 노드의 끝에 placeholder를 덧붙임.
   예: "성명(법인은...)" → "성명(법인은...) {{성명}}"
   사용처: 텍스트 입력 필드 (성명, 주소, 상호, 전화번호, 소재지 등)

(B) **replace_pattern** — 노드 내 특정 패턴을 치환
   예: "[  ]즉석판매제조ㆍ가공업" → "[{{check_즉석판매제조가공업}}]즉석판매제조ㆍ가공업"
   예: "[ ] 수돗물" → "[{{check_수돗물}}] 수돗물"
   예: "[ ] 해당  [ ] 미해당" → "[{{check_해당}}] 해당  [{{check_미해당}}] 미해당"
   예: "건물 내부 장소 [   ㎡]" → "건물 내부 장소 [{{건물내부면적}}㎡]"
   예: "특별자치시장ㆍ" → "{{관할관청}}"
   사용처: 체크박스, 인라인 빈칸, 관할관청 패턴

(C) **replace_blank** — 공백만 있는 노드를 통째로 교체
   예: [53] "       " [공백] → "{{신고연도}}"
   사용처: 독립된 빈칸 노드 (날짜 빈칸 등)

**응답 형식 (JSON만 반환):**
{
  "formName": "식품영업신고서",
  "category": "식품위생",
  "description": "한 줄 설명",
  "fields": [
    {
      "name": "성명",
      "label": "성명(법인은 법인 명칭 및 대표자의 성명)",
      "type": "text",
      "required": true,
      "placeholder": "홍길동"
    },
    {
      "name": "영업의종류",
      "label": "영업의 종류",
      "type": "select",
      "required": true,
      "options": ["즉석판매제조가공업", "일반음식점영업", ...]
    }
  ],
  "injections": [
    { "nodeIndex": 12, "action": "append", "appendText": " {{성명}}" },
    { "nodeIndex": 21, "action": "replace_pattern", "find": "[  ]", "replace": "[{{check_즉석판매제조가공업}}]" },
    { "nodeIndex": 36, "action": "replace_pattern", "find": "[   ㎡]", "replace": "[{{건물내부면적}}㎡]" },
    { "nodeIndex": 53, "action": "replace_blank", "appendText": "{{신고연도}}" },
    { "nodeIndex": 59, "action": "replace_pattern", "find": " 특별자치시장ㆍ", "replace": " {{관할관청}}" }
  ]
}

**규칙:**
1. fields의 name은 중복 불가. 같은 성격이면 "전화번호_신고인", "전화번호_영업장" 식으로 구분
2. 고정 텍스트(제목, 법령조문, 안내문구, 처리절차, 제출서류, 유의사항, 수수료)는 필드 아님
3. 접수번호, 접수일, 발급일, 처리기간 등 관청이 기입하는 항목은 필드 아님
4. 체크박스의 check_ 이름은 띄어쓰기/특수문자 제거 (예: "즉석판매제조ㆍ가공업" → "check_즉석판매제조가공업")
5. 관할관청 패턴: "시장ㆍ군수ㆍ구청장 귀하" 또는 "OO청장 귀하" 근처 → {{관할관청}}
6. "년 월 일" 패턴: 빈칸을 각각 {{신고연도}}, {{신고월}}, {{신고일}}로 분리하거나, 인라인이면 replace_pattern 사용
7. 서명란("서명 또는 인" 근처 빈칸)은 필드 아님 — 스킵
8. injections의 nodeIndex는 위 텍스트 노드 목록의 [인덱스] 숫자와 정확히 일치해야 함
9. 모든 체크박스 항목([  ] 또는 [ ])에 대해 각각 개별 injection을 만들어라

JSON만 반환하라. 마크다운 코드블록 없이.`;

  console.log('  [Gemini] 분석 요청 중...');
  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  let jsonStr = responseText;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr) as GeminiResult;
    console.log(`  [Gemini] 분석 완료: "${parsed.formName}" - 필드 ${parsed.fields.length}개, 주입 ${parsed.injections.length}개`);
    return parsed;
  } catch (e) {
    console.error('  [Gemini] JSON 파싱 실패. 응답 앞부분:', responseText.substring(0, 800));
    throw new Error('Gemini JSON 파싱 실패');
  }
}

// =============================================================================
// Step 4: Execute Injections
// =============================================================================

function executeInjections(
  xmlMap: Map<string, string>,
  allNodes: TextNode[],
  injections: Injection[],
): Map<string, string> {
  // 1. 유효한 injection만 수집
  interface ValidInj { node: TextNode; injection: Injection; }
  const valid: ValidInj[] = [];
  for (const inj of injections) {
    const node = allNodes.find((n) => n.index === inj.nodeIndex);
    if (!node) { console.warn(`  [주의] 노드 [${inj.nodeIndex}] 없음 — 스킵`); continue; }
    valid.push({ node, injection: inj });
  }

  // 2. nodeIndex별로 그룹핑 → 같은 노드의 injection들을 순차 적용
  const byNode: Record<number, ValidInj[]> = {};
  for (const v of valid) {
    const idx = v.node.index;
    if (!byNode[idx]) byNode[idx] = [];
    byNode[idx].push(v);
  }

  // 3. 노드별로 최종 텍스트 계산
  interface NodeResult { node: TextNode; finalText: string; }
  const nodeResults: NodeResult[] = [];

  for (const nodeIdx of Object.keys(byNode)) {
    const group = byNode[Number(nodeIdx)];
    const node = group[0].node;
    let text = ''; // will be set from XML

    // 임시로 원본 텍스트를 xmlMap에서 추출
    const xml = xmlMap.get(node.entryName);
    if (!xml) continue;
    text = xml.substring(node.textStart, node.textEnd);

    // 이 노드의 모든 injection을 순차 적용
    for (const { injection } of group) {
      switch (injection.action) {
        case 'append':
          console.log(`  [태깅] APPEND [${node.index}]: "${text.substring(0, 30)}..." + "${injection.appendText}"`);
          text = text + (injection.appendText || '');
          break;

        case 'replace_pattern':
          if (!injection.find || injection.replace === undefined) {
            console.warn(`  [주의] [${node.index}] replace_pattern에 find/replace 누락`);
            break;
          }
          if (!text.includes(injection.find)) {
            console.warn(`  [주의] [${node.index}] 패턴 "${injection.find}" 미발견 in "${text.substring(0, 60)}"`);
            break;
          }
          // replace만 첫 번째 매치 치환 (의도적)
          text = text.replace(injection.find, injection.replace);
          console.log(`  [태깅] REPLACE [${node.index}]: "${injection.find}" → "${injection.replace}"`);
          break;

        case 'replace_blank':
          console.log(`  [태깅] BLANK [${node.index}]: [공백 ${text.length}자] → "${injection.appendText}"`);
          text = injection.appendText || '';
          break;

        default:
          console.warn(`  [주의] [${node.index}] 알 수 없는 action: ${injection.action}`);
      }
    }

    nodeResults.push({ node, finalText: text });
  }

  // 4. entryName별로 그룹 → 역순 위치로 XML에 한 번씩만 반영
  const byEntry: Record<string, NodeResult[]> = {};
  for (const nr of nodeResults) {
    const key = nr.node.entryName;
    if (!byEntry[key]) byEntry[key] = [];
    byEntry[key].push(nr);
  }

  const result = new Map(xmlMap);

  for (const entryName of Object.keys(byEntry)) {
    let xml = result.get(entryName);
    if (!xml) continue;

    // 역순 정렬 (뒤→앞 처리로 offset 보존)
    const sorted = byEntry[entryName].sort((a, b) => b.node.textStart - a.node.textStart);

    for (const { node, finalText } of sorted) {
      xml = xml!.substring(0, node.textStart) + finalText + xml!.substring(node.textEnd);
    }

    result.set(entryName, xml!);
  }

  return result;
}

// =============================================================================
// Step 5: Process Single HWPX File
// =============================================================================

function normalizeCode(formName: string): string {
  // "식품 영업 신고서" → "식품영업신고서"
  return formName.replace(/\s+/g, '').replace(/[^\w가-힣]/g, '');
}

async function processFile(filePath: string, prisma: PrismaClient): Promise<boolean> {
  const fileName = path.basename(filePath);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`처리 중: ${fileName}`);
  console.log(`${'='.repeat(60)}`);

  // 1. HWPX 열기
  let zip: any;
  try {
    zip = new AdmZip(filePath);
  } catch (e) {
    console.error(`  [오류] HWPX 열기 실패: ${e}`);
    return false;
  }

  // 2. XML 추출 + 텍스트 노드 인덱싱
  const xmlMap = new Map<string, string>();
  const allNodes: TextNode[] = [];
  let globalIndex = 0;

  for (const entry of zip.getEntries()) {
    const isTarget = SECTION_PATTERNS.some((p: RegExp) => p.test(entry.entryName));
    if (!isTarget) continue;

    const xmlContent = entry.getData().toString('utf8');
    xmlMap.set(entry.entryName, xmlContent);

    const nodes = extractTextNodes(xmlContent, entry.entryName);
    for (const node of nodes) {
      node.index = globalIndex++;
      allNodes.push(node);
    }
    console.log(`  [XML] ${entry.entryName}: ${nodes.length}개 텍스트 노드`);
  }

  if (allNodes.length === 0) {
    console.error('  [오류] 텍스트 노드 없음. HWPX 구조 확인 필요.');
    return false;
  }

  console.log(`  [합계] ${allNodes.length}개 순수 텍스트 노드`);

  // 3. Gemini 분석
  const textMap = buildTextMap(allNodes);
  let analysis: GeminiResult;

  try {
    analysis = await analyzeWithGemini(textMap, fileName);
  } catch (e) {
    console.warn('  [재시도] 1회 더...');
    try {
      analysis = await analyzeWithGemini(textMap, fileName);
    } catch (e2) {
      console.error(`  [오류] Gemini 최종 실패: ${e2}`);
      return false;
    }
  }

  if (!analysis.injections || analysis.injections.length === 0) {
    console.error('  [오류] Gemini가 injection을 반환하지 않았습니다.');
    return false;
  }

  // 4. 플레이스홀더 주입
  const taggedXmlMap = executeInjections(xmlMap, allNodes, analysis.injections);

  // 5. 태깅된 HWPX 저장
  if (!fs.existsSync(TAGGED_DIR)) {
    fs.mkdirSync(TAGGED_DIR, { recursive: true });
  }

  const taggedZip = new AdmZip(filePath);
  taggedXmlMap.forEach((taggedXml: string, entryName: string) => {
    taggedZip.updateFile(entryName, Buffer.from(taggedXml, 'utf8'));
  });

  const taggedPath = path.join(TAGGED_DIR, fileName);
  taggedZip.writeZip(taggedPath);
  console.log(`  [저장] ${taggedPath}`);

  // 6. 검증
  const verifyZip = new AdmZip(taggedPath);
  let verifiedCount = 0;
  const foundPlaceholders: string[] = [];
  for (const entry of verifyZip.getEntries()) {
    const isTarget = SECTION_PATTERNS.some((p: RegExp) => p.test(entry.entryName));
    if (!isTarget) continue;
    const content = entry.getData().toString('utf8');
    const matches = content.match(/\{\{[^}]+\}\}/g);
    if (matches) {
      verifiedCount += matches.length;
      foundPlaceholders.push(...matches);
    }
  }
  console.log(`  [검증] ${verifiedCount}개 플레이스홀더: ${[...new Set(foundPlaceholders)].join(', ')}`);

  // 7. DB 등록
  const cleanName = normalizeCode(analysis.formName);
  const templateCode = `hwpx_${cleanName}`;

  const fieldsJson = JSON.stringify(
    analysis.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      required: f.required,
      placeholder: f.placeholder || '',
      ...(f.options && f.options.length > 0 ? { options: f.options } : {}),
    }))
  );

  const templateData = {
    name: analysis.formName,
    category: analysis.category || '일반',
    description: analysis.description || '',
    originalFileUrl: `/templates/hwpx/tagged/${fileName}`,
    originalFileType: 'hwpx',
    fields: fieldsJson,
    outputFileName: `${analysis.formName}_{date}.hwpx`,
    status: 'active',
    version: 1,
  };

  try {
    // 기존 레코드 삭제 후 생성 (code가 바뀔 수 있으므로)
    // 같은 파일명의 이전 레코드 정리
    const oldRecords = await prisma.formTemplate.findMany({
      where: { originalFileUrl: `/templates/hwpx/tagged/${fileName}` },
    });
    for (const old of oldRecords) {
      if (old.code !== templateCode) {
        await prisma.formTemplate.delete({ where: { code: old.code } });
        console.log(`  [DB] 이전 레코드 삭제: ${old.code}`);
      }
    }

    await prisma.formTemplate.upsert({
      where: { code: templateCode },
      create: { code: templateCode, ...templateData },
      update: { ...templateData, version: { increment: 1 } },
    });
    console.log(`  [DB] 등록 완료: code="${templateCode}"`);
  } catch (e) {
    console.error(`  [DB 오류] ${e}`);
    return false;
  }

  // 요약
  console.log(`\n  ✓ 완료: ${analysis.formName}`);
  console.log(`    - 카테고리: ${analysis.category}`);
  console.log(`    - 필드: ${analysis.fields.map((f) => f.name).join(', ')}`);
  console.log(`    - 주입: ${analysis.injections.length}건 → 검증 ${verifiedCount}개`);
  console.log(`    - DB code: ${templateCode}`);

  return true;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  loadEnv();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Phase 12: HWPX Auto-Tagging Engine (Advanced)        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);
  const forceMode = args.includes('--force');
  const specificFile = args.find((a) => a.endsWith('.hwpx'));

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('[오류] GOOGLE_AI_API_KEY 없음');
    process.exit(1);
  }

  if (!fs.existsSync(RAW_DIR)) {
    console.error(`[오류] 폴더 없음: ${RAW_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(TAGGED_DIR)) {
    fs.mkdirSync(TAGGED_DIR, { recursive: true });
  }

  let hwpxFiles: string[];

  if (specificFile) {
    const fullPath = path.join(RAW_DIR, specificFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`[오류] 파일 없음: ${fullPath}`);
      process.exit(1);
    }
    hwpxFiles = [fullPath];
  } else {
    hwpxFiles = fs.readdirSync(RAW_DIR)
      .filter((f) => f.endsWith('.hwpx'))
      .map((f) => path.join(RAW_DIR, f));
  }

  if (hwpxFiles.length === 0) {
    console.log(`\n처리할 HWPX 파일 없음. ${RAW_DIR}에 파일을 넣어주세요.`);
    process.exit(0);
  }

  if (!forceMode) {
    const existingTagged = new Set(
      fs.existsSync(TAGGED_DIR)
        ? fs.readdirSync(TAGGED_DIR).filter((f) => f.endsWith('.hwpx'))
        : []
    );
    const before = hwpxFiles.length;
    hwpxFiles = hwpxFiles.filter((f) => !existingTagged.has(path.basename(f)));
    if (before > hwpxFiles.length) {
      console.log(`\n${before - hwpxFiles.length}개 이미 태깅됨 (--force로 재처리)`);
    }
  }

  if (hwpxFiles.length === 0) {
    console.log('\n새로 처리할 파일 없음.');
    process.exit(0);
  }

  console.log(`\n처리 대상: ${hwpxFiles.length}개`);
  hwpxFiles.forEach((f) => console.log(`  - ${path.basename(f)}`));

  const prisma = new PrismaClient();

  try {
    let ok = 0, fail = 0;
    for (const file of hwpxFiles) {
      (await processFile(file, prisma)) ? ok++ : fail++;
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log(`완료: 성공 ${ok} / 실패 ${fail}`);
    console.log('='.repeat(60));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[치명적 오류]', err);
  process.exit(1);
});
