// 맥락 인식형 법령 검색 서비스
// Intent에 따라 검색 범위를 동적으로 조정

import {
  classifyIntent,
  IntentClassification,
  SearchScope,
  SearchMode,
  describeScopeForLog,
} from './intentClassifier';
import { searchForm, COMMON_FORMS, FormSearchResult, searchFormFromApi } from '../lawApi';
import { validateLink, generateFallbackLink, LinkValidationResult } from '../utils/linkValidator';

// =============================================================================
// 타입 정의
// =============================================================================

export interface LegalSearchResult {
  success: boolean;
  intent: IntentClassification;
  statutes: StatuteResult[];
  precedents: PrecedentResult[];
  rulings: RulingResult[];
  forms: FormResult[];
  localLaws: LocalLawResult[];
  error?: string;
  systemMessage?: string;  // API 오류 시 사용자에게 보여줄 메시지
}

export interface StatuteResult {
  lawId: string;
  lawName: string;
  lawType: string;
  lawUrl: string;
  relevantArticles?: string[];
}

export interface PrecedentResult {
  caseNumber: string;
  caseName: string;
  court: string;
  decisionDate: string;
  summary: string;
  url: string;
}

export interface RulingResult {
  rulingNumber: string;
  title: string;
  agency: string;
  decisionDate: string;
  summary: string;
  url: string;
}

export interface FormResult {
  formName: string;
  formUrl: string;
  lawName: string;
  lawPage: string;
  isValidated: boolean;
  validationError?: string;
  fallbackUrl?: string;
}

export interface LocalLawResult {
  lawName: string;
  localGov: string;
  lawUrl: string;
}

// =============================================================================
// 국가법령정보센터 API 호출
// =============================================================================

const LAW_API_BASE = 'https://www.law.go.kr/DRF';
const LAW_API_ID = process.env.LAW_API_ID || 'duath1031';

/**
 * 법령 검색 API
 */
async function searchStatutes(query: string): Promise<StatuteResult[]> {
  try {
    const cleanQuery = cleanSearchQuery(query);
    const url = `${LAW_API_BASE}/lawSearch.do?OC=${LAW_API_ID}&target=law&type=XML&query=${encodeURIComponent(cleanQuery)}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
    });

    if (!response.ok) {
      console.error(`[LawService] 법령 검색 실패: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const results: StatuteResult[] = [];

    // XML 파싱 (간단한 정규식)
    const lawMatches = xmlText.matchAll(
      /<법령ID>(\d+)<\/법령ID>[\s\S]*?<법령명한글>([^<]+)<\/법령명한글>/g
    );

    for (const match of lawMatches) {
      const lawId = match[1];
      const lawName = match[2];
      results.push({
        lawId,
        lawName,
        lawType: '법령',
        // 한글 URL 대신 검색 URL 사용 (인코딩 문제 방지)
        lawUrl: `https://www.law.go.kr/LSW/lsSc.do?menuId=1&query=${encodeURIComponent(lawName)}`,
      });
    }

    return results.slice(0, 5); // 상위 5개만
  } catch (error) {
    console.error('[LawService] 법령 검색 오류:', error);
    return [];
  }
}

/**
 * 판례 검색 API
 */
async function searchPrecedents(query: string): Promise<PrecedentResult[]> {
  try {
    const cleanQuery = cleanSearchQuery(query);
    const url = `${LAW_API_BASE}/lawSearch.do?OC=${LAW_API_ID}&target=prec&type=XML&query=${encodeURIComponent(cleanQuery)}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
    });

    if (!response.ok) {
      console.error(`[LawService] 판례 검색 실패: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const results: PrecedentResult[] = [];

    // XML 파싱
    const caseMatches = xmlText.matchAll(
      /<판례일련번호>(\d+)<\/판례일련번호>[\s\S]*?<사건명>([^<]*)<\/사건명>[\s\S]*?<사건번호>([^<]*)<\/사건번호>[\s\S]*?<선고일자>([^<]*)<\/선고일자>[\s\S]*?<법원명>([^<]*)<\/법원명>/g
    );

    for (const match of caseMatches) {
      const caseId = match[1];
      const caseName = match[2] || match[3];
      const caseNumber = match[3];
      const decisionDate = match[4];
      const court = match[5];

      results.push({
        caseNumber,
        caseName,
        court,
        decisionDate,
        summary: '',
        url: `https://www.law.go.kr/판례/${caseId}`,
      });
    }

    return results.slice(0, 3); // 판례는 3개만
  } catch (error) {
    console.error('[LawService] 판례 검색 오류:', error);
    return [];
  }
}

/**
 * 행정심판 재결례 검색
 */
async function searchRulings(query: string): Promise<RulingResult[]> {
  try {
    const cleanQuery = cleanSearchQuery(query);
    const url = `${LAW_API_BASE}/lawSearch.do?OC=${LAW_API_ID}&target=detc&type=XML&query=${encodeURIComponent(cleanQuery)}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
    });

    if (!response.ok) {
      return [];
    }

    const xmlText = await response.text();
    const results: RulingResult[] = [];

    // 행정심판 재결례 파싱
    const rulingMatches = xmlText.matchAll(
      /<결정례일련번호>(\d+)<\/결정례일련번호>[\s\S]*?<결정례제목>([^<]*)<\/결정례제목>/g
    );

    for (const match of rulingMatches) {
      const rulingId = match[1];
      const title = match[2];

      results.push({
        rulingNumber: rulingId,
        title,
        agency: '행정심판위원회',
        decisionDate: '',
        summary: '',
        url: `https://www.law.go.kr/행정심판례/${rulingId}`,
      });
    }

    return results.slice(0, 3);
  } catch (error) {
    console.error('[LawService] 행정심판 검색 오류:', error);
    return [];
  }
}

/**
 * 자치법규 검색
 */
async function searchLocalLaws(query: string): Promise<LocalLawResult[]> {
  try {
    const cleanQuery = cleanSearchQuery(query);
    const url = `${LAW_API_BASE}/lawSearch.do?OC=${LAW_API_ID}&target=ordin&type=XML&query=${encodeURIComponent(cleanQuery)}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
    });

    if (!response.ok) {
      return [];
    }

    const xmlText = await response.text();
    const results: LocalLawResult[] = [];

    const localMatches = xmlText.matchAll(
      /<자치법규일련번호>(\d+)<\/자치법규일련번호>[\s\S]*?<자치법규명>([^<]*)<\/자치법규명>[\s\S]*?<지방자치단체명>([^<]*)<\/지방자치단체명>/g
    );

    for (const match of localMatches) {
      const lawId = match[1];
      const lawName = match[2];
      const localGov = match[3];

      results.push({
        lawName,
        localGov,
        lawUrl: `https://www.law.go.kr/자치법규/${lawId}`,
      });
    }

    return results.slice(0, 3);
  } catch (error) {
    console.error('[LawService] 자치법규 검색 오류:', error);
    return [];
  }
}

/**
 * 서식 검색 및 검증
 * 1. COMMON_FORMS에서 키워드 매칭 시 해당 법령의 서식을 API로 조회
 * 2. API 조회 실패 시 검색 페이지 URL 제공
 */
async function searchAndValidateForms(query: string): Promise<FormResult[]> {
  const results: FormResult[] = [];
  const processedLaws = new Set<string>(); // 중복 법령 조회 방지

  // COMMON_FORMS에서 관련 키워드 매칭
  for (const [keyword, formInfo] of Object.entries(COMMON_FORMS)) {
    if (query.includes(keyword) && !processedLaws.has(formInfo.lawName)) {
      processedLaws.add(formInfo.lawName);

      try {
        // API를 통해 최신 서식 정보 조회
        const apiResult = await searchFormFromApi(formInfo.lawName, keyword);

        if (apiResult.success && apiResult.forms.length > 0) {
          for (const form of apiResult.forms.slice(0, 3)) { // 최대 3개
            const formResult: FormResult = {
              formName: form.formName,
              formUrl: form.formUrl,
              lawName: form.lawName,
              lawPage: form.lawPage,
              isValidated: true, // API에서 가져온 최신 정보
            };
            results.push(formResult);
          }
        } else {
          // API 실패 시 검색 페이지 URL 제공
          results.push({
            formName: formInfo.formName,
            formUrl: formInfo.formUrl, // 이미 검색 URL로 설정됨
            lawName: formInfo.lawName,
            lawPage: formInfo.lawPage,
            isValidated: true,
          });
        }
      } catch (error) {
        console.error(`[LawService] 서식 API 조회 실패 (${formInfo.lawName}):`, error);
        // 에러 시에도 검색 URL 제공
        results.push({
          formName: formInfo.formName,
          formUrl: formInfo.formUrl,
          lawName: formInfo.lawName,
          lawPage: formInfo.lawPage,
          isValidated: true,
        });
      }
    }
  }

  return results;
}

// =============================================================================
// 헬퍼 함수
// =============================================================================

/**
 * 검색어 정제
 */
function cleanSearchQuery(query: string): string {
  const removeKeywords = ['줘', '달라', '찾아줘', '알려줘', '보내줘', '?', '.', '!'];
  let clean = query;
  removeKeywords.forEach(k => {
    clean = clean.replace(new RegExp(k, 'g'), '');
  });
  return clean.trim();
}

/**
 * 검색 결과에서 핵심 법령 키워드 추출
 */
function extractLawKeywords(query: string): string[] {
  const keywords: string[] = [];

  // 법령명 패턴 매칭
  const lawPatterns = [
    /([가-힣]+법)/g,
    /([가-힣]+령)/g,
    /([가-힣]+규칙)/g,
    /([가-힣]+조례)/g,
  ];

  for (const pattern of lawPatterns) {
    const matches = query.match(pattern);
    if (matches) {
      keywords.push(...matches);
    }
  }

  return [...new Set(keywords)];
}

// =============================================================================
// 메인 검색 함수
// =============================================================================

/**
 * 맥락 인식형 법령 검색
 * Intent에 따라 검색 범위를 자동 조정
 */
export async function searchLegalInfo(query: string): Promise<LegalSearchResult> {
  console.log(`[LawService] 검색 시작: "${query.substring(0, 50)}..."`);

  // 1. 의도 분류
  const intent = await classifyIntent(query);
  console.log(`[LawService] 의도 분류: ${intent.mode} (신뢰도: ${intent.confidence})`);
  console.log(`[LawService] 검색 범위: ${describeScopeForLog(intent.searchScope)}`);

  const result: LegalSearchResult = {
    success: true,
    intent,
    statutes: [],
    precedents: [],
    rulings: [],
    forms: [],
    localLaws: [],
  };

  const scope = intent.searchScope;

  try {
    // 2. 검색 범위에 따른 병렬 검색
    const searchPromises: Promise<void>[] = [];

    // 법령 검색 (항상)
    if (scope.statutes) {
      searchPromises.push(
        searchStatutes(query).then(res => { result.statutes = res; })
      );
    }

    // 판례 검색 (분쟁 모드에서만)
    if (scope.precedents) {
      searchPromises.push(
        searchPrecedents(query).then(res => { result.precedents = res; })
      );
    }

    // 행정심판 재결례 검색 (분쟁 모드에서만)
    if (scope.rulings) {
      searchPromises.push(
        searchRulings(query).then(res => { result.rulings = res; })
      );
    }

    // 자치법규 검색 (절차 모드에서)
    if (scope.localLaws) {
      searchPromises.push(
        searchLocalLaws(query).then(res => { result.localLaws = res; })
      );
    }

    // 서식 검색 (절차 모드에서)
    if (scope.forms) {
      searchPromises.push(
        searchAndValidateForms(query).then(res => { result.forms = res; })
      );
    }

    await Promise.all(searchPromises);

    // 3. 결과 검증
    const totalResults =
      result.statutes.length +
      result.precedents.length +
      result.rulings.length +
      result.forms.length +
      result.localLaws.length;

    if (totalResults === 0) {
      result.systemMessage = '검색 결과가 없습니다. 다른 검색어로 시도해 주세요.';
    }

  } catch (error) {
    console.error('[LawService] 검색 중 오류:', error);
    result.success = false;
    result.error = error instanceof Error ? error.message : '알 수 없는 오류';
    result.systemMessage = '죄송합니다. 현재 정부 시스템 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.';
  }

  return result;
}

// =============================================================================
// 결과 포맷팅
// =============================================================================

/**
 * 검색 결과를 AI 프롬프트용 컨텍스트로 포맷팅
 */
export function formatLegalResultForPrompt(result: LegalSearchResult): string {
  if (!result.success) {
    return `\n[법령 검색 오류]\n${result.systemMessage || result.error}\n`;
  }

  let context = '';

  // 검색 모드 안내
  const modeDescriptions: Record<SearchMode, string> = {
    procedure: '절차/요건 질문으로 분류되어 법령과 서식을 중심으로 검색했습니다.',
    dispute: '분쟁/구제 질문으로 분류되어 판례와 행정심판 재결례를 포함하여 검색했습니다.',
    general: '일반 법령 정보를 검색했습니다.',
  };
  context += `\n[검색 모드: ${result.intent.mode}]\n${modeDescriptions[result.intent.mode]}\n`;

  // 법령 정보
  if (result.statutes.length > 0) {
    context += `\n[관련 법령]\n`;
    for (const statute of result.statutes) {
      context += `- ${statute.lawName}\n`;
      context += `  링크: ${statute.lawUrl}\n`;
    }
  }

  // 판례 정보 (분쟁 모드에서만)
  if (result.precedents.length > 0) {
    context += `\n[관련 판례]\n`;
    for (const prec of result.precedents) {
      context += `- ${prec.caseName} (${prec.caseNumber})\n`;
      context += `  ${prec.court}, ${prec.decisionDate}\n`;
      context += `  링크: ${prec.url}\n`;
    }
  }

  // 행정심판 재결례 (분쟁 모드에서만)
  if (result.rulings.length > 0) {
    context += `\n[행정심판 재결례]\n`;
    for (const ruling of result.rulings) {
      context += `- ${ruling.title}\n`;
      context += `  링크: ${ruling.url}\n`;
    }
  }

  // 서식 정보
  if (result.forms.length > 0) {
    context += `\n[관련 서식]\n`;
    for (const form of result.forms) {
      context += `- ${form.formName}\n`;
      if (form.isValidated) {
        context += `  다운로드: ${form.formUrl}\n`;
      } else {
        context += `  ⚠️ 직접 링크 불안정 - 대체 링크 사용 권장\n`;
        context += `  대체 링크: ${form.fallbackUrl}\n`;
      }
      context += `  근거법령: ${form.lawName}\n`;
    }
  }

  // 자치법규
  if (result.localLaws.length > 0) {
    context += `\n[자치법규]\n`;
    for (const local of result.localLaws) {
      context += `- ${local.lawName} (${local.localGov})\n`;
      context += `  링크: ${local.lawUrl}\n`;
    }
  }

  // 시스템 메시지
  if (result.systemMessage) {
    context += `\n[시스템 안내]\n${result.systemMessage}\n`;
  }

  return context;
}

/**
 * 사용자용 검색 결과 요약
 */
export function formatLegalResultForUser(result: LegalSearchResult): string {
  if (!result.success) {
    return result.systemMessage || '검색 중 오류가 발생했습니다.';
  }

  let output = '';

  // 법령
  if (result.statutes.length > 0) {
    output += '📚 **관련 법령**\n';
    for (const s of result.statutes.slice(0, 3)) {
      output += `- [${s.lawName}](${s.lawUrl})\n`;
    }
    output += '\n';
  }

  // 판례 (분쟁 모드)
  if (result.precedents.length > 0) {
    output += '⚖️ **관련 판례**\n';
    for (const p of result.precedents) {
      output += `- ${p.caseName} (${p.caseNumber})\n`;
      output += `  ${p.court} | [판례 보기](${p.url})\n`;
    }
    output += '\n';
  }

  // 서식
  if (result.forms.length > 0) {
    output += '📋 **관련 서식**\n';
    for (const f of result.forms) {
      if (f.isValidated) {
        output += `- [${f.formName}](${f.formUrl})\n`;
      } else {
        output += `- ${f.formName}\n`;
        output += `  ⚠️ [대체 검색 링크](${f.fallbackUrl})\n`;
      }
    }
    output += '\n';
  }

  return output || '관련 정보를 찾지 못했습니다.';
}
