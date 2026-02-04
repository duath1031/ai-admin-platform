import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { chatWithKnowledgeStream, FileDataPart } from "@/lib/gemini";
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
// 문서 생성 시스템
import { FORM_TEMPLATES } from "@/lib/document/templates";
import { GOV24_SERVICES } from "@/lib/document/gov24Links";

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
// Knowledge Base 문서 관련성 필터 (Smart Tag 기반 - Phase 2)
// =============================================================================

const KB_TAG_MATCH_THRESHOLD = 0.15;

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
// 문서 생성 템플릿 매칭
// =============================================================================

function detectDocumentTemplate(message: string): string | undefined {
  const templateKeywords: Record<string, string[]> = {
    "통신판매업신고서": ["통신판매", "쇼핑몰", "인터넷판매", "온라인판매", "스마트스토어", "오픈마켓", "온라인 쇼핑몰", "이커머스"],
    "일반음식점영업신고서": ["일반음식점", "음식점", "식당", "레스토랑", "고깃집", "치킨집", "분식"],
    "휴게음식점영업신고서": ["휴게음식점", "카페", "커피숍", "제과점", "빵집", "베이커리", "디저트", "아이스크림"],
    "식품제조업영업신고서": ["식품제조", "식품가공", "제조업영업", "식품공장"],
    "건축물대장발급신청서": ["건축물대장", "건축물대장발급"],
    "사업자등록신청서": ["사업자등록", "창업", "개업"],
    "숙박업영업허가신청서": ["숙박업", "호텔", "모텔", "펜션", "게스트하우스", "민박", "숙박시설"],
    "학원설립운영등록신청서": ["학원", "학원설립", "교습소", "입시학원", "영어학원", "수학학원"],
    "미용업신고서": ["미용업", "미용실", "헤어샵", "네일샵", "피부관리", "미용사"],
    "옥외광고물표시허가신청서": ["옥외광고", "간판", "현수막", "옥상광고", "돌출간판", "광고물"],
  };

  const writeIntentKeywords = [
    "작성", "만들", "서류", "신고서", "신청서", "준비", "어떻게",
    "필요", "양식", "서식", "제출", "신청", "신고", "하려", "하고싶", "할려고"
  ];

  for (const [templateKey, keywords] of Object.entries(templateKeywords)) {
    if (keywords.some(k => message.includes(k))) {
      if (writeIntentKeywords.some(k => message.includes(k))) {
        return templateKey;
      }
      if (/신고|신청|허가|등록|영업/.test(message)) {
        return templateKey;
      }
    }
  }

  return undefined;
}

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
  documentTemplate?: string;
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

  const documentTemplate = detectDocumentTemplate(message);

  return {
    needsFormInfo,
    needsLandUse,
    needsBuildingInfo,
    formKeyword,
    address: addressMatch ? addressMatch[1] : undefined,
    targetBusiness,
    documentTemplate,
  };
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

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 마지막 사용자 메시지에서 의도 파악
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // =========================================================================
    // Fast Path: 단순 인사/잡담 → 지식검색 전부 스킵, 즉시 스트리밍
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

    // 문서 생성 템플릿 감지 (동기, 로컬)
    if (intent.documentTemplate) {
      const template = FORM_TEMPLATES[intent.documentTemplate];
      const gov24Service = template?.gov24ServiceKey ? GOV24_SERVICES[template.gov24ServiceKey] : null;
      if (template) {
        console.log(`[Chat Stream] 문서 생성 템플릿 감지: ${intent.documentTemplate}`);
        let docCtx = `\n\n[서류 자동 작성 기능 - 반드시 따르세요]\n===================================================\n사용자가 "${template.name}" 관련 질문을 했습니다.\n\n🔴 중요: 답변 마지막에 반드시 아래 마커를 추가하세요:\n[[DOCUMENT:${intent.documentTemplate}]]\n\n이 마커를 추가하면 사용자 화면에 서류 작성 폼이 나타납니다.\n마커가 없으면 사용자가 서류를 작성할 수 없습니다!\n\n필수 입력 항목:\n${template.fields.filter(f => f.required).map(f => `- ${f.label}`).join('\n')}\n\n선택 입력 항목:\n${template.fields.filter(f => !f.required).map(f => `- ${f.label}`).join('\n') || '없음'}\n`;
        if (gov24Service) docCtx += `\n정부24 신청 정보:\n- 서비스명: ${gov24Service.name}\n- 처리기간: ${gov24Service.processingDays}\n- 수수료: ${gov24Service.fee}\n- 필요서류: ${gov24Service.requiredDocs.join(', ') || '없음'}\n`;
        docCtx += `\n===================================================\n📝 응답 형식 예시:\n"${template.name} 신청을 도와드리겠습니다.\n[신청 절차 및 필요 서류 안내...]\n아래 폼에서 정보를 입력하시면 서류를 작성해드립니다.\n\n[[DOCUMENT:${intent.documentTemplate}]]"\n===================================================\n`;
        contextParts.push(docCtx);
      }
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
    ]);

    const [companyProfile, legalResult, kbTagResult, landResult, buildingResult, loadedPrompt] = parallelTasks;
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
        contextParts.push(`\n\n[Knowledge Base 문서 참고]\n📚 첨부된 문서: ${bestDoc.title}\n- 이 문서는 질문과 관련성이 높습니다. 문서 내용을 적극적으로 인용하여 답변하세요.\n- 인용 시 "[출처: ${bestDoc.title}]" 형식으로 출처를 명시하세요.\n- 문서에 없는 내용은 전문 지식과 Google 검색을 활용하세요.`);
      } else {
        console.log("[Chat Stream] Knowledge Base: 관련 문서 없음");
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
    const enhancedPrompt = baseSystemPrompt + additionalContext;

    // 스트리밍 응답 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = chatWithKnowledgeStream(
            messages,
            enhancedPrompt,
            knowledgeFiles,
            'free',
            true // Google Search Grounding 활성화 (하이브리드 모드)
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
