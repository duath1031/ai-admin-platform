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
// Knowledge Base - Gemini File API (Long Context)
import { getKnowledgeContext } from "@/lib/ai/knowledge";
// 문서 생성 시스템
import { FORM_TEMPLATES, findTemplate } from "@/lib/document/templates";
import { GOV24_SERVICES } from "@/lib/document/gov24Links";

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

    // 맥락 인식형 법령 검색 (RAG)
    // 절차/요건 질문: 법령+서식만, 분쟁/구제 질문: 판례+재결례 포함
    const quickIntent = quickClassify(lastUserMessage);
    if (quickIntent.procedureScore > 0 || quickIntent.disputeScore > 0) {
      try {
        console.log(`[Chat] RAG 검색 시작: ${quickIntent.likelyMode}`);
        const legalResult = await searchLegalInfo(lastUserMessage);
        if (legalResult.success) {
          additionalContext += formatLegalResultForPrompt(legalResult);
        }
        // API 오류 시 안내 메시지 추가
        if (legalResult.systemMessage) {
          additionalContext += `\n\n[시스템 안내]\n${legalResult.systemMessage}\n`;
        }
      } catch (error) {
        console.error("[Chat] 법령 검색 오류:", error);
        additionalContext += `\n\n[시스템 안내]\n죄송합니다. 현재 정부 시스템 연결이 불안정하여 일부 법령 정보를 가져오지 못했습니다.\n`;
      }
    }

    // Knowledge Base - 임시 비활성화 (디버깅용)
    // TODO: 문제 해결 후 다시 활성화
    const knowledgeFiles: FileDataPart[] = [];
    const knowledgeTitles: string[] = [];
    console.log("[Chat] Knowledge Base 임시 비활성화됨");

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

    // 토지이용계획 + 건축물대장 조회 (병렬 실행)
    if (intent.address && (intent.needsLandUse || intent.needsBuildingInfo)) {
      console.log(`[Chat] 부동산 정보 조회 시작: "${intent.address}" (토지: ${intent.needsLandUse}, 건물: ${intent.needsBuildingInfo})`);

      // 병렬로 API 호출
      const [landResult, buildingResult] = await Promise.all([
        intent.needsLandUse ? searchLandUse(intent.address).catch(err => {
          console.error("[Chat] 토지이용계획 조회 오류:", err);
          return null;
        }) : Promise.resolve(null),
        intent.needsBuildingInfo ? searchBuilding(intent.address).catch(err => {
          console.error("[Chat] 건축물대장 조회 오류:", err);
          return null;
        }) : Promise.resolve(null),
      ]);

      // 토지이용계획 결과
      if (landResult) {
        console.log(`[Chat] 토지이용계획 조회 결과: success=${landResult.success}, zones=${landResult.zoneInfo?.map(z => z.name).join(', ') || 'none'}`);
        additionalContext += `\n\n[토지이용계획 조회 결과]\n${formatLandUseResult(landResult)}`;
      } else if (intent.needsLandUse) {
        additionalContext += `\n\n[토지이용계획 조회]\n⚠️ 주소 "${intent.address}"의 토지이용계획 조회 중 오류가 발생했습니다. 토지이음(eum.go.kr)에서 직접 확인해주세요.`;
      }

      // 건축물대장 결과
      if (buildingResult) {
        console.log(`[Chat] 건축물대장 조회 결과: success=${buildingResult.success}, 용도=${buildingResult.mainPurpose || 'none'}`);
        additionalContext += `\n\n[건축물대장 조회 결과]\n${formatBuildingResult(buildingResult)}`;

        // 목표 업종이 있으면 용도변경 가능성 분석 추가
        if (intent.targetBusiness && buildingResult.success && buildingResult.mainPurpose) {
          const { checkPurposeChangeability } = await import("@/lib/buildingApi");
          const changeability = checkPurposeChangeability(buildingResult.mainPurpose, intent.targetBusiness);
          additionalContext += `\n\n[용도변경 분석]\n`;
          additionalContext += `- 현재 용도: ${buildingResult.mainPurpose}\n`;
          additionalContext += `- 목표 용도: ${intent.targetBusiness}\n`;
          additionalContext += `- 분석: ${changeability.note}\n`;
        }
      } else if (intent.needsBuildingInfo) {
        additionalContext += `\n\n[건축물대장 조회]\n⚠️ 주소 "${intent.address}"의 건축물대장 조회 중 오류가 발생했습니다. 세움터(cloud.eais.go.kr)에서 직접 확인해주세요.`;
      }
    } else if (intent.address) {
      console.log(`[Chat] 주소 감지됨 ("${intent.address}") 하지만 관련 키워드 없음`);
    }

    // DB에서 시스템 프롬프트 가져오기 (없으면 기본 프롬프트 사용)
    const baseSystemPrompt = await getActiveSystemPrompt();

    // 시스템 프롬프트에 추가 컨텍스트 포함
    const enhancedPrompt = baseSystemPrompt + additionalContext;

    // Knowledge 파일이 있으면 Long Context 방식으로 호출
    let assistantMessage: string;
    if (knowledgeFiles.length > 0) {
      console.log(`[Chat] Gemini Long Context 호출 (${knowledgeFiles.length}개 문서)`);
      assistantMessage = await chatWithKnowledge(messages, enhancedPrompt, knowledgeFiles);
    } else {
      assistantMessage = await chatWithGemini(messages, enhancedPrompt);
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
    console.error("Chat API error:", error);

    if (error instanceof Error && error.message.includes("API key")) {
      return NextResponse.json(
        { error: "API 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
