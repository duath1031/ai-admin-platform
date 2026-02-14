import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { chatWithKnowledgeStream, FileDataPart, UserTier } from "@/lib/gemini";
import { getActiveSystemPrompt } from "@/lib/systemPromptService";
import { searchForm, formatFormInfo, COMMON_FORMS } from "@/lib/lawApi";
import { searchLandUse, formatLandUseResult } from "@/lib/landUseApi";
import { searchBuilding, formatBuildingResult } from "@/lib/buildingApi";
import { searchBusinessTypes } from "@/lib/formDatabase";
// RAG 시스템 (맥락 인식형 법령 검색)
import { searchLegalInfo, formatLegalResultForPrompt } from "@/lib/rag/lawService";
import { quickClassify } from "@/lib/rag/intentClassifier";
// Knowledge Base - 경량 버전 사용 (Smart Tag 기반)
import { getKnowledgeByTags } from "@/lib/ai/knowledgeQuery";
// 토큰 시스템
import { deductTokens } from "@/lib/token/tokenService";
import { checkFeatureAccess, getUserPlanCode } from "@/lib/token/planAccess";
// 멀티 AI 라우터: 질문 유형별 모델 자동 선택
import { routeQuery, applyPlanOverride, RouteResult } from "@/lib/ai/multiRouter";
// 문서 생성: LLM-Driven Selection (Phase 11) - DB에서 동적 로드

// Vercel 서버리스 함수 타임아웃 설정
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 외부 API 타임아웃 헬퍼 함수
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), timeoutMs)
    ),
  ]);
}

// =============================================================================
// 멀티 AI 라우터: planCode + 질문 유형 → UserTier 매핑
// Flash 라우팅 시 비용 절감, Pro 라우팅 시 고급 모델 사용
// =============================================================================
function resolveUserTier(planCode: string, route: RouteResult): UserTier {
  if (route.target === 'flash' || route.target === 'flash_grounding') {
    // 단순 질문 → 저렴한 Flash 모델 (플랜 무관)
    return planCode === 'starter' ? 'free' : 'basic';
  }
  // Pro 라우팅 → 플랜별 Pro 모델
  switch (planCode) {
    case 'pro': return 'professional';
    case 'pro_plus': return 'pro_plus';
    default: return 'basic'; // Starter/Standard는 applyPlanOverride에서 Flash로 전환됨
  }
}

// =============================================================================
// Knowledge Base 문서 관련성 필터 (Smart Tag 기반 - Phase 2)
// =============================================================================

// Phase 11: Anti-Hallucination 임계값
// 0.6 미만 → 문서 폐기 (Gemini 순수 지능으로 답변)
// 0.7 이상 → 확실한 문서만 출처 표기
const KB_TAG_MATCH_THRESHOLD = 0.6;
const KB_CONFIDENT_CITATION_THRESHOLD = 0.7;

/**
 * 단순 인사/잡담 감지 — 지식검색 전부 스킵
 */
function isSimpleGreeting(message: string): boolean {
  const trimmed = message.trim().replace(/[.!?~]+$/, "").trim();
  const greetings = [
    "안녕하세요", "안녕", "하이", "헬로", "hello", "hi",
    "감사합니다", "감사", "고맙습니다", "고마워",
    "네", "예", "아니오", "아니요", "응", "웅",
    "좋아", "좋아요", "알겠습니다", "알겠어요", "확인",
    "반갑습니다", "반가워요", "처음 뵙겠습니다",
    "수고하세요", "수고하셨습니다",
  ];
  if (greetings.includes(trimmed)) return true;
  if (trimmed.length <= 5 && !/신고|신청|허가|등록|발급|조회|서류|양식|법|세무|사업|토지|건축/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * 사용자 메시지에서 검색 키워드 추출 (경량 - AI 호출 없음)
 */
function extractSearchKeywords(message: string): string[] {
  const stopWords = new Set([
    "어떻게", "무엇", "언제", "어디", "왜", "얼마", "어떤",
    "하는", "하고", "해야", "할까", "인가", "인지", "에서",
    "으로", "에게", "한테", "부터", "까지", "대해", "대한",
    "관련", "관해", "있는", "없는", "하려", "싶은", "원하",
    "알려", "궁금", "질문", "답변", "도와", "부탁", "감사",
    "안녕", "하세요", "합니다", "입니다", "습니다", "것이",
    "수가", "방법", "절차", "과정", "필요", "서류",
    "하려면", "뭐가", "필요해", "알려줘", "알려주세요", "주세요",
    "있나요", "있는지", "싶습니다", "어떤가요", "할수", "해주세요",
  ]);

  const particleSuffixes = [
    "하려면", "에서는", "으로는", "에서의", "으로의",
    "에서", "에게", "한테", "으로", "부터", "까지", "에는",
    "이란", "이라", "이요", "인가", "인지",
    "가요", "나요", "는지", "인데", "이고",
    "은요", "는요", "이요",
    "가", "를", "을", "에", "의", "은", "는", "이", "와", "과",
    "도", "만", "로", "서", "야",
  ];

  function stripParticles(word: string): string {
    for (const suffix of particleSuffixes) {
      if (word.length > suffix.length + 1 && word.endsWith(suffix)) {
        return word.slice(0, -suffix.length);
      }
    }
    return word;
  }

  const tokens = message
    .replace(/[?!.,;:'"()[\]{}<>~`@#$%^&*+=|\\\/]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .map(t => t.toLowerCase());

  const keywords = tokens
    .filter(t => !stopWords.has(t))
    .map(t => stripParticles(t))
    .filter(t => t.length >= 2);
  return [...new Set(keywords)];
}

// =============================================================================
// 문서 생성 템플릿: LLM-Driven Selection (Phase 11 Refactor)
// =============================================================================
// 하드코딩된 키워드 매칭 제거. Gemini가 대화 맥락에서 직접 판단하여
// DB의 HWPX 템플릿 목록 중 적합한 서식을 선택한다.

// =============================================================================
// 사용자 메시지에서 의도 파악
// =============================================================================

function detectIntent(message: string): {
  needsFormInfo: boolean;
  needsLandUse: boolean;
  needsBuildingInfo: boolean;
  formKeyword?: string;
  address?: string;
  targetBusiness?: string;
} {
  // 서식 관련 키워드
  const formKeywords = ["서식", "신청서", "신고서", "양식", "다운로드", "서류"];
  const needsFormInfo = formKeywords.some(k => message.includes(k)) ||
    Object.keys(COMMON_FORMS).some(k => message.includes(k));

  // 토지이용계획 관련 키워드
  const landKeywords = [
    "토지", "용도지역", "건축", "개발", "토지이용", "지번", "번지",
    "공장", "창고", "숙박", "음식점", "카페", "식당", "호텔", "모텔",
    "가능", "허용", "입지", "인허가", "등록", "허가", "신고",
    "제조업", "제조시설", "생산시설", "물류", "창업"
  ];

  // 다양한 주소 패턴 인식 (더 구체적인 패턴을 먼저 배치!)
  const addressPatterns = [
    // 1. 전체 주소: 시/도 + 시/군/구 + 로/길 + 번호 (번길 포함)
    /([가-힣]+(?:특별시|광역시|시|도)\s*[가-힣]+(?:시|군|구)\s*[가-힣0-9]+(?:로|길)\s*\d+번길\s*[\d-]+)/,
    /([가-힣]+(?:특별시|광역시|시|도)\s*[가-힣]+(?:시|군|구)\s*[가-힣0-9]+(?:로|길)\s*[\d-]+)/,
    // 2. 전체 주소: 시/도 + 시/군/구 + 읍/면/동 + 번지
    /([가-힣]+(?:특별시|광역시|시|도)\s*[가-힣]+(?:시|군|구)\s*[가-힣]+(?:읍|면|동|리|가)\s*[\d-]+(?:번지)?)/,
    // 3. 구/군 + 로/길 + 번길 (번길 패턴 먼저!): 계양구 오조산로 45번길 12
    /([가-힣]+(?:구|군)\s*[가-힣]+(?:로|길)\s*\d+번길\s*[\d-]+)/,
    // 4. 구/군 + 동/로/길 + 번호: 계양구 오조산로 123
    /([가-힣]+(?:구|군)\s*[가-힣0-9]+(?:동|로|길)\s*[\d-]+)/,
    // 5. 읍/면/동 + 번지
    /([가-힣]+(?:읍|면|동|리)\s*[\d-]+(?:번지)?)/,
    // 6. 로/길 + 번길: 오조산로 45번길 12
    /([가-힣]+(?:로|길)\s*\d+번길\s*[\d-]+)/,
    // 7. 로/길 + 번호: 세종대로 100
    /([가-힣]+(?:로|길)\s*[\d-]+(?:번지)?)/,
  ];

  let addressMatch: RegExpMatchArray | null = null;
  for (const pattern of addressPatterns) {
    addressMatch = message.match(pattern);
    if (addressMatch) break;
  }

  const hasLandKeyword = landKeywords.some(k => message.includes(k));
  // 주소가 감지되면 항상 토지이용계획 조회 (행정 AI 특성상 주소 제공 = 부동산 정보 필요)
  const needsLandUse = addressMatch !== null;

  // 건축물대장 조회가 필요한 키워드
  const buildingKeywords = [
    "허가", "가능", "용도변경", "건축물대장", "위반건축물", "사용승인",
    "층수", "용적률", "건폐율", "연면적", "건축면적",
    "숙박", "호텔", "모텔", "호스텔", "민박", "게스트하우스",
    "음식점", "카페", "식당", "공장", "창고", "사무실", "상가"
  ];
  const hasBuildingKeyword = buildingKeywords.some(k => message.includes(k));
  // 주소가 감지되면 항상 건축물대장 조회
  const needsBuildingInfo = addressMatch !== null;

  // 목표 업종 추출
  const businessTypes: Record<string, string[]> = {
    "숙박시설": ["숙박", "호텔", "모텔", "호스텔", "민박", "게스트하우스", "펜션", "리조트"],
    "음식점": ["음식점", "식당", "레스토랑", "카페", "커피숍", "베이커리"],
    "공장": ["공장", "제조시설", "제조업", "생산시설"],
    "창고": ["창고", "물류", "물류센터", "보관시설"],
    "판매시설": ["상가", "마트", "슈퍼", "편의점", "소매점"],
    "사무소": ["사무실", "오피스", "사무소"],
  };

  let targetBusiness: string | undefined;
  for (const [category, keywords] of Object.entries(businessTypes)) {
    if (keywords.some(k => message.includes(k))) {
      targetBusiness = category;
      break;
    }
  }

  console.log(`[Stream Intent] 메시지: "${message.substring(0, 50)}..."`);
  console.log(`[Stream Intent] 주소 감지: ${addressMatch ? addressMatch[1] : "없음"}, 토지키워드: ${hasLandKeyword}, 건물키워드: ${hasBuildingKeyword}`);
  console.log(`[Stream Intent] 조회필요 - 토지: ${needsLandUse}, 건물: ${needsBuildingInfo}, 목표업종: ${targetBusiness || "없음"}`);

  // 서식 키워드 추출
  let formKeyword: string | undefined;
  for (const key of Object.keys(COMMON_FORMS)) {
    if (message.includes(key)) {
      formKeyword = key;
      break;
    }
  }

  return {
    needsFormInfo,
    needsLandUse,
    needsBuildingInfo,
    formKeyword,
    address: addressMatch ? addressMatch[1] : undefined,
    targetBusiness,
  };
}

// =============================================================================
// 분야별 전문 프롬프트 (도메인 감지)
// =============================================================================

function detectDomainPrompt(message: string): string {
  const msg = message.toLowerCase();

  // 세무/회계
  if (/세금|세무|부가세|부가가치세|종합소득세|법인세|원천징수|세무사|세액공제|연말정산|4대보험|4대 보험|건강보험|국민연금|산재보험|고용보험/.test(msg)) {
    return `\n\n[전문 분야: 세무/경리]
- 세법 조항을 정확히 인용하세요 (소득세법, 법인세법, 부가가치세법 등).
- 세율, 공제한도, 신고기한을 구체적 숫자로 안내하세요.
- 국세청 홈택스(hometax.go.kr) 절차를 단계별로 안내하세요.
- 4대보험 요율(건강보험 3.545%, 국민연금 4.5%, 고용보험 0.9%, 산재보험 업종별)을 정확히 안내하세요.
- "절세 팁"이 아닌, 법적으로 허용된 공제/감면 항목을 안내하세요.`;
  }

  // 노무/인사
  if (/근로계약|해고|퇴직금|연차|휴가|노동법|근로기준법|최저임금|주휴수당|야근|연장근로|급여|임금|직원|채용|취업규칙/.test(msg)) {
    return `\n\n[전문 분야: 노무/인사]
- 근로기준법, 최저임금법 등 관련 법령 조항을 정확히 인용하세요.
- 최저임금(2024년 시급 9,860원), 주휴수당 계산법을 정확히 안내하세요.
- 퇴직금 산정: (1일 평균임금 × 30일) × (재직일수/365)
- 연차휴가 발생 기준 (1년 미만 월 1일, 1년 이상 15일 등)을 정확히 안내하세요.
- 부당해고/부당노동행위 관련 구제 절차 (노동위원회 등)를 안내하세요.
- 고용노동부(moel.go.kr) 관련 신고/신청 절차를 포함하세요.`;
  }

  // 건축/부동산
  if (/건축|건폐율|용적률|인허가|용도변경|건축허가|건축신고|사용승인|리모델링|증축|용도지역|건축물대장|토지이용|지목/.test(msg)) {
    return `\n\n[전문 분야: 건축/부동산]
- 건축법, 국토계획법, 주차장법 등 관련 법령을 정확히 인용하세요.
- 용도지역별 건폐율/용적률 기준을 구체적으로 안내하세요.
- 건축허가/건축신고 구분 기준 (연면적 200㎡ 등)을 정확히 안내하세요.
- 세움터(cloud.eais.go.kr)에서의 신청 절차를 안내하세요.
- 주소 기반 토지이용계획/건축물대장 데이터가 제공된 경우 해당 데이터를 근거로 분석하세요.`;
  }

  // 비자/출입국
  if (/비자|체류|출입국|외국인|이민|영주|귀화|topik|사증|체류자격|방문취업|결혼이민/.test(msg)) {
    return `\n\n[전문 분야: 비자/출입국]
- 출입국관리법, 시행규칙 별표 기준을 정확히 인용하세요.
- 비자 유형별 체류기간, 연장 조건, 자격변경 가능 여부를 안내하세요.
- 하이코리아(hikorea.go.kr) 온라인 신청 절차를 안내하세요.
- 수수료(단수비자 6만원, 복수비자 9만원 등)를 정확히 안내하세요.
- 사회통합프로그램(KIIP), TOPIK 관련 정보를 포함하세요.`;
  }

  // 법무/법인
  if (/법인설립|법인등기|주주총회|이사회|정관|상법|등기부등본|법인인감|법인 변경|대표이사|감사|이사/.test(msg)) {
    return `\n\n[전문 분야: 법무/법인]
- 상법, 민법 관련 조항을 정확히 인용하세요.
- 법인 등기 절차 (설립/변경/해산)를 단계별로 안내하세요.
- 인터넷등기소(iros.go.kr) 신청 절차를 안내하세요.
- 등록면허세, 등기수수료 등 비용을 정확히 안내하세요.
- 정관 변경, 이사/감사 선임 등 절차적 요건을 안내하세요.`;
  }

  // 사업자등록/창업
  if (/사업자등록|사업자|개인사업자|간이과세|일반과세|창업|폐업|업종변경|업태|종목|통신판매/.test(msg)) {
    return `\n\n[전문 분야: 사업자등록/창업]
- 사업자등록 신청 절차 (홈택스/세무서)를 단계별로 안내하세요.
- 일반과세/간이과세 기준 (연매출 8천만원)을 정확히 안내하세요.
- 업종별 필요 허가/등록/신고 사항을 안내하세요.
- 통신판매업 신고, 영업신고 등 부가 절차를 포함하세요.`;
  }

  // 보조금/정책자금
  if (/보조금|정책자금|지원금|정부지원|중소기업|벤처|스타트업|R&D|연구개발|수출바우처/.test(msg)) {
    return `\n\n[전문 분야: 보조금/정책자금]
- 기업마당(bizinfo.go.kr)의 최신 공모 정보를 참고하세요.
- 지원 금액, 자부담 비율, 신청 자격을 구체적으로 안내하세요.
- 중소기업진흥공단, KOTRA, 기술보증기금 등 주관기관을 안내하세요.
- 사업자의 업력, 규모, 업종에 따른 적격 여부를 판단해주세요.`;
  }

  return ''; // 특정 분야 미감지
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages, fileContext } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 마지막 사용자 메시지에서 의도 파악
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const userId = session.user.id as string;

    // =========================================================================
    // Fast Path: 단순 인사/잡담 → 지식검색 전부 스킵, 토큰 차감 없이 스트리밍
    // =========================================================================
    if (isSimpleGreeting(lastUserMessage)) {
      console.log(`[Chat Stream] 인사 감지 → Fast Path: "${lastUserMessage}"`);
      let basePrompt: string;
      try {
        basePrompt = await getActiveSystemPrompt();
      } catch {
        basePrompt = "당신은 대한민국 행정업무 전문 AI 어시스턴트입니다.";
      }
      const greetingPrompt = basePrompt + `\n\n[중요] 사용자가 인사를 했습니다. 친절하게 인사로 답하고, "무엇을 도와드릴까요?" 정도로 안내하세요. 절대로 특정 행정 주제(농지, 비자, 세무 등)를 먼저 꺼내지 마세요.`;

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = chatWithKnowledgeStream(messages, greetingPrompt, [], 'free', false);
            for await (const chunk of generator) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            console.error("[Chat Stream] 인사 스트리밍 오류:", error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "오류가 발생했습니다." })}\n\n`));
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
      });
    }

    // =========================================================================
    // 토큰 체크: 실질적 질문은 ai_chat 비용 차감 (1,000토큰)
    // =========================================================================
    const access = await checkFeatureAccess(userId, "ai_chat");
    if (!access.allowed) {
      return new Response(
        JSON.stringify({ error: "플랜 업그레이드가 필요합니다.", requiredPlan: access.requiredPlan }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const deducted = await deductTokens(userId, "ai_chat");
    if (!deducted) {
      return new Response(
        JSON.stringify({ error: "토큰이 부족합니다.", required: 1000, redirect: "/token-charge" }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // 멀티 AI 라우팅: 질문 복잡도 분석 → 최적 모델 자동 선택
    // =========================================================================
    const planCode = await getUserPlanCode(userId);
    const queryRoute = applyPlanOverride(routeQuery(lastUserMessage), planCode);
    const userTier = resolveUserTier(planCode, queryRoute);
    const enableSearchGrounding = queryRoute.target === 'flash_grounding';
    console.log(`[Chat Stream] 라우팅: ${queryRoute.target} (${queryRoute.reason}) → tier=${userTier}, plan=${planCode}`);

    const intent = detectIntent(lastUserMessage);

    // Multi-turn context: 마지막 메시지만으로 주소/키워드가 부족할 때 최근 3개 메시지 종합 분석
    if (!intent.address || (!intent.needsLandUse && !intent.needsBuildingInfo)) {
      const recentUserMsgs = messages
        .filter((m: any) => m.role === 'user')
        .slice(-3)
        .map((m: any) => m.content)
        .join(' ');
      const multiTurnIntent = detectIntent(recentUserMsgs);

      if (!intent.address && multiTurnIntent.address) {
        intent.address = multiTurnIntent.address;
        console.log(`[Chat Stream] Multi-turn: 이전 메시지에서 주소 보완 → ${intent.address}`);
      }
      if (intent.address) {
        if (!intent.needsLandUse && multiTurnIntent.needsLandUse) {
          intent.needsLandUse = true;
          console.log(`[Chat Stream] Multi-turn: 토지이용계획 조회 활성화`);
        }
        if (!intent.needsBuildingInfo && multiTurnIntent.needsBuildingInfo) {
          intent.needsBuildingInfo = true;
          console.log(`[Chat Stream] Multi-turn: 건축물대장 조회 활성화`);
        }
      }
      if (!intent.targetBusiness && multiTurnIntent.targetBusiness) {
        intent.targetBusiness = multiTurnIntent.targetBusiness;
        console.log(`[Chat Stream] Multi-turn: 목표업종 보완 → ${intent.targetBusiness}`);
      }
    }

    // =========================================================================
    // [최적화] 모든 외부 API 호출을 병렬 실행 (순차→병렬)
    // 기존: 순차 실행 ~15-30초 → 최적화 후: 병렬 실행 ~3-5초
    // =========================================================================
    const contextParts: string[] = [];
    let knowledgeFiles: FileDataPart[] = [];

    // 동기 작업 (즉시 실행, 네트워크 불필요)
    const businessTypesResult = searchBusinessTypes(lastUserMessage);
    const searchKeywords = extractSearchKeywords(lastUserMessage);
    const intentClass = quickClassify(lastUserMessage);
    const needsLegalSearch = intentClass.procedureScore >= 2 || intentClass.disputeScore >= 2;
    console.log(`[Chat Stream] 의도분류: 절차=${intentClass.procedureScore}, 분쟁=${intentClass.disputeScore}`);
    console.log(`[Chat Stream] 검색 키워드: [${searchKeywords.join(", ")}]`);

    // 서식 정보 (동기, 로컬 DB)
    if (intent.needsFormInfo && intent.formKeyword) {
      const form = searchForm(intent.formKeyword);
      if (form) contextParts.push(`\n\n[관련 서식 정보]\n${formatFormInfo(form)}`);
    }

    // 업종 정보 (동기, 로컬)
    if (businessTypesResult.length > 0) {
      let bizCtx = `\n\n[관련 업종 정보 - 반드시 아래 링크를 답변에 포함할 것]\n`;
      for (const bt of businessTypesResult.slice(0, 2)) {
        bizCtx += `\n### ${bt.name} (${bt.category})\n`;
        bizCtx += `📋 **신청 서식**: [${bt.formName}](${bt.formUrl})\n`;
        bizCtx += `📚 **관계법령**: [${bt.category} 서식 페이지](${bt.lawPage})\n`;
        if (bt.gov24Url) {
          bizCtx += `\n📱 **정부24 온라인 신청**\n- 서비스명: ${bt.gov24ServiceName}\n- 바로가기: [정부24 신청 바로가기](${bt.gov24Url})\n`;
          if (bt.applicationSteps) bizCtx += `\n📝 **신청 절차**\n${bt.applicationSteps.join('\n')}\n`;
          if (bt.gov24InputFields) bizCtx += `\n📋 **입력 항목**: ${bt.gov24InputFields.join(', ')}\n`;
          if (bt.gov24UploadDocs) { bizCtx += `\n📎 **첨부 서류 및 준비 방법**\n`; for (const doc of bt.gov24UploadDocs) bizCtx += `- ${doc}\n`; }
        }
      }
      bizCtx += `\n⚠️ 위 링크를 마크다운 형식으로 답변에 반드시 포함하세요.\n`;
      contextParts.push(bizCtx);
    }

    // =========================================================================
    // [병렬 실행] 모든 네트워크 호출을 동시에 시작 (타임아웃 3초 통일)
    // =========================================================================
    const PARALLEL_TIMEOUT = 3000; // 개별 타임아웃 3초

    const parallelTasks = await Promise.all([
      // Task 1: 마스터 프로필 (DB)
      withTimeout(
        prisma.companyProfile.findUnique({ where: { userId: session.user.id as string } }).catch(() => null),
        PARALLEL_TIMEOUT, null
      ),

      // Task 2: RAG 법령 검색 (필요한 경우만)
      needsLegalSearch
        ? withTimeout(
            searchLegalInfo(lastUserMessage).catch(() => null),
            PARALLEL_TIMEOUT, null
          )
        : Promise.resolve(null),

      // Task 3: Knowledge Base 태그 검색
      searchKeywords.length > 0
        ? withTimeout(
            getKnowledgeByTags(searchKeywords, 5).catch(() => ({ fileParts: [], documentTitles: [], documentTags: [], matchScores: [] })),
            PARALLEL_TIMEOUT,
            { fileParts: [], documentTitles: [], documentTags: [], matchScores: [] }
          )
        : Promise.resolve({ fileParts: [] as FileDataPart[], documentTitles: [] as string[], documentTags: [] as string[][], matchScores: [] as number[] }),

      // Task 4: 토지이용계획 (주소 감지 시만)
      intent.address && intent.needsLandUse
        ? withTimeout(
            searchLandUse(intent.address).catch(e => ({ success: false, error: `조회 오류: ${e.message}` })),
            PARALLEL_TIMEOUT,
            { success: false, error: "토지이용계획 조회 타임아웃" }
          )
        : Promise.resolve(null),

      // Task 5: 건축물대장 (주소 감지 시만)
      intent.address && intent.needsBuildingInfo
        ? withTimeout(
            searchBuilding(intent.address).catch(e => ({ success: false, error: `조회 오류: ${e.message}` })),
            PARALLEL_TIMEOUT,
            { success: false, error: "건축물대장 조회 타임아웃" }
          )
        : Promise.resolve(null),

      // Task 6: 시스템 프롬프트 (DB)
      withTimeout(
        getActiveSystemPrompt().catch(() => "당신은 대한민국 행정업무 전문 AI 어시스턴트입니다. 행정사, 정부기관, 기업의 행정업무를 지원합니다."),
        PARALLEL_TIMEOUT,
        "당신은 대한민국 행정업무 전문 AI 어시스턴트입니다. 행정사, 정부기관, 기업의 행정업무를 지원합니다."
      ),

      // Task 7: HWPX 템플릿 목록 (DB) - LLM-Driven Document Selection용
      withTimeout(
        prisma.formTemplate.findMany({
          where: { status: 'active', originalFileType: 'hwpx' },
          select: { code: true, name: true, description: true, category: true, fields: true },
          orderBy: { name: 'asc' },
        }).catch(() => []),
        PARALLEL_TIMEOUT,
        []
      ),
    ]);

    const [companyProfile, legalResult, kbTagResult, landResult, buildingResult, loadedPrompt, hwpxTemplates] = parallelTasks;
    const pEnd = Date.now();
    console.log(`[Chat Stream] 병렬 조회 완료 (총 소요시간은 가장 느린 태스크 기준)`);

    // --- 결과 조립: 마스터 프로필 ---
    if (companyProfile) {
      const p = companyProfile as any;
      const profileLines: string[] = [];
      if (p.companyName) profileLines.push(`- 상호: ${p.companyName}`);
      if (p.ownerName) profileLines.push(`- 대표자: ${p.ownerName}`);
      if (p.bizRegNo) { const b = p.bizRegNo; profileLines.push(`- 사업자등록번호: ${b.length === 10 ? `${b.slice(0,3)}-${b.slice(3,5)}-${b.slice(5)}` : b}`); }
      if (p.corpRegNo) { const c = p.corpRegNo; profileLines.push(`- 법인등록번호: ${c.length === 13 ? `${c.slice(0,6)}-${c.slice(6)}` : c}`); }
      if (p.address) profileLines.push(`- 주소: ${p.address}`);
      if (p.bizType) profileLines.push(`- 업태/종목: ${p.bizType}`);
      if (p.foundedDate) profileLines.push(`- 설립일: ${new Date(p.foundedDate).toISOString().split('T')[0]}`);
      if (p.employeeCount > 0) profileLines.push(`- 직원 수: ${p.employeeCount}명`);
      if (p.capital > 0) { const cap = Number(p.capital); profileLines.push(`- 자본금: ${cap >= 100000000 ? `${(cap / 100000000).toFixed(1)}억원` : `${Math.round(cap / 10000).toLocaleString()}만원`}`); }
      if (profileLines.length > 0) {
        contextParts.push(`\n\n[사용자 기업 정보 (마스터 프로필)]\n${profileLines.join('\n')}\n⚠️ 위 정보는 사용자가 사전에 등록한 기업 정보입니다.\n- 답변 시 이 정보를 자연스럽게 활용하세요.\n- 이미 등록된 정보를 다시 물어보지 마세요.\n- 서류 작성 시 위 정보를 자동으로 채워 넣으세요.`);
        console.log(`[Chat Stream] 마스터 프로필 로드: ${p.companyName || '(상호 미입력)'}`);
      }
    }

    // --- 결과 조립: RAG 법령 검색 ---
    if (legalResult && (legalResult as any).success) {
      contextParts.push(formatLegalResultForPrompt(legalResult as any));
      console.log("[Chat Stream] RAG 검색 완료");
    }

    // --- 결과 조립: Knowledge Base ---
    try {
      let bestDoc: { title: string; filePart: FileDataPart; score: number } | null = null;

      // 1차: 태그 매칭
      if (kbTagResult && kbTagResult.fileParts.length > 0 && kbTagResult.matchScores[0] >= KB_TAG_MATCH_THRESHOLD) {
        bestDoc = { title: kbTagResult.documentTitles[0], filePart: kbTagResult.fileParts[0], score: kbTagResult.matchScores[0] };
        console.log(`[Chat Stream] 태그 매칭 성공: ${bestDoc.title} (점수: ${bestDoc.score.toFixed(2)})`);
      }

      // 2차 Fallback: 키워드 제목 매칭 (태그 결과에 매칭 안 된 경우, 같은 데이터 재활용)
      if (!bestDoc && kbTagResult && kbTagResult.fileParts.length > 0 && searchKeywords.length > 0) {
        const scored = kbTagResult.documentTitles.map((title: string, idx: number) => {
          const titleLower = title.toLowerCase();
          const docTags = kbTagResult.documentTags[idx] || [];
          let matchCount = 0;
          for (const kw of searchKeywords) {
            const kwLower = kw.toLowerCase();
            if (titleLower.includes(kwLower)) matchCount++;
            if (docTags.some((tag: string) => tag.toLowerCase().includes(kwLower) || kwLower.includes(tag.toLowerCase()))) matchCount++;
          }
          return { title, filePart: kbTagResult.fileParts[idx], score: searchKeywords.length > 0 ? matchCount / (searchKeywords.length * 2) : 0 };
        });
        scored.sort((a: any, b: any) => b.score - a.score);
        if (scored.length > 0 && scored[0].score >= KB_TAG_MATCH_THRESHOLD) {
          bestDoc = scored[0];
          console.log(`[Chat Stream] Fallback 매칭: ${bestDoc.title} (점수: ${bestDoc.score.toFixed(2)})`);
        }
      }

      if (bestDoc) {
        knowledgeFiles = [bestDoc.filePart];
        console.log(`[Chat Stream] Knowledge Base 연동: ${bestDoc.title} (점수: ${bestDoc.score.toFixed(2)})`);

        if (bestDoc.score >= KB_CONFIDENT_CITATION_THRESHOLD) {
          // 0.7 이상: 확실한 문서 → 적극 인용 + 출처 표기
          contextParts.push(`\n\n[Knowledge Base 문서 참고]\n📚 첨부된 문서: ${bestDoc.title}\n- 이 문서는 질문과 관련성이 높습니다. 문서 내용을 적극적으로 인용하여 답변하세요.\n- 인용 시 "[출처: ${bestDoc.title}]" 형식으로 출처를 명시하세요.\n- 문서에 없는 내용은 전문 지식과 Google 검색을 활용하세요.`);
        } else {
          // 0.6~0.7: 참고 수준 → 인용하되 출처는 표기하지 않음
          contextParts.push(`\n\n[참고 문서 (낮은 관련성)]\n첨부된 문서 "${bestDoc.title}"은 참고용입니다.\n⚠️ 이 문서의 주제가 사용자 질문과 직접 관련이 없다면, 이 문서를 무시하고 일반적인 지식으로 답변하세요.\n⚠️ 관련 없는 문서를 억지로 연결하거나 [출처: ...] 태그를 붙이지 마세요.`);
        }
      } else {
        console.log("[Chat Stream] Knowledge Base: 관련 문서 없음 (유사도 미달)");
      }
    } catch (kbErr) {
      console.warn("[Chat Stream] KB 결과 처리 오류:", kbErr);
    }

    // --- 결과 조립: 부동산 정보 ---
    if (landResult) {
      if ((landResult as any).success) {
        contextParts.push(`\n\n${formatLandUseResult(landResult)}`);
        console.log("[Chat Stream] 토지이용계획 조회 완료");
      } else {
        contextParts.push(`\n\n[토지이용계획 조회]\n⚠️ ${(landResult as any).error || "조회 실패"}\n토지이음(eum.go.kr)에서 직접 확인해주세요.`);
      }
    }
    if (buildingResult) {
      if ((buildingResult as any).success) {
        contextParts.push(`\n\n${formatBuildingResult(buildingResult)}`);
        console.log("[Chat Stream] 건축물대장 조회 완료");
      } else {
        contextParts.push(`\n\n[건축물대장 조회]\n⚠️ ${(buildingResult as any).error || "조회 실패"}\n세움터(cloud.eais.go.kr)에서 직접 확인해주세요.`);
      }
    }

    // --- 시스템 프롬프트 조합 ---
    const additionalContext = contextParts.join('');
    let baseSystemPrompt: string = loadedPrompt as string;

    // Phase 11: Anti-Hallucination + 정확도 향상 + 분야별 전문성
    const antiHallucinationInstruction = `

[중요 지침: 환각 방지 및 정확도]
- 사용자의 질문과 검색된 문서(Context)의 주제가 일치하지 않는다면, Context를 무시하고 일반적인 지식으로 답변하세요.
- 절대 관련 없는 문서를 억지로 연결하거나 출처로 표기하지 마세요.
- 첨부된 Knowledge Base 문서가 질문 주제와 무관하면, 해당 문서를 언급하지 마세요.
- 확실하지 않은 정보는 "정확한 확인이 필요합니다"라고 안내하세요.

[답변 품질 지침]
- 답변이 길어지더라도 끝까지 완성하세요. 절대 중간에 자르거나 "..."으로 생략하지 마세요.
- 법령 조항 인용 시 정확한 조문 번호를 명시하세요 (예: 건축법 제11조 제1항).
- 행정 절차 안내 시 단계별로 번호를 매겨 체계적으로 답변하세요.
- 필요한 서류, 수수료, 처리기한을 구체적으로 안내하세요.
- 관련 정부 사이트 URL이 있으면 포함하세요.
- 금액은 원 단위로 정확히, 기간은 "영업일/일" 구분하여 안내하세요.

# ▼▼▼ [어드미니 플랫폼 기능 안내 - 적극 활용!] ▼▼▼

[핵심 원칙] 사용자가 관련 질문을 하면, 어드미니 플랫폼에서 직접 할 수 있는 기능을 적극적으로 안내하세요.
"어드미니에서 바로 하실 수 있습니다" 또는 "좌측 메뉴에서 이용 가능합니다"로 안내하세요.

[어드미니 플랫폼 기능 목록]

📋 **서류AI**
- 서류 작성: 각종 행정 서류(진정서, 탄원서, 이의신청서, 각종 신청서, 계약서 등) AI 자동 생성
- 서류 검토/분석: 첨부한 서류의 법적 문제점 분석, 누락 항목 점검
- 계약서 AI 분석: 계약서 위험 조항 탐지, 종합 점수 산출
- 내용증명 작성: 내용증명서 AI 자동 생성 및 가이드
- 회의록/녹취록 AI: 음성 녹취 → 회의록 자동 변환, 요약, 할일 추출
- 인허가 신청서: 이 채팅에서 "OO 신청서 작성해줘"라고 요청하면 AI가 직접 작성해 드립니다

📊 **조달/입찰**
- 나라장터 입찰 분석: 공고 검색, 경쟁사 분석, 입찰가 추천
- 입찰 시뮬레이터: 예비가격 분석, 사정률 분포, 투찰금액 계산, 몬테카를로 시뮬레이션
- 직접생산확인 자가진단: 물품 직접생산확인 적격 여부 사전 진단

💼 **노동행정AI**
- 4대보험 계산기: 국민연금, 건강보험, 고용보험, 산재보험 + 소득세 계산 (2026년 요율)
- 급여명세서: 직원 관리 + 급여명세서 자동 생성 + PDF 인쇄
- 퇴직금 계산기: 평균임금/통상임금 기준, 퇴직소득세 자동 계산
- 연차 계산기: 근로기준법 제60조 기준, 연도별 타임라인
- 주휴수당 계산기: 자격 판정, 월 환산, 실질시급 계산
- 근로계약서 AI: 정규직/계약직/파트타임별 근로계약서 자동 생성
- 4대보험 신고서: 취득/상실/보수월액변경 신고서 자동작성

🚗 **자동차행정**
- 이전등록 대행 접수: 차량 명의이전 행정사 대행 신청 (070-8657-1888)
- 양도증명서/위임장/매매계약서 등 이전등록 서류 자동 생성
- 취등록세 자동 계산기: 차종, 금액, 지역별 정확한 세금 계산
- 운행일지: 법인차량 운행기록 관리

🏢 **기업지원**
- 정부지원금/정책자금 매칭: 기업 프로필 기반 맞춤 보조금 추천
- 인증진단: 벤처기업, 이노비즈, 메인비즈, ISO 등 인증 적격 자가진단
- 뿌리기업 확인: 뿌리산업 해당 여부 판정
- 연구소/연구개발전담부서 설립: 적격 요건 진단
- 연구노트 작성: KOITA 표준 양식 자동 생성

🏗️ **건축행정AI**
- 인허가 자가진단: 토지이용계획 + 건축물대장 데이터로 사업 가능 여부 분석
- 토지이용계획 조회: 주소 입력 시 자동 조회

📄 **저작권/IP**
- 저작권 등록: 10가지 저작물 유형 (어문, 음악, 미술, 건축, 사진, 영상, 도형, SW, 2차적, 편집) 등록 가이드 및 신청서 작성 안내

🌍 **비자/출입국**
- 비자 점수 계산기: E-7, F-2, F-5 등 비자별 점수 자동 계산

📜 **거래처 관리 (Pro Plus)**
- 거래처별 기업 프로필 관리 (최대 50개)
- 거래처별 서류함, 대시보드
- 거래처 기준 보조금 매칭/인증 진단

[기능 안내 원칙]
1. 사용자가 "급여 계산", "4대보험" 관련 질문 → 노동행정AI 메뉴 안내
2. 사용자가 "퇴직금", "연차" 질문 → 해당 계산기 안내
3. 사용자가 "계약서 작성" 질문 → 서류AI 메뉴 안내 + 이 채팅에서 직접 작성도 가능 안내
4. 사용자가 "신청서", "인허가 신청서" 질문 → 이 채팅에서 AI가 직접 작성 가능 안내
5. 사용자가 "입찰", "나라장터" 질문 → 조달 분석 메뉴 안내
6. 사용자가 "보조금", "정책자금" 질문 → 정부지원금 매칭 메뉴 안내
7. 사용자가 "차량 이전", "명의변경" 질문 → 이전등록 대행 접수 안내 + 070-8657-1888
8. 사용자가 "저작권 등록" 질문 → 저작권/IP 메뉴 안내
9. 사용자가 "뭘 할 수 있어?", "기능 소개" 질문 → 위 전체 기능 목록 요약 안내

[답변 마무리: 후속 질문 제안 - 반드시!]
- 모든 답변의 끝에 반드시 "---" 구분선 후 "**관련 질문**" 섹션을 추가하세요. 이것은 필수입니다.
- 사용자가 이어서 물어볼 만한 관련 질문 2~3개를 제안하세요.
- 가능하면 어드미니 플랫폼 기능과 연결되는 질문을 포함하세요.
- 형식: "- 질문 내용" (마크다운 리스트)
- 예시:
  ---
  **관련 질문**
  - 필요 서류를 준비하는 방법이 궁금합니다
  - 온라인으로 신청할 수 있나요?
  - 어드미니에서 신청서를 바로 작성할 수 있나요?

[인허가 신청서 작성 기능 - 중요!]
- 사용자가 "OO 신청서 작성해줘", "영업허가 신청서", "인허가 신청서" 등을 요청하면:
  1. 해당 인허가의 관련 법령과 절차를 먼저 안내하세요
  2. 필요한 정보(상호명, 대표자, 소재지 등)를 질문하세요
  3. 정보가 충분하면 신청서를 마크다운 형식으로 작성해 드리세요
  4. HWPX 서식이 있으면 [[DOCUMENT:code]] 마커로 서류작성 폼도 제공하세요
- 작성 가능한 신청서 예시: 영업신고서, 사업자등록신청서, 각종 인허가 신청서, 변경신고서, 폐업신고서 등

[인허가 자가진단]
- 사용자가 특정 사업에 대한 인허가 관련 질문을 하면, 해당 업종의 인허가 요건을 상세히 분석하세요.
- 주소가 제공된 경우 토지이용계획 + 건축물대장 데이터를 종합 분석하여 인허가 가능 여부를 판단하세요.
- 사용자가 "인허가 진단 보고서", "자가진단 보고서"를 요청하면, 아래 형식으로 체계적인 보고서를 작성하세요:
  1. 사업 개요 (업종, 위치)
  2. 관련 법령 (근거법, 조항)
  3. 인허가 요건 분석 (용도지역, 건축물 용도, 면적 기준 등)
  4. 필요 서류 목록
  5. 예상 소요기간 및 수수료
  6. 종합 판단 (가능/불가/조건부 가능)
  7. 주의사항 및 추가 확인사항`;

    // 분야별 전문 프롬프트 (도메인 감지 → 특화 지침 주입)
    const domainPrompt = detectDomainPrompt(lastUserMessage);

    // Phase 11 Refactor: LLM-Driven Document Selection
    // DB의 HWPX 템플릿 목록을 Gemini에게 주입하여 AI가 직접 적합한 서식을 선택
    let documentSelectionInstruction = '';
    const templateList = hwpxTemplates as any[];
    if (templateList && templateList.length > 0) {
      const templateLines = templateList.map((t: any) => {
        const fields = JSON.parse(t.fields || '[]');
        const fieldNames = fields.map((f: any) => f.name || f.label).join(', ');
        return `- code: "${t.code}" | name: "${t.name}" | category: ${t.category || '일반'} | desc: ${t.description || '-'} | fields: [${fieldNames}]`;
      }).join('\n');

      documentSelectionInstruction = `

[서류 자동 작성 기능 - Available Documents]
아래는 시스템에 등록된 서식 템플릿 목록입니다:
${templateLines}

🔴 핵심 규칙:
1. 사용자의 대화 맥락을 파악하여, 위 목록 중 적합한 서식이 있다면 답변 마지막에 반드시 [[DOCUMENT:code]] 마커를 출력하세요.
2. 사용자가 먼저 "서류 작성해줘"라고 요청할 때까지 기다리지 마세요. 행정 절차 안내 시 관련 서식이 있으면 선제적으로 "서류를 작성해드릴까요?" 라고 제안하고 마커를 출력하세요.
3. 마커 형식: [[DOCUMENT:정확한_code값]] (예: [[DOCUMENT:hwpx_식품영업신고서]])
4. 이 마커가 출력되면 사용자 화면에 서류 작성 폼이 자동으로 나타납니다.
5. 목록에 없는 서식은 절대 마커를 만들어내지 마세요.

예시:
사용자: "식당 열 거야"
→ "일반음식점 영업신고가 필요합니다. [절차 안내...] 신고서를 바로 작성해드릴까요?\n\n[[DOCUMENT:hwpx_식품영업신고서]]"`;

      console.log(`[Chat Stream] HWPX 템플릿 ${templateList.length}개 프롬프트 주입`);
    }

    // Phase 15: 파일 첨부 + RPA 접수 대행 프롬프트
    let fileContextInstruction = '';
    if (fileContext && fileContext.path) {
      const rpaIntentKeywords = ["접수", "제출", "신청해", "신고해", "올려", "넣어"];
      const hasRpaIntent = rpaIntentKeywords.some(k => lastUserMessage.includes(k));

      if (hasRpaIntent) {
        fileContextInstruction = `

[파일 첨부 + 접수 요청]
사용자가 "${fileContext.name}" 파일 (${fileContext.type})을 첨부하고 접수를 요청했습니다.
1. 먼저 "첨부하신 ${fileContext.name} 파일을 정부24에 접수하겠습니다." 라고 안내하세요.
2. 접수 전 주의사항 (도장 날인 확인 등)을 간단히 안내하세요.
3. 답변 마지막에 반드시 [[RPA_SUBMIT:${fileContext.path}]] 마커를 출력하세요.
4. 이 마커가 출력되면 사용자 화면에 자동 접수 버튼이 나타납니다.`;
        console.log(`[Chat Stream] 파일 첨부 + RPA 의도 감지: ${fileContext.name}`);
      } else {
        fileContextInstruction = `

[파일 첨부됨]
사용자가 "${fileContext.name}" 파일 (${fileContext.type})을 첨부했습니다.
- 파일 내용에 대한 질문이면 적절히 답변하세요.
- 사용자가 접수/제출/신청을 원한다면, "접수를 원하시면 '접수해줘'라고 말씀해주세요"라고 안내하세요.`;
        console.log(`[Chat Stream] 파일 첨부 (RPA 의도 없음): ${fileContext.name}`);
      }
    }

    const enhancedPrompt = baseSystemPrompt + antiHallucinationInstruction + domainPrompt + documentSelectionInstruction + fileContextInstruction + additionalContext;

    // 스트리밍 응답 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = chatWithKnowledgeStream(
            messages,
            enhancedPrompt,
            knowledgeFiles,
            userTier,
            enableSearchGrounding || needsLegalSearch // Grounding: 법령 검색 또는 최신정보 질문 시
          );

          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("[Chat Stream] 스트리밍 오류:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "스트리밍 오류가 발생했습니다." })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Chat Stream] Error:", error);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
