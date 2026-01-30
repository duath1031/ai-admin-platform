import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chatWithKnowledgeStream, FileDataPart } from "@/lib/gemini";
import { getActiveSystemPrompt } from "@/lib/systemPromptService";
import { searchForm, formatFormInfo, COMMON_FORMS } from "@/lib/lawApi";
import { searchLandUse, formatLandUseResult } from "@/lib/landUseApi";
import { searchBuilding, formatBuildingResult } from "@/lib/buildingApi";
import { searchBusinessTypes } from "@/lib/formDatabase";
// RAG 시스템 (맥락 인식형 법령 검색)
import { searchLegalInfo, formatLegalResultForPrompt } from "@/lib/rag/lawService";
import { quickClassify } from "@/lib/rag/intentClassifier";
// Knowledge Base - 경량 버전 사용
import { getKnowledgeContextFast } from "@/lib/ai/knowledgeQuery";
// 문서 생성 시스템
import { FORM_TEMPLATES } from "@/lib/document/templates";
import { GOV24_SERVICES } from "@/lib/document/gov24Links";

// Vercel 서버리스 함수 타임아웃 설정
export const maxDuration = 60;

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
    "공유재산": ["공유재산", "국유재산", "행정재산", "일반재산", "공공재산", "재산관리", "편람"],
    "행정": ["행정사", "행정업무", "행정절차", "민원", "관공서"],
  };

  const found: string[] = [];
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(k => message.includes(k))) {
      found.push(topic);
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

  const titleWords = titleLower.split(/[\s·\-_,./()]+/).filter(w => w.length >= 2);
  for (const word of titleWords) {
    if (messageLower.includes(word)) {
      matchCount++;
    }
  }

  const totalChecks = topicKeywords.length + titleWords.length;
  return totalChecks > 0 ? matchCount / totalChecks : 0;
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

  // 다양한 주소 패턴 인식
  const addressPatterns = [
    /([가-힣]+(?:특별시|광역시|시|도)\s*[가-힣]+(?:시|군|구)\s*[가-힣0-9]+(?:로|길)\s*[\d-]+(?:번길\s*\d+)?)/,
    /([가-힣]+(?:특별시|광역시|시|도)\s*[가-힣]+(?:시|군|구)\s*[가-힣]+(?:읍|면|동|리|가)\s*[\d-]+(?:번지)?)/,
    /([가-힣]+(?:구|군)\s*[가-힣0-9]+(?:동|로|길)\s*[\d-]+)/,
    /([가-힣]+(?:읍|면|동|리)\s*[\d-]+(?:번지)?)/,
    // 번길 패턴 지원: 오조산로 45번길 12
    /([가-힣]+(?:로|길)\s*\d+번길\s*[\d-]+)/,
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
    const businessTypesResult = searchBusinessTypes(lastUserMessage);
    if (businessTypesResult.length > 0) {
      additionalContext += `\n\n[관련 업종 정보 - 반드시 아래 링크를 답변에 포함할 것]\n`;
      for (const bt of businessTypesResult.slice(0, 2)) {
        additionalContext += `\n### ${bt.name} (${bt.category})\n`;
        additionalContext += `📋 **신청 서식**: [${bt.formName}](${bt.formUrl})\n`;
        additionalContext += `📚 **관계법령**: [${bt.category} 서식 페이지](${bt.lawPage})\n`;

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
      const needsLegalSearch = intentClass.procedureScore >= 2 || intentClass.disputeScore >= 2;
      console.log(`[Chat Stream] 의도분류: 절차=${intentClass.procedureScore}, 분쟁=${intentClass.disputeScore}, 검색필요=${needsLegalSearch}`);
      if (needsLegalSearch) {
        console.log(`[Chat Stream] RAG 법령 검색 시작...`);
        try {
          const legalResult = await withTimeout(
            searchLegalInfo(lastUserMessage),
            5000,
            { success: false, intent: { mode: intentClass.likelyMode, confidence: 0, keywords: [], reasoning: "타임아웃", searchScope: { statutes: false, regulations: false, localLaws: false, precedents: false, rulings: false, forms: false } }, statutes: [], precedents: [], rulings: [], forms: [], localLaws: [], error: "타임아웃", systemMessage: "법령 검색 타임아웃" }
          );
          if (legalResult.success) {
            additionalContext += formatLegalResultForPrompt(legalResult);
            console.log("[Chat Stream] RAG 검색 완료");
          } else {
            console.log("[Chat Stream] RAG 검색 실패/타임아웃:", legalResult.systemMessage || legalResult.error);
          }
        } catch (searchError) {
          console.warn("[Chat Stream] RAG searchLegalInfo 오류:", searchError);
        }
      }
    } catch (ragError) {
      console.warn("[Chat Stream] RAG 검색 오류 (무시하고 계속):", ragError);
    }

    // Knowledge Base - Gemini File URI 방식 (Fast Path)
    let knowledgeFiles: FileDataPart[] = [];

    try {
      // 카테고리 자동 감지
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

      if (!targetCategory) {
        console.log("[Chat Stream] Knowledge Base: 카테고리 매칭 없음 - 스킵");
      }

      const kbResult = targetCategory ? await withTimeout(
        getKnowledgeContextFast(targetCategory, 5),
        3000,
        { fileParts: [], documentTitles: [] }
      ) : { fileParts: [], documentTitles: [] };

      // KB 문서 관련성 필터링 함수
      const findBestRelevantDoc = (fileParts: FileDataPart[], documentTitles: string[], source: string) => {
        const scoredDocs = documentTitles.map((title, idx) => ({
          title,
          filePart: fileParts[idx],
          score: scoreDocumentRelevance(title, lastUserMessage),
        }));
        scoredDocs.sort((a, b) => b.score - a.score);
        console.log(`[Chat Stream] KB 관련성 점수 (${source}): ${scoredDocs.map(d => `${d.title}=${d.score.toFixed(2)}`).join(', ')}`);
        return scoredDocs.length > 0 && scoredDocs[0].score >= KB_RELEVANCE_THRESHOLD ? scoredDocs[0] : null;
      };

      let bestDoc: { title: string; filePart: FileDataPart; score: number } | null = null;

      if (kbResult.fileParts.length > 0) {
        bestDoc = findBestRelevantDoc(kbResult.fileParts, kbResult.documentTitles, "카테고리");
      }

      // Fallback: 카테고리 검색에서 관련 문서 못 찾으면 전체 문서에서 검색
      if (!bestDoc && extractTopicKeywords(lastUserMessage).length > 0) {
        console.log("[Chat Stream] KB fallback: 전체 문서에서 관련 문서 검색...");
        try {
          const allDocsResult = await withTimeout(
            getKnowledgeContextFast(undefined, 10),
            3000,
            { fileParts: [], documentTitles: [] }
          );
          if (allDocsResult.fileParts.length > 0) {
            bestDoc = findBestRelevantDoc(allDocsResult.fileParts, allDocsResult.documentTitles, "전체");
          }
        } catch (fallbackErr) {
          console.warn("[Chat Stream] KB fallback 오류:", fallbackErr);
        }
      }

      if (bestDoc) {
        knowledgeFiles = [bestDoc.filePart];
        console.log(`[Chat Stream] Knowledge Base 연동: ${bestDoc.title} (점수: ${bestDoc.score.toFixed(2)})`);
        additionalContext += `\n\n[Knowledge Base 문서 참고]
📚 첨부된 문서: ${bestDoc.title}
- 이 문서는 질문과 관련성이 높습니다. 문서 내용을 적극적으로 인용하여 답변하세요.
- 인용 시 "[출처: ${bestDoc.title}]" 형식으로 출처를 명시하세요.
- 문서에 없는 내용은 전문 지식과 Google 검색을 활용하세요.
`;
      } else {
        console.log("[Chat Stream] Knowledge Base: 관련 문서 없음 - 시스템 프롬프트만 사용");
      }
    } catch (error) {
      console.error("[Chat Stream] Knowledge Base 오류:", error);
    }

    // 문서 생성 템플릿 감지 시 AI에게 정보 제공
    if (intent.documentTemplate) {
      const template = FORM_TEMPLATES[intent.documentTemplate];
      const gov24Service = template?.gov24ServiceKey ? GOV24_SERVICES[template.gov24ServiceKey] : null;

      if (template) {
        console.log(`[Chat Stream] 문서 생성 템플릿 감지: ${intent.documentTemplate}`);

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
      console.log(`[Chat Stream] 부동산 정보 조회 시작: "${intent.address}", 토지=${intent.needsLandUse}, 건물=${intent.needsBuildingInfo}`);

      try {
        const [landResult, buildingResult] = await Promise.all([
          intent.needsLandUse
            ? withTimeout(
                searchLandUse(intent.address).catch(e => ({ success: false, error: `조회 오류: ${e.message}` })),
                5000,
                { success: false, error: "토지이용계획 조회 타임아웃" }
              )
            : Promise.resolve(null),
          intent.needsBuildingInfo
            ? withTimeout(
                searchBuilding(intent.address).catch(e => ({ success: false, error: `조회 오류: ${e.message}` })),
                5000,
                { success: false, error: "건축물대장 조회 타임아웃" }
              )
            : Promise.resolve(null),
        ]);

        if (landResult) {
          if (landResult.success) {
            additionalContext += `\n\n${formatLandUseResult(landResult)}`;
            console.log("[Chat Stream] 토지이용계획 조회 완료");
          } else {
            console.log("[Chat Stream] 토지이용계획 조회 실패:", landResult.error);
            additionalContext += `\n\n[토지이용계획 조회]\n⚠️ ${landResult.error || "조회 실패"}\n토지이음(eum.go.kr)에서 직접 확인해주세요.`;
          }
        }

        if (buildingResult) {
          if (buildingResult.success) {
            additionalContext += `\n\n${formatBuildingResult(buildingResult)}`;
            console.log("[Chat Stream] 건축물대장 조회 완료");
          } else {
            console.log("[Chat Stream] 건축물대장 조회 실패:", buildingResult.error);
            additionalContext += `\n\n[건축물대장 조회]\n⚠️ ${buildingResult.error || "조회 실패"}\n세움터(cloud.eais.go.kr)에서 직접 확인해주세요.`;
          }
        }
      } catch (realEstateError) {
        console.warn("[Chat Stream] 부동산 정보 조회 오류 (무시하고 계속):", realEstateError);
      }
    }

    // 시스템 프롬프트
    const baseSystemPrompt = await getActiveSystemPrompt();
    const enhancedPrompt = baseSystemPrompt + additionalContext;

    // 스트리밍 응답 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = chatWithKnowledgeStream(
            messages,
            enhancedPrompt,
            knowledgeFiles
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
