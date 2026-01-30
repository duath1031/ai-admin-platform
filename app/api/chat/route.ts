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
import { getKnowledgeContextFast } from "@/lib/ai/knowledgeQuery";
// 문서 생성 시스템
import { FORM_TEMPLATES, findTemplate } from "@/lib/document/templates";
import { GOV24_SERVICES } from "@/lib/document/gov24Links";

// Vercel 서버리스 함수 타임아웃 설정 (Pro: 최대 60초)
export const maxDuration = 30; // 30초 타임아웃

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
// Knowledge Base 문서 관련성 필터 (Agentic RAG)
// =============================================================================

const KB_RELEVANCE_THRESHOLD = 0.2;

/** 질문에서 주제 키워드 추출 */
function extractTopicKeywords(message: string): string[] {
  const topicMap: Record<string, string[]> = {
    "숙박": ["숙박", "호텔", "호스텔", "모텔", "펜션", "게스트하우스", "민박", "리조트", "관광숙박"],
    "비자": ["비자", "사증", "출입국", "체류", "외국인", "하이코리아", "영주권"],
    "음식점": ["음식점", "식당", "카페", "휴게음식", "일반음식", "위생", "식품"],
    "조달": ["공공조달", "조달", "입찰", "낙찰", "계약", "나라장터"],
    "건축": ["건축", "건물", "건축물대장", "용도변경", "건폐율", "용적률"],
    "토지": ["토지", "용도지역", "개발행위", "토지이용"],
    "사업자": ["사업자등록", "창업", "개업", "폐업"],
    "공장": ["공장", "제조업", "제조시설", "생산시설"],
    "학원": ["학원", "교습소", "학원설립"],
    "광고": ["옥외광고", "간판", "현수막", "광고물"],
    "미용": ["미용업", "미용실", "헤어샵", "네일샵"],
    "정책자금": ["정책자금", "중진공", "소진공", "융자", "지원금"],
    "법인": ["법인설립", "법인", "주식회사", "유한회사"],
    "허가": ["허가", "인허가", "신고", "등록", "면허"],
  };

  const found: string[] = [];
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(k => message.includes(k))) {
      found.push(topic);
      // 매칭된 키워드도 추가
      keywords.forEach(k => { if (message.includes(k)) found.push(k); });
    }
  }
  return [...new Set(found)];
}

/** 문서 제목 vs 질문 키워드 매칭으로 관련성 점수 (0~1) 반환 */
function scoreDocumentRelevance(docTitle: string, userMessage: string): number {
  const titleLower = docTitle.toLowerCase();
  const messageLower = userMessage.toLowerCase();
  const topicKeywords = extractTopicKeywords(messageLower);

  if (topicKeywords.length === 0) return 0;

  let matchCount = 0;
  for (const keyword of topicKeywords) {
    if (titleLower.includes(keyword)) {
      matchCount++;
    }
  }

  // 직접 제목 키워드가 메시지에 포함되는지도 체크
  const titleWords = titleLower.split(/[\s·\-_,./()]+/).filter(w => w.length >= 2);
  for (const word of titleWords) {
    if (messageLower.includes(word)) {
      matchCount++;
    }
  }

  const totalChecks = topicKeywords.length + titleWords.length;
  return totalChecks > 0 ? matchCount / totalChecks : 0;
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

  // 다양한 주소 패턴 인식 (도로명주소, 지번주소 모두 지원)
  const addressPatterns = [
    // 도로명주소: 시/도 + 시/군/구 + 로/길 + 번호
    /([가-힣]+(?:특별시|광역시|시|도)\s*[가-힣]+(?:시|군|구)\s*[가-힣0-9]+(?:로|길)\s*[\d-]+(?:번길\s*\d+)?)/,
    // 지번주소: 시/도 + 시/군/구 + 읍/면/동 + 번지
    /([가-힣]+(?:특별시|광역시|시|도)\s*[가-힣]+(?:시|군|구)\s*[가-힣]+(?:읍|면|동|리|가)\s*[\d-]+(?:번지)?)/,
    // 간단한 형식: 구/군 + 동/로/길 + 번호
    /([가-힣]+(?:구|군)\s*[가-힣0-9]+(?:동|로|길)\s*[\d-]+)/,
    // 읍면동 + 번지
    /([가-힣]+(?:읍|면|동|리)\s*[\d-]+(?:번지)?)/,
    // 간단한 도로명주소: 한글+로/길 + 번호 (예: 용종로123, 세종대로 100)
    /([가-힣]+(?:로|길)\s*[\d-]+(?:번지)?)/,
  ];

  let addressMatch: RegExpMatchArray | null = null;
  for (const pattern of addressPatterns) {
    addressMatch = message.match(pattern);
    if (addressMatch) break;
  }

  // 주소가 있으면 토지이용계획 조회 필요 (인허가 관련 질문일 가능성 높음)
  const hasLandKeyword = landKeywords.some(k => message.includes(k));
  const needsLandUse = addressMatch !== null && hasLandKeyword;

  // 건축물대장 조회가 필요한 키워드 (허가/용도변경 관련)
  const buildingKeywords = [
    "허가", "가능", "용도변경", "건축물대장", "위반건축물", "사용승인",
    "층수", "용적률", "건폐율", "연면적", "건축면적",
    "숙박", "호텔", "모텔", "호스텔", "민박", "게스트하우스",
    "음식점", "카페", "식당", "공장", "창고", "사무실", "상가"
  ];
  const hasBuildingKeyword = buildingKeywords.some(k => message.includes(k));
  const needsBuildingInfo = addressMatch !== null && hasBuildingKeyword;

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
    const intent = detectIntent(lastUserMessage);

    // 추가 컨텍스트 정보 수집
    let additionalContext = "";

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

    // Knowledge Base - Gemini File URI 방식 (Fast Path - 자동 갱신 없음)
    let knowledgeFiles: FileDataPart[] = [];

    try {
      // 카테고리 자동 감지 (질문 내용 기반)
      let targetCategory: string | undefined;
      if (/비자|사증|출입국|하이코리아|체류|외국인/i.test(lastUserMessage)) {
        targetCategory = "출입국";
      } else if (/숙박|호텔|호스텔|모텔|펜션|게스트하우스|관광숙박/i.test(lastUserMessage)) {
        targetCategory = "관광숙박";
      } else if (/음식점|식품|휴게음식|일반음식|위생/i.test(lastUserMessage)) {
        targetCategory = "인허가";
      } else if (/공공조달|조달|입찰|낙찰|계약|기업행정/i.test(lastUserMessage)) {
        targetCategory = "기업행정";
      }

      // 카테고리 매칭되지 않으면 지식베이스 스킵 (관련 없는 문서 주입 방지)
      if (!targetCategory) {
        console.log("[Chat] Knowledge Base: 카테고리 매칭 없음 - 스킵");
      }

      // Fast Path: DB 쿼리만 수행 (자동 갱신 없음, 만료 문서 제외)
      // 후보 5개까지 가져와서 관련성 필터링
      // 3초 타임아웃 - 실패 시 빈 배열로 폴백
      const kbResult = targetCategory ? await withTimeout(
        getKnowledgeContextFast(targetCategory, 5),
        3000,
        { fileParts: [], documentTitles: [] }
      ) : { fileParts: [], documentTitles: [] };

      if (kbResult.fileParts.length > 0) {
        // 관련성 필터: 각 문서의 제목과 질문의 키워드 매칭 점수 계산
        const scoredDocs = kbResult.documentTitles.map((title, idx) => ({
          title,
          filePart: kbResult.fileParts[idx],
          score: scoreDocumentRelevance(title, lastUserMessage),
        }));

        // 점수 내림차순 정렬
        scoredDocs.sort((a, b) => b.score - a.score);

        // 임계값 이상인 문서만 선택 (최대 1개)
        const relevantDocs = scoredDocs.filter(d => d.score >= KB_RELEVANCE_THRESHOLD);

        console.log(`[Chat] KB 관련성 점수: ${scoredDocs.map(d => `${d.title}=${d.score.toFixed(2)}`).join(', ')}`);

        if (relevantDocs.length > 0) {
          const bestDoc = relevantDocs[0];
          knowledgeFiles = [bestDoc.filePart];
          console.log(`[Chat] Knowledge Base 연동: ${bestDoc.title} (점수: ${bestDoc.score.toFixed(2)})`);

          additionalContext += `\n\n[Knowledge Base 문서 참고]
📚 첨부된 문서: ${bestDoc.title}
- 질문과 직접 관련된 내용이 있는 경우에만 인용하세요. 관련 없으면 무시하세요.
- 문서에 없는 내용은 시스템 프롬프트와 전문 지식 기반으로 답변하세요.
`;
        } else {
          console.log(`[Chat] Knowledge Base: 관련 문서 없음 (임계값 ${KB_RELEVANCE_THRESHOLD} 미만) - 스킵`);
        }
      } else {
        console.log("[Chat] Knowledge Base: 유효한 문서 없음 - 시스템 프롬프트만 사용");
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

    // DB에서 시스템 프롬프트 가져오기 (없으면 기본 프롬프트 사용)
    const baseSystemPrompt = await getActiveSystemPrompt();

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
