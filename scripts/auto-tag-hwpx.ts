#!/usr/bin/env tsx
/**
 * =============================================================================
 * Phase 12: HWPX Auto-Tagging Engine
 * =============================================================================
 *
 * 원본 HWPX 파일을 Gemini AI로 분석하여 자동으로 {{placeholder}}를 삽입하고
 * DB에 등록하는 전처리 스크립트.
 *
 * 사용법:
 *   npx tsx scripts/auto-tag-hwpx.ts                    # 전체 처리
 *   npx tsx scripts/auto-tag-hwpx.ts 식품영업신고서.hwpx  # 특정 파일만
 *   npx tsx scripts/auto-tag-hwpx.ts --force             # 이미 태깅된 파일도 재처리
 *
 * 동작:
 *   1. public/templates/hwpx/ 폴더에서 원본 HWPX 파일 스캔
 *   2. HWPX 압축 해제 → section XML 추출 → 텍스트 노드 인덱싱
 *   3. Gemini에 텍스트 노드 전송 → 입력 필드 분석
 *   4. 식별된 입력란에 {{placeholder}} 자동 삽입
 *   5. 태깅된 HWPX를 tagged/ 폴더에 저장
 *   6. DB FormTemplate 레코드 생성/갱신
 */

import * as AdmZip from 'adm-zip';
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
// Env Loading (standalone script - no Next.js env)
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
      // .env.local overrides .env
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
  /** Position of the text content start (after >) in the original XML */
  textStart: number;
  /** Position of the text content end (before </hp:t>) */
  textEnd: number;
}

interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'textarea';
  required: boolean;
  placeholder?: string;
  options?: string[];
  nodeIndices: number[];
}

interface GeminiAnalysis {
  formName: string;
  category: string;
  description: string;
  fields: FieldDefinition[];
}

// =============================================================================
// Step 1: Extract Text Nodes from XML
// =============================================================================

/**
 * HWPX XML에서 모든 <hp:t> 태그의 텍스트를 추출하고 위치를 기록한다.
 * 반환되는 노드의 textStart/textEnd를 사용하여 원본 XML에 정확한 위치 치환이 가능하다.
 */
function extractTextNodes(xml: string, entryName: string): TextNode[] {
  const nodes: TextNode[] = [];
  // <hp:t> or <hp:t charPrIDRef="..."> etc.
  const pattern = /<hp:t([^>]*)>([\s\S]*?)<\/hp:t>/g;
  let match;

  while ((match = pattern.exec(xml)) !== null) {
    const fullMatchStart = match.index;
    const openTagEnd = fullMatchStart + match[0].indexOf('>') + 1; // position after >
    const closeTagStart = fullMatchStart + match[0].lastIndexOf('</hp:t>');
    const textContent = match[2];

    nodes.push({
      index: -1, // will be assigned globally later
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
    const display = node.text
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');

    // 빈칸/공백 시각화
    const isBlank = /^[\s　\u3000]*$/.test(node.text) && node.text.length > 0;
    const suffix = isBlank ? `  [공백 ${node.text.length}자]` : '';

    lines.push(`[${node.index}] "${display}"${suffix}`);
  }
  return lines.join('\n');
}

// =============================================================================
// Step 3: Gemini Analysis
// =============================================================================

async function analyzeWithGemini(
  textMap: string,
  fileName: string,
): Promise<GeminiAnalysis> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1, // 정확한 분석을 위해 낮은 temperature
      maxOutputTokens: 8192,
    },
  });

  const prompt = `너는 한국 행정 서식 분석 전문가다.

아래는 HWPX(한글 문서) 서식 파일 "${fileName}"의 XML에서 추출한 텍스트 노드 목록이다.
각 항목은 [인덱스] "텍스트내용" 형식이다. [공백 N자]는 해당 노드가 빈칸임을 뜻한다.

--- 텍스트 노드 목록 ---
${textMap}
--- 끝 ---

이 서식을 분석하여 다음 JSON을 반환하라:

{
  "formName": "서식 이름 (예: 식품영업신고서)",
  "category": "카테고리 (예: 식품위생, 건축, 사업자등록, 자동차, 부동산 등)",
  "description": "서식에 대한 한 줄 설명",
  "fields": [
    {
      "name": "placeholder에 쓸 짧은 한글 키 (띄어쓰기 없이, 예: 상호, 성명)",
      "label": "서식에 표시된 전체 라벨 (예: 상호(영업소 명칭))",
      "type": "text | date | number | select | textarea",
      "required": true,
      "placeholder": "입력 힌트 (예: 주식회사 맛나)",
      "options": ["select인 경우 선택지 배열"],
      "nodeIndices": [빈칸/입력란에 해당하는 텍스트 노드 인덱스 배열]
    }
  ]
}

핵심 규칙:
1. "제목", "법령 조문", "안내문구", "서식번호" 등 고정 텍스트는 필드가 아니다.
2. [공백 N자]로 표시된 노드가 주로 입력란이다. 라벨 옆이나 아래에 있는 빈칸을 찾아라.
3. 체크박스(□, ☐, ☑)가 있는 항목은 type: "select"로 하고, 선택지를 options에 포함하라. nodeIndices에는 체크박스가 포함된 텍스트 노드를 넣지 말고, 그 선택의 결과가 들어갈 별도 빈칸이 있으면 그것을 넣어라. 별도 빈칸이 없으면 nodeIndices를 빈 배열로 해라.
4. "년 월 일" 패턴이 있는 날짜란은 type: "date", 해당 빈칸들의 인덱스를 nodeIndices에 넣어라.
5. 금액/면적 등 숫자 필드는 type: "number".
6. 주소처럼 긴 입력란은 type: "textarea".
7. name은 중복되면 안 된다. 같은 성격의 필드가 여러 개면 "성명_신청인", "성명_대리인"처럼 구분하라.
8. nodeIndices가 비어있는 필드도 허용된다 (체크박스 등). 하지만 가능한 입력란 노드를 찾아라.

JSON만 반환하라. 마크다운 코드블록이나 설명 텍스트 없이 순수 JSON만 출력하라.`;

  console.log('  [Gemini] 분석 요청 중...');
  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  // JSON 파싱 (코드블록 래핑 제거)
  let jsonStr = responseText;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const analysis = JSON.parse(jsonStr) as GeminiAnalysis;
    console.log(`  [Gemini] 분석 완료: "${analysis.formName}" - ${analysis.fields.length}개 필드 식별`);
    return analysis;
  } catch (e) {
    console.error('  [Gemini] JSON 파싱 실패. 응답:', responseText.substring(0, 500));
    throw new Error('Gemini 응답을 JSON으로 파싱할 수 없습니다.');
  }
}

// =============================================================================
// Step 4: Inject Placeholders into XML
// =============================================================================

/**
 * Gemini가 식별한 입력란 위치에 {{fieldName}} 플레이스홀더를 삽입한다.
 * 역순으로 처리하여 위치 오프셋이 어긋나지 않도록 한다.
 */
function injectPlaceholders(
  xmlMap: Map<string, string>, // entryName → xml content
  allNodes: TextNode[],
  analysis: GeminiAnalysis,
): Map<string, string> {
  // 모든 교체 작업을 수집
  interface Replacement {
    entryName: string;
    textStart: number;
    textEnd: number;
    newText: string;
    fieldName: string;
  }

  const replacements: Replacement[] = [];

  for (const field of analysis.fields) {
    if (!field.nodeIndices || field.nodeIndices.length === 0) continue;

    for (const nodeIdx of field.nodeIndices) {
      const node = allNodes.find((n) => n.index === nodeIdx);
      if (!node) {
        console.warn(`  [주의] 노드 인덱스 ${nodeIdx} (필드: ${field.name}) 를 찾을 수 없습니다.`);
        continue;
      }

      replacements.push({
        entryName: node.entryName,
        textStart: node.textStart,
        textEnd: node.textEnd,
        newText: `{{${field.name}}}`,
        fieldName: field.name,
      });
    }
  }

  // entryName별로 그룹핑 후 역순 처리
  const grouped = new Map<string, Replacement[]>();
  for (const r of replacements) {
    const list = grouped.get(r.entryName) || [];
    list.push(r);
    grouped.set(r.entryName, list);
  }

  const result = new Map(xmlMap);

  grouped.forEach((reps, entryName) => {
    let xml = result.get(entryName);
    if (!xml) return;

    // 역순 정렬 (뒤에서부터 교체해야 앞의 offset이 안 변함)
    reps.sort((a, b) => b.textStart - a.textStart);

    for (const r of reps) {
      const before = xml!.substring(0, r.textStart);
      const after = xml!.substring(r.textEnd);
      xml = before + r.newText + after;
      console.log(`  [태깅] {{${r.fieldName}}} 삽입 (${entryName})`);
    }

    result.set(entryName, xml!);
  });

  return result;
}

// =============================================================================
// Step 5: Process Single HWPX File
// =============================================================================

async function processFile(filePath: string, prisma: PrismaClient): Promise<boolean> {
  const fileName = path.basename(filePath);
  const baseName = path.basename(filePath, '.hwpx');
  const templateCode = `hwpx_${baseName}`;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`처리 중: ${fileName}`);
  console.log(`${'='.repeat(60)}`);

  // 1. HWPX 열기
  let zip: AdmZip;
  try {
    zip = new AdmZip(filePath);
  } catch (e) {
    console.error(`  [오류] HWPX 파일을 열 수 없습니다: ${e}`);
    return false;
  }

  // 2. Section XML 추출 + 텍스트 노드 인덱싱
  const xmlMap = new Map<string, string>();
  let allNodes: TextNode[] = [];
  let globalIndex = 0;

  for (const entry of zip.getEntries()) {
    const isTarget = SECTION_PATTERNS.some((p) => p.test(entry.entryName));
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
    console.error('  [오류] 텍스트 노드를 찾을 수 없습니다. HWPX 구조를 확인하세요.');
    return false;
  }

  console.log(`  [총합] ${allNodes.length}개 텍스트 노드 추출`);

  // 3. Gemini 분석
  const textMap = buildTextMap(allNodes);
  let analysis: GeminiAnalysis;

  try {
    analysis = await analyzeWithGemini(textMap, fileName);
  } catch (e) {
    // 1회 재시도
    console.warn(`  [재시도] Gemini 분석 실패, 1회 재시도...`);
    try {
      analysis = await analyzeWithGemini(textMap, fileName);
    } catch (e2) {
      console.error(`  [오류] Gemini 분석 최종 실패: ${e2}`);
      return false;
    }
  }

  // 4. 플레이스홀더 삽입
  const taggedXmlMap = injectPlaceholders(xmlMap, allNodes, analysis);

  // 5. 새 HWPX 생성 (tagged/)
  if (!fs.existsSync(TAGGED_DIR)) {
    fs.mkdirSync(TAGGED_DIR, { recursive: true });
  }

  // 원본 ZIP 복사 후 XML만 교체
  const taggedZip = new AdmZip(filePath);
  taggedXmlMap.forEach((taggedXml, entryName) => {
    taggedZip.updateFile(entryName, Buffer.from(taggedXml, 'utf8'));
  });

  const taggedPath = path.join(TAGGED_DIR, fileName);
  taggedZip.writeZip(taggedPath);
  console.log(`  [저장] 태깅된 파일: ${taggedPath}`);

  // 6. 검증: 삽입된 플레이스홀더 확인
  const verifyZip = new AdmZip(taggedPath);
  let verifiedCount = 0;
  for (const entry of verifyZip.getEntries()) {
    const isTarget = SECTION_PATTERNS.some((p) => p.test(entry.entryName));
    if (!isTarget) continue;
    const content = entry.getData().toString('utf8');
    const matches = content.match(/\{\{[^}]+\}\}/g);
    if (matches) verifiedCount += matches.length;
  }
  console.log(`  [검증] ${verifiedCount}개 플레이스홀더 확인됨`);

  // 7. DB 등록
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
    name: analysis.formName || baseName,
    category: analysis.category || '일반',
    description: analysis.description || '',
    originalFileUrl: `/templates/hwpx/tagged/${fileName}`,
    originalFileType: 'hwpx',
    fields: fieldsJson,
    outputFileName: `${analysis.formName || baseName}_{date}.hwpx`,
    status: 'active',
    version: 1,
  };

  try {
    await prisma.formTemplate.upsert({
      where: { code: templateCode },
      create: { code: templateCode, ...templateData },
      update: { ...templateData, version: { increment: 1 } },
    });
    console.log(`  [DB] FormTemplate 등록 완료: code="${templateCode}"`);
  } catch (e) {
    console.error(`  [DB 오류] ${e}`);
    return false;
  }

  // 요약
  console.log(`\n  ✓ 완료: ${analysis.formName}`);
  console.log(`    - 카테고리: ${analysis.category}`);
  console.log(`    - 필드 ${analysis.fields.length}개: ${analysis.fields.map((f) => f.name).join(', ')}`);
  console.log(`    - 태깅 파일: tagged/${fileName}`);
  console.log(`    - DB code: ${templateCode}`);

  return true;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  loadEnv();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Phase 12: HWPX Auto-Tagging Engine                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // CLI 인수 파싱
  const args = process.argv.slice(2);
  const forceMode = args.includes('--force');
  const specificFile = args.find((a) => a.endsWith('.hwpx'));

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('[오류] GOOGLE_AI_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }

  // 디렉토리 확인
  if (!fs.existsSync(RAW_DIR)) {
    console.error(`[오류] HWPX 폴더가 없습니다: ${RAW_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(TAGGED_DIR)) {
    fs.mkdirSync(TAGGED_DIR, { recursive: true });
  }

  // 처리할 파일 목록
  let hwpxFiles: string[];

  if (specificFile) {
    const fullPath = path.join(RAW_DIR, specificFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`[오류] 파일을 찾을 수 없습니다: ${fullPath}`);
      process.exit(1);
    }
    hwpxFiles = [fullPath];
  } else {
    hwpxFiles = fs.readdirSync(RAW_DIR)
      .filter((f) => f.endsWith('.hwpx'))
      .map((f) => path.join(RAW_DIR, f));
  }

  if (hwpxFiles.length === 0) {
    console.log('\n처리할 HWPX 파일이 없습니다.');
    console.log(`  → ${RAW_DIR} 폴더에 원본 HWPX 파일을 넣어주세요.`);
    process.exit(0);
  }

  // 이미 태깅된 파일 스킵 체크
  if (!forceMode) {
    const existingTagged = new Set(
      fs.existsSync(TAGGED_DIR)
        ? fs.readdirSync(TAGGED_DIR).filter((f) => f.endsWith('.hwpx'))
        : []
    );

    const before = hwpxFiles.length;
    hwpxFiles = hwpxFiles.filter((f) => !existingTagged.has(path.basename(f)));

    if (before > hwpxFiles.length) {
      console.log(`\n${before - hwpxFiles.length}개 파일은 이미 태깅됨 (--force로 재처리 가능)`);
    }
  }

  if (hwpxFiles.length === 0) {
    console.log('\n새로 처리할 파일이 없습니다.');
    process.exit(0);
  }

  console.log(`\n처리 대상: ${hwpxFiles.length}개 파일`);
  hwpxFiles.forEach((f) => console.log(`  - ${path.basename(f)}`));

  // Prisma 연결
  const prisma = new PrismaClient();

  try {
    let successCount = 0;
    let failCount = 0;

    for (const file of hwpxFiles) {
      const ok = await processFile(file, prisma);
      if (ok) successCount++;
      else failCount++;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`처리 완료: 성공 ${successCount}개 / 실패 ${failCount}개`);
    console.log(`${'='.repeat(60)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[치명적 오류]', err);
  process.exit(1);
});
