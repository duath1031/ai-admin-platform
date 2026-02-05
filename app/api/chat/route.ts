import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chatWithGemini, chatWithKnowledge, FileDataPart } from "@/lib/gemini";
import { getActiveSystemPrompt } from "@/lib/systemPromptService";
import prisma from "@/lib/prisma";
import { searchForm, formatFormInfo, COMMON_FORMS } from "@/lib/lawApi";
import { searchLandUse, formatLandUseResult } from "@/lib/landUseApi";
import { searchBuilding, formatBuildingResult } from "@/lib/buildingApi";
import { searchBusinessTypes } from "@/lib/formDatabase";
// RAG 시스템 (맥락 인식형 법령 검색)
import { searchLegalInfo, formatLegalResultForPrompt } from "@/lib/rag/lawService";
import { quickClassify } from "@/lib/rag/intentClassifier";
// Knowledge Base - 경량 버전 사용 (서버 전용 import 제거)
import { getKnowledgeContextFast, getKnowledgeByTags, getActiveKnowledgeDocuments } from "@/lib/ai/knowledgeQuery";
// 문서 생성 시스템
import { FORM_TEMPLATES, findTemplate } from "@/lib/document/templates";
import { GOV24_SERVICES } from "@/lib/document/gov24Links";

// Vercel 서버리스 함수 타임아웃 설정 (Pro: 최대 60초)
export const maxDuration = 30; // 30초 타임아웃
export const dynamic = 'force-dynamic';

// 외부 API 타임아웃 헬퍼 함수 (기능 유지하면서 안정성 확보)
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
  // 5글자 이하 + 행정 키워드 없으면 인사로 간주
  if (trimmed.length <= 5 && !/신고|신청|허가|등록|발급|조회|서류|양식|법|세무|사업|토지|건축/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * 사용자 메시지에서 검색 키워드 추출 (경량 - AI 호출 없음)
 * - 2글자 이상의 한국어 명사/키워드를 추출
 * - 조사, 어미, 일반 동사 등은 제거
 */
function extractSearchKeywords(message: string): string[] {
  // 불용어 (조사, 어미, 일반적 단어)
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

  // 한국어 조사/어미 패턴 (단어 끝에서 제거)
  const particleSuffixes = [
    "하려면", "에서는", "으로는", "에서의", "으로의",
    "에서", "에게", "한테", "으로", "부터", "까지", "에는",
    "이란", "이라", "이요", "인가", "인지",
    "가요", "나요", "는지", "인데", "이고",
    "은요", "는요", "이요",
    "가", "를", "을", "에", "의", "은", "는", "이", "와", "과",
    "도", "만", "로", "서", "야",
  ];

  // 조사 제거 함수
  function stripParticles(word: string): string {
    for (const suffix of particleSuffixes) {
      if (word.length > suffix.length + 1 && word.endsWith(suffix)) {
        return word.slice(0, -suffix.length);
      }
    }
    return word;
  }

  // 메시지를 형태소 단위로 분리 (간이 토크나이저)
  const tokens = message
    .replace(/[?!.,;:'"()[\]{}<>~`@#$%^&*+=|\\\/]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .map(t => t.toLowerCase());

  // 불용어 제거 + 조사 제거 후 유니크 키워드 반환
  const keywords = tokens
    .filter(t => !stopWords.has(t))
    .map(t => stripParticles(t))
    .filter(t => t.length >= 2);
  return [...new Set(keywords)];
}

// 문서 생성 가능한 템플릿 매칭
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

  // 서류 작성 의도를 나타내는 키워드 (더 넓은 범위)
  const writeIntentKeywords = [
    "작성", "만들", "서류", "신고서", "신청서", "준비", "어떻게",
    "필요", "양식", "서식", "제출", "신청", "신고", "하려", "하고싶", "할려고"
  ];

  for (const [templateKey, keywords] of Object.entries(templateKeywords)) {
    if (keywords.some(k => message.includes(k))) {
      // 서류 작성 의도가 있거나, 키워드가 직접 언급된 경우
      if (writeIntentKeywords.some(k => message.includes(k))) {
        return templateKey;
      }
      // 신고/신청/허가 등의 키워드와 함께 언급된 경우도 포함
      if (/신고|신청|허가|등록|영업/.test(message)) {
        return templateKey;
      }
    }
  }

  return undefined;
}

// 사용자 메시지에서 의도 파악
function detectIntent(message: string): {
  needsFormInfo: boolean;
  needsLandUse: boolean;
  needsBuildingInfo: boolean;  // 건축물대장 조회 필요 여부
  formKeyword?: string;
  address?: string;
  targetBusiness?: string;     // 목표 업종 (숙박, 음식점 등)
  documentTemplate?: string;   // 문서 생성 템플릿 키
} {
  const lowerMsg = message.toLowerCase();

  // 서식 관련 키워드
  const formKeywords = ["서식", "신청서", "신고서", "양식", "다운로드", "서류"];
  const needsFormInfo = formKeywords.some(k => message.includes(k)) ||
    Object.keys(COMMON_FORMS).some(k => message.includes(k));

  // 토지이용계획 관련 키워드 (공장, 창고, 숙박, 음식점 등 인허가 관련 키워드 추가)
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

  // 주소가 있으면 토지이용계획 조회 필요 (인허가 관련 질문일 가능성 높음)
  const hasLandKeyword = landKeywords.some(k => message.includes(k));
  // 주소가 감지되면 항상 토지이용계획 조회 (행정 AI 특성상 주소 제공 = 부동산 정보 필요)
  const needsLandUse = addressMatch !== null;

  // 건축물대장 조회가 필요한 키워드 (허가/용도변경 관련)
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

  // 디버그 로그
  console.log(`[Intent] 메시지: "${message.substring(0, 50)}..."`);
  console.log(`[Intent] 주소 감지: ${addressMatch ? addressMatch[1] : "없음"}, 토지키워드: ${hasLandKeyword}, 건물키워드: ${hasBuildingKeyword}`);
  console.log(`[Intent] 조회필요 - 토지: ${needsLandUse}, 건물: ${needsBuildingInfo}, 목표업종: ${targetBusiness || "없음"}`);

  // 서식 키워드 추출
  let formKeyword: string | undefined;
  for (const key of Object.keys(COMMON_FORMS)) {
    if (message.includes(key)) {
      formKeyword = key;
      break;
    }
  }

  // 문서 생성 템플릿 감지
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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, chatId } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // 마지막 사용자 메시지에서 의도 파악
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // =========================================================================
    // Fast Path: 단순 인사/잡담 → 지식검색 전부 스킵, 즉시 Gemini 호출
    // =========================================================================
    if (isSimpleGreeting(lastUserMessage)) {
      console.log(`[Chat] 인사 감지 → Fast Path: "${lastUserMessage}"`);
      let baseSystemPrompt: string;
      try {
        baseSystemPrompt = await getActiveSystemPrompt();
      } catch {
        baseSystemPrompt = "당신은 대한민국 행정업무 전문 AI 어시스턴트입니다.";
      }
      const greetingPrompt = baseSystemPrompt + `\n\n[중요] 사용자가 인사를 했습니다. 친절하게 인사로 답하고, "무엇을 도와드릴까요?" 정도로 안내하세요. 절대로 특정 행정 주제(농지, 비자, 세무 등)를 먼저 꺼내지 마세요.`;
      const assistantMessage = await chatWithGemini(messages, greetingPrompt, 'free', false);

      if (chatId && session.user.id) {
        await prisma.message.createMany({
          data: [
            { chatId, role: "user", content: lastUserMessage },
            { chatId, role: "assistant", content: assistantMessage },
          ],
        });
      }
      return NextResponse.json({ message: assistantMessage });
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
        console.log(`[Chat] Multi-turn: 이전 메시지에서 주소 보완 → ${intent.address}`);
      }
      if (intent.address) {
        if (!intent.needsLandUse && multiTurnIntent.needsLandUse) {
          intent.needsLandUse = true;
          console.log(`[Chat] Multi-turn: 토지이용계획 조회 활성화`);
        }
        if (!intent.needsBuildingInfo && multiTurnIntent.needsBuildingInfo) {
          intent.needsBuildingInfo = true;
          console.log(`[Chat] Multi-turn: 건축물대장 조회 활성화`);
        }
      }
      if (!intent.targetBusiness && multiTurnIntent.targetBusiness) {
        intent.targetBusiness = multiTurnIntent.targetBusiness;
        console.log(`[Chat] Multi-turn: 목표업종 보완 → ${intent.targetBusiness}`);
      }
    }

    // 추가 컨텍스트 정보 수집
    let additionalContext = "";

    // =========================================================================
    // 마스터 프로필 (기업 정보) 로드 — 서류 자동완성 및 맞춤 상담용
    // =========================================================================
    try {
      const companyProfile = await prisma.companyProfile.findUnique({
        where: { userId: session.user.id as string },
      });
      if (companyProfile) {
        const profileLines: string[] = [];
        if (companyProfile.companyName) profileLines.push(`- 상호: ${companyProfile.companyName}`);
        if (companyProfile.ownerName) profileLines.push(`- 대표자: ${companyProfile.ownerName}`);
        if (companyProfile.bizRegNo) {
          const b = companyProfile.bizRegNo;
          const formatted = b.length === 10 ? `${b.slice(0,3)}-${b.slice(3,5)}-${b.slice(5)}` : b;
          profileLines.push(`- 사업자등록번호: ${formatted}`);
        }
        if (companyProfile.corpRegNo) {
          const c = companyProfile.corpRegNo;
          const formatted = c.length === 13 ? `${c.slice(0,6)}-${c.slice(6)}` : c;
          profileLines.push(`- 법인등록번호: ${formatted}`);
        }
        if (companyProfile.address) profileLines.push(`- 주소: ${companyProfile.address}`);
        if (companyProfile.bizType) profileLines.push(`- 업태/종목: ${companyProfile.bizType}`);
        if (companyProfile.foundedDate) profileLines.push(`- 설립일: ${companyProfile.foundedDate.toISOString().split('T')[0]}`);
        if (companyProfile.employeeCount > 0) profileLines.push(`- 직원 수: ${companyProfile.employeeCount}명`);
        if (companyProfile.capital > 0) {
          const cap = Number(companyProfile.capital);
          const capStr = cap >= 100000000 ? `${(cap / 100000000).toFixed(1)}억원` : `${Math.round(cap / 10000).toLocaleString()}만원`;
          profileLines.push(`- 자본금: ${capStr}`);
        }

        if (profileLines.length > 0) {
          additionalContext += `\n\n[사용자 기업 정보 (마스터 프로필)]
${profileLines.join('\n')}
⚠️ 위 정보는 사용자가 사전에 등록한 기업 정보입니다.
- 답변 시 이 정보를 자연스럽게 활용하세요 (예: "대표님 회사 주소인 OO 기준으로 분석하면...").
- 이미 등록된 정보를 다시 물어보지 마세요.
- 서류 작성 시 위 정보를 자동으로 채워 넣으세요.`;
          console.log(`[Chat] 마스터 프로필 로드: ${companyProfile.companyName || '(상호 미입력)'}`);
        }
      }
    } catch (profileError) {
      console.warn("[Chat] 마스터 프로필 로드 오류 (무시하고 계속):", profileError);
    }

    // 서식 정보 추가
    if (intent.needsFormInfo && intent.formKeyword) {
      const form = searchForm(intent.formKeyword);
      if (form) {
        additionalContext += `\n\n[관련 서식 정보]\n${formatFormInfo(form)}`;
      }
    }

    // 업종 정보 검색
    const businessTypes = searchBusinessTypes(lastUserMessage);
    if (businessTypes.length > 0) {
      additionalContext += `\n\n[관련 업종 정보 - 반드시 아래 링크를 답변에 포함할 것]\n`;
      for (const bt of businessTypes.slice(0, 2)) {
        additionalContext += `\n### ${bt.name} (${bt.category})\n`;
        additionalContext += `📋 **신청 서식**: [${bt.formName}](${bt.formUrl})\n`;
        additionalContext += `📚 **관계법령**: [${bt.category} 서식 페이지](${bt.lawPage})\n`;

        // 정부24 신청 정보 추가
        if (bt.gov24Url) {
          additionalContext += `\n📱 **정부24 온라인 신청**\n`;
          additionalContext += `- 서비스명: ${bt.gov24ServiceName}\n`;
          additionalContext += `- 바로가기: [정부24 신청 바로가기](${bt.gov24Url})\n`;
          if (bt.applicationSteps) {
            additionalContext += `\n📝 **신청 절차**\n${bt.applicationSteps.join('\n')}\n`;
          }
          if (bt.gov24InputFields) {
            additionalContext += `\n📋 **입력 항목**: ${bt.gov24InputFields.join(', ')}\n`;
          }
          if (bt.gov24UploadDocs) {
            additionalContext += `\n📎 **첨부 서류 및 준비 방법**\n`;
            for (const doc of bt.gov24UploadDocs) {
              additionalContext += `- ${doc}\n`;
            }
          }
        }
      }
      additionalContext += `\n⚠️ 위 링크를 마크다운 형식으로 답변에 반드시 포함하세요.\n`;
    }

    // 맥락 인식형 법령 검색 (RAG) - 타임아웃 5초로 제한
    try {
      const intentClass = quickClassify(lastUserMessage);
      // 법령 관련 키워드가 있는 경우에만 검색 (점수 기반 판단)
      const needsLegalSearch = intentClass.procedureScore >= 2 || intentClass.disputeScore >= 2;
      console.log(`[Chat] 의도분류: 절차=${intentClass.procedureScore}, 분쟁=${intentClass.disputeScore}, 검색필요=${needsLegalSearch}`);
      if (needsLegalSearch) {
        console.log(`[Chat] RAG 법령 검색 시작...`);
        try {
          const legalResult = await withTimeout(
            searchLegalInfo(lastUserMessage),
            5000, // 5초 타임아웃
            { success: false, intent: { mode: intentClass.likelyMode, confidence: 0, keywords: [], reasoning: "타임아웃", searchScope: { statutes: false, regulations: false, localLaws: false, precedents: false, rulings: false, forms: false } }, statutes: [], precedents: [], rulings: [], forms: [], localLaws: [], error: "타임아웃", systemMessage: "법령 검색 타임아웃" }
          );
          if (legalResult.success) {
            additionalContext += formatLegalResultForPrompt(legalResult);
            console.log("[Chat] RAG 검색 완료");
          } else {
            console.log("[Chat] RAG 검색 실패/타임아웃:", legalResult.systemMessage || legalResult.error);
          }
        } catch (searchError) {
          console.warn("[Chat] RAG searchLegalInfo 오류:", searchError);
        }
      }
    } catch (ragError) {
      console.warn("[Chat] RAG 검색 오류 (무시하고 계속):", ragError);
    }

    // =========================================================================
    // Knowledge Base - Smart Tag 기반 검색 (Phase 2)
    // 하드코딩된 카테고리 감지 제거 → 태그 매칭으로 관련 문서 자동 선택
    // =========================================================================
    let knowledgeFiles: FileDataPart[] = [];

    try {
      // 사용자 메시지에서 검색 키워드 추출
      const searchKeywords = extractSearchKeywords(lastUserMessage);
      console.log(`[Chat] 검색 키워드: [${searchKeywords.join(", ")}]`);

      let bestDoc: { title: string; filePart: FileDataPart; score: number } | null = null;

      // 1차: 태그 기반 검색 (tags 필드가 채워진 문서 대상)
      if (searchKeywords.length > 0) {
        const tagResult = await withTimeout(
          getKnowledgeByTags(searchKeywords, 5),
          3000,
          { fileParts: [], documentTitles: [], documentTags: [], matchScores: [] }
        );

        if (tagResult.fileParts.length > 0 && tagResult.matchScores[0] >= KB_TAG_MATCH_THRESHOLD) {
          bestDoc = {
            title: tagResult.documentTitles[0],
            filePart: tagResult.fileParts[0],
            score: tagResult.matchScores[0],
          };
          console.log(`[Chat] 태그 매칭 성공: ${bestDoc.title} (점수: ${bestDoc.score.toFixed(2)})`);
        }
      }

      // 2차 Fallback: 태그 매칭 실패 시 전체 문서에서 제목+태그 기반 검색
      if (!bestDoc && searchKeywords.length > 0) {
        console.log("[Chat] KB fallback: 전체 문서에서 키워드 검색...");
        try {
          const allDocsResult = await withTimeout(
            getKnowledgeContextFast(undefined, 10),
            3000,
            { fileParts: [], documentTitles: [], documentTags: [] }
          );

          if (allDocsResult.fileParts.length > 0) {
            // 제목 + 태그 종합 매칭
            const scored = allDocsResult.documentTitles.map((title, idx) => {
              const titleLower = title.toLowerCase();
              const docTags = allDocsResult.documentTags[idx] || [];
              let matchCount = 0;

              for (const kw of searchKeywords) {
                const kwLower = kw.toLowerCase();
                if (titleLower.includes(kwLower)) matchCount++;
                if (docTags.some(tag => tag.toLowerCase().includes(kwLower) || kwLower.includes(tag.toLowerCase()))) matchCount++;
              }

              const score = searchKeywords.length > 0 ? matchCount / (searchKeywords.length * 2) : 0;
              return { title, filePart: allDocsResult.fileParts[idx], score };
            });

            scored.sort((a, b) => b.score - a.score);
            if (scored.length > 0 && scored[0].score >= KB_TAG_MATCH_THRESHOLD) {
              bestDoc = scored[0];
              console.log(`[Chat] Fallback 매칭: ${bestDoc.title} (점수: ${bestDoc.score.toFixed(2)})`);
            }
          }
        } catch (fallbackErr) {
          console.warn("[Chat] KB fallback 오류:", fallbackErr);
        }
      }

      // 3차 Fallback: fast 쿼리 모두 0건 → 만료 문서 자동 갱신 시도
      if (!bestDoc && searchKeywords.length > 0) {
        try {
          console.log("[Chat] KB 갱신 fallback: 만료 문서 자동 갱신 시도...");
          const renewedDocs = await withTimeout(
            getActiveKnowledgeDocuments(),
            8000,
            []
          );
          if (renewedDocs.length > 0) {
            // 갱신된 문서 중 키워드 매칭
            for (const doc of renewedDocs) {
              const titleLower = (doc.title || "").toLowerCase();
              const matchCount = searchKeywords.filter(kw =>
                titleLower.includes(kw.toLowerCase())
              ).length;
              const score = matchCount / searchKeywords.length;
              if (score > 0 && (!bestDoc || score > bestDoc.score)) {
                bestDoc = {
                  title: doc.title,
                  filePart: { fileData: { fileUri: doc.fileUri, mimeType: doc.mimeType } },
                  score,
                };
              }
            }
            // 매칭 없으면 문서 사용하지 않음 (엉뚱한 문서 방지)
            if (bestDoc) {
              console.log(`[Chat] 갱신 fallback 성공: ${bestDoc.title}`);
            } else {
              console.log("[Chat] 갱신 fallback: 키워드 매칭 문서 없음 - 문서 첨부 생략");
            }
          }
        } catch (renewErr) {
          console.warn("[Chat] KB 갱신 fallback 오류:", renewErr);
        }
      }

      if (bestDoc) {
        knowledgeFiles = [bestDoc.filePart];
        console.log(`[Chat] Knowledge Base 연동: ${bestDoc.title} (점수: ${bestDoc.score.toFixed(2)})`);
        additionalContext += `\n\n[Knowledge Base 문서 참고 - 최우선 인용 의무]
📚 첨부된 문서: ${bestDoc.title}

🔴 **절대 규칙: 검색된 문서 최우선 인용**
1. 이 문서의 내용이 질문과 관련이 있다면, 네가 사전에 학습한 지식보다 **반드시 이 문서(매뉴얼/법령/편람)의 내용을 최우선으로 인용**하여 답변하라.
2. 답변 본문에서 문서 내용을 직접 인용하고, 답변 끝에 반드시 **[근거: ${bestDoc.title}]** 형식으로 출처를 명시하라.
3. 문서에 없는 내용은 자체 전문 지식과 Google 검색으로 보완하되, 보완한 부분은 별도로 구분하라.
4. 문서 내용과 자체 지식이 충돌하면 문서 내용을 우선한다.
`;
      } else {
        console.log("[Chat] Knowledge Base: 관련 문서 없음 - 시스템 프롬프트만 사용");
      }
    } catch (error) {
      console.error("[Chat] Knowledge Base 오류 (무시하고 계속):", error);
    }

    // 문서 생성 템플릿 감지 시 AI에게 정보 제공
    if (intent.documentTemplate) {
      const template = FORM_TEMPLATES[intent.documentTemplate];
      const gov24Service = template?.gov24ServiceKey ? GOV24_SERVICES[template.gov24ServiceKey] : null;

      if (template) {
        console.log(`[Chat] 문서 생성 템플릿 감지: ${intent.documentTemplate}`);

        additionalContext += `\n\n[서류 자동 작성 기능 - 반드시 따르세요]
===================================================
사용자가 "${template.name}" 관련 질문을 했습니다.

🔴 중요: 답변 마지막에 반드시 아래 마커를 추가하세요:
[[DOCUMENT:${intent.documentTemplate}]]

이 마커를 추가하면 사용자 화면에 서류 작성 폼이 나타납니다.
마커가 없으면 사용자가 서류를 작성할 수 없습니다!

필수 입력 항목:
${template.fields.filter(f => f.required).map(f => `- ${f.label}`).join('\n')}

선택 입력 항목:
${template.fields.filter(f => !f.required).map(f => `- ${f.label}`).join('\n') || '없음'}
`;

        if (gov24Service) {
          additionalContext += `
정부24 신청 정보:
- 서비스명: ${gov24Service.name}
- 처리기간: ${gov24Service.processingDays}
- 수수료: ${gov24Service.fee}
- 필요서류: ${gov24Service.requiredDocs.join(', ') || '없음'}
`;
        }

        additionalContext += `
===================================================
📝 응답 형식 예시:
"${template.name} 신청을 도와드리겠습니다.
[신청 절차 및 필요 서류 안내...]
아래 폼에서 정보를 입력하시면 서류를 작성해드립니다.

[[DOCUMENT:${intent.documentTemplate}]]"
===================================================
`;
      }
    }

    // 토지이용계획 + 건축물대장 조회 - 타임아웃 5초로 제한 (병렬 처리)
    if (intent.address) {
      console.log(`[Chat] 부동산 정보 조회 시작: "${intent.address}", 토지=${intent.needsLandUse}, 건물=${intent.needsBuildingInfo}`);

      try {
        // 병렬로 조회하되, 각각 5초 타임아웃 적용
        const [landResult, buildingResult] = await Promise.all([
          // 토지이용계획 조회 (타임아웃 시 실패 결과 반환)
          intent.needsLandUse
            ? withTimeout(
                searchLandUse(intent.address).catch(e => ({ success: false, error: `조회 오류: ${e.message}` })),
                5000,
                { success: false, error: "토지이용계획 조회 타임아웃" }
              )
            : Promise.resolve(null),
          // 건축물대장 조회 (타임아웃 시 실패 결과 반환)
          intent.needsBuildingInfo
            ? withTimeout(
                searchBuilding(intent.address).catch(e => ({ success: false, error: `조회 오류: ${e.message}` })),
                5000,
                { success: false, error: "건축물대장 조회 타임아웃" }
              )
            : Promise.resolve(null),
        ]);

        // 토지이용계획 결과 추가
        if (landResult) {
          if (landResult.success) {
            additionalContext += `\n\n${formatLandUseResult(landResult)}`;
            console.log("[Chat] 토지이용계획 조회 완료");
          } else {
            console.log("[Chat] 토지이용계획 조회 실패:", landResult.error);
            additionalContext += `\n\n[토지이용계획 조회]\n⚠️ ${landResult.error || "조회 실패"}\n토지이음(eum.go.kr)에서 직접 확인해주세요.`;
          }
        }

        // 건축물대장 결과 추가
        if (buildingResult) {
          if (buildingResult.success) {
            additionalContext += `\n\n${formatBuildingResult(buildingResult)}`;
            console.log("[Chat] 건축물대장 조회 완료");
          } else {
            console.log("[Chat] 건축물대장 조회 실패:", buildingResult.error);
            additionalContext += `\n\n[건축물대장 조회]\n⚠️ ${buildingResult.error || "조회 실패"}\n세움터(cloud.eais.go.kr)에서 직접 확인해주세요.`;
          }
        }
      } catch (realEstateError) {
        console.warn("[Chat] 부동산 정보 조회 오류 (무시하고 계속):", realEstateError);
      }
    }

    // DB에서 시스템 프롬프트 가져오기 (실패 시 기본값 사용)
    let baseSystemPrompt: string;
    try {
      baseSystemPrompt = await getActiveSystemPrompt();
    } catch (promptError) {
      console.warn("[Chat] 시스템 프롬프트 로드 실패, 기본값 사용:", promptError);
      baseSystemPrompt = "당신은 대한민국 행정업무 전문 AI 어시스턴트입니다. 행정사, 정부기관, 기업의 행정업무를 지원합니다.";
    }

    // 시스템 프롬프트에 추가 컨텍스트 포함
    const enhancedPrompt = baseSystemPrompt + additionalContext;

    // Knowledge 파일이 있으면 Long Context 방식으로 호출
    // enableGrounding=true: Google Search Grounding 활성화 (MODE_DYNAMIC)
    let assistantMessage: string;
    if (knowledgeFiles.length > 0) {
      try {
        console.log(`[Chat] Gemini Long Context 호출 (${knowledgeFiles.length}개 문서, Grounding 활성화)`);
        assistantMessage = await chatWithKnowledge(messages, enhancedPrompt, knowledgeFiles, 'free', true);
      } catch (knowledgeError) {
        // 만료된 파일 등의 오류 시 일반 채팅으로 폴백
        console.error("[Chat] Knowledge 연동 Gemini 호출 실패, 일반 모드로 전환:", knowledgeError);
        assistantMessage = await chatWithGemini(messages, enhancedPrompt, 'free', true);
      }
    } else {
      assistantMessage = await chatWithGemini(messages, enhancedPrompt, 'free', true);
    }

    // Save to database if chatId is provided
    if (chatId && session.user.id) {
      const lastUserMessage = messages[messages.length - 1];

      await prisma.message.createMany({
        data: [
          {
            chatId,
            role: "user",
            content: lastUserMessage.content,
          },
          {
            chatId,
            role: "assistant",
            content: assistantMessage,
          },
        ],
      });
    }

    return NextResponse.json({ message: assistantMessage });
  } catch (error: unknown) {
    // 상세 에러 로깅
    console.error("=== Chat API Error ===");
    console.error("Error type:", typeof error);
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    console.error("=== End Error ===");

    if (error instanceof Error && error.message.includes("API key")) {
      return NextResponse.json(
        { error: "API 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 상세 에러 반환 (디버깅용)
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    const errorName = error instanceof Error ? error.name : "UnknownError";
    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
        errorType: errorName,
        details: errorMessage.substring(0, 200) // 보안을 위해 200자로 제한
      },
      { status: 500 }
    );
  }
}
