// 맥락 인식형 법령 검색을 위한 의도 분류기
// 모든 질문에 판례를 가져오지 않고, 사용자 의도에 따라 필요한 데이터만 조회

import { GoogleGenerativeAI } from "@google/generative-ai";

// =============================================================================
// 검색 모드 정의
// =============================================================================

export type SearchMode = 'procedure' | 'dispute' | 'general';

export interface IntentClassification {
  mode: SearchMode;
  confidence: number;
  keywords: string[];
  reasoning: string;
  searchScope: SearchScope;
}

export interface SearchScope {
  statutes: boolean;      // 법령
  regulations: boolean;   // 시행령/시행규칙
  localLaws: boolean;     // 자치법규
  precedents: boolean;    // 판례
  rulings: boolean;       // 행정심판 재결례
  forms: boolean;         // 서식
}

// =============================================================================
// 키워드 기반 빠른 분류 (LLM 호출 전 1차 필터링)
// =============================================================================

// 절차/요건 관련 키워드 (판례 불필요)
const PROCEDURE_KEYWORDS = [
  // 인허가 절차
  '허가', '신고', '등록', '인가', '면허', '지정', '승인',
  '조건', '요건', '자격', '기준', '절차', '방법', '서류',
  // 구체적 업종
  '식품위생', '영업신고', '공장등록', '건축허가', '개발행위',
  '사업자등록', '통신판매', '학원등록', '숙박업', '음식점',
  // 서식/양식
  '서식', '양식', '신청서', '신고서', '구비서류', '첨부서류',
  // 처리 관련
  '처리기간', '수수료', '비용', '담당부서', '민원', '신청',
  // 질문 패턴
  '어떻게', '뭐가 필요', '무엇이 필요', '조건이', '요건이',
  '알려', '안내', '설명'
];

// 분쟁/구제 관련 키워드 (판례 필요)
const DISPUTE_KEYWORDS = [
  // 분쟁/소송
  '취소', '반려', '거부', '기각', '각하', '불허',
  '소송', '재판', '항고', '상소', '이의', '불복',
  // 행정심판
  '행정심판', '행정소송', '재결', '심판', '심사청구',
  // 구제/권리
  '구제', '손해배상', '배상', '보상', '억울', '위법', '부당',
  '권리구제', '권리침해', '처분취소', '무효확인',
  // 판례 관련
  '판례', '판결', '선례', '법원', '대법원', '헌법재판소',
  // 상황 설명
  '거부당했', '반려됐', '취소됐', '영업정지', '과태료',
  '행정처분', '시정명령', '영업취소', '허가취소',
  // 감정 표현
  '억울', '부당', '문제', '분쟁', '다툼'
];

/**
 * 키워드 기반 빠른 의도 분류 (1차 필터링)
 */
export function quickClassify(message: string): {
  likelyMode: SearchMode;
  procedureScore: number;
  disputeScore: number;
} {
  const lowerMessage = message.toLowerCase();

  let procedureScore = 0;
  let disputeScore = 0;

  // 절차 키워드 점수
  for (const keyword of PROCEDURE_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      procedureScore += 1;
    }
  }

  // 분쟁 키워드 점수
  for (const keyword of DISPUTE_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      disputeScore += 2; // 분쟁 키워드에 더 높은 가중치
    }
  }

  // 점수에 따른 모드 결정
  let likelyMode: SearchMode = 'general';

  if (disputeScore >= 4 || disputeScore > procedureScore * 1.5) {
    likelyMode = 'dispute';
  } else if (procedureScore >= 2) {
    likelyMode = 'procedure';
  }

  return { likelyMode, procedureScore, disputeScore };
}

// =============================================================================
// LLM 기반 정밀 분류
// =============================================================================

const CLASSIFICATION_PROMPT = `
당신은 법률 질문 의도 분류 전문가입니다. 사용자의 질문을 분석하여 검색 범위를 결정해야 합니다.

## 분류 기준

### 1. PROCEDURE (절차/요건 질문) - 판례 불필요
- 인허가 조건, 신고 요건, 등록 절차 등을 묻는 질문
- 서류, 서식, 구비서류에 대한 질문
- 처리기간, 수수료, 담당부서 문의
- 예시: "식품위생업 허가 조건이 뭐야?", "공장 등록 서류 알려줘", "건축허가 절차가 어떻게 돼?"

### 2. DISPUTE (분쟁/구제 질문) - 판례 필요
- 행정처분에 대한 불복, 취소 요청
- 허가 반려/거부에 대한 대응
- 행정소송, 행정심판 관련 질문
- 손해배상, 권리구제 관련
- 예시: "영업정지 취소하고 싶어", "허가가 반려됐는데 소송 가능해?", "억울해"

### 3. GENERAL (일반 질문)
- 법령 내용 단순 문의
- 용어 설명 요청
- 분류가 모호한 경우

## 응답 형식 (JSON)
{
  "mode": "procedure" | "dispute" | "general",
  "confidence": 0.0 ~ 1.0,
  "keywords": ["감지된", "키워드", "목록"],
  "reasoning": "분류 이유 간단 설명"
}

## 사용자 질문
`;

/**
 * LLM을 사용한 정밀 의도 분류
 */
export async function classifyIntentWithLLM(message: string): Promise<IntentClassification> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1, // 일관된 분류를 위해 낮은 온도
      maxOutputTokens: 512,
    }
  });

  try {
    const result = await model.generateContent(CLASSIFICATION_PROMPT + message);
    const responseText = result.response.text();

    // JSON 파싱
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        mode: parsed.mode || 'general',
        confidence: parsed.confidence || 0.5,
        keywords: parsed.keywords || [],
        reasoning: parsed.reasoning || '',
        searchScope: getSearchScope(parsed.mode || 'general'),
      };
    }
  } catch (error) {
    console.error('[IntentClassifier] LLM 분류 오류:', error);
  }

  // 폴백: 키워드 기반 분류
  const quickResult = quickClassify(message);
  return {
    mode: quickResult.likelyMode,
    confidence: 0.6,
    keywords: [],
    reasoning: '키워드 기반 분류 (LLM 폴백)',
    searchScope: getSearchScope(quickResult.likelyMode),
  };
}

/**
 * 검색 모드에 따른 검색 범위 결정
 */
export function getSearchScope(mode: SearchMode): SearchScope {
  switch (mode) {
    case 'procedure':
      // 절차/요건 질문: 법령 + 자치법규 + 서식만
      return {
        statutes: true,
        regulations: true,
        localLaws: true,
        precedents: false,  // 판례 제외!
        rulings: false,
        forms: true,
      };

    case 'dispute':
      // 분쟁/구제 질문: 모든 소스 검색
      return {
        statutes: true,
        regulations: true,
        localLaws: true,
        precedents: true,   // 판례 포함
        rulings: true,      // 행정심판 재결례 포함
        forms: false,
      };

    case 'general':
    default:
      // 일반 질문: 법령만
      return {
        statutes: true,
        regulations: true,
        localLaws: false,
        precedents: false,
        rulings: false,
        forms: false,
      };
  }
}

// =============================================================================
// 통합 분류 함수
// =============================================================================

/**
 * 질문 의도를 분류하고 검색 범위를 결정
 * 1차: 키워드 기반 빠른 분류
 * 2차: 확실하지 않으면 LLM 사용
 */
export async function classifyIntent(message: string): Promise<IntentClassification> {
  // 1차: 키워드 기반 빠른 분류
  const quickResult = quickClassify(message);

  // 점수 차이가 명확하면 LLM 호출 없이 바로 반환
  const scoreDiff = Math.abs(quickResult.procedureScore - quickResult.disputeScore);
  const totalScore = quickResult.procedureScore + quickResult.disputeScore;

  if (totalScore >= 3 && scoreDiff >= 2) {
    console.log(`[IntentClassifier] 키워드 분류 사용: ${quickResult.likelyMode}`);
    return {
      mode: quickResult.likelyMode,
      confidence: 0.8,
      keywords: [],
      reasoning: `키워드 분석 (절차:${quickResult.procedureScore}, 분쟁:${quickResult.disputeScore})`,
      searchScope: getSearchScope(quickResult.likelyMode),
    };
  }

  // 2차: LLM 정밀 분류
  console.log('[IntentClassifier] LLM 분류 사용');
  return await classifyIntentWithLLM(message);
}

/**
 * 검색 범위 설명 생성 (디버깅/로깅용)
 */
export function describeScopeForLog(scope: SearchScope): string {
  const sources: string[] = [];

  if (scope.statutes) sources.push('법령');
  if (scope.regulations) sources.push('시행령/규칙');
  if (scope.localLaws) sources.push('자치법규');
  if (scope.precedents) sources.push('판례');
  if (scope.rulings) sources.push('행정심판');
  if (scope.forms) sources.push('서식');

  return sources.join(', ');
}
