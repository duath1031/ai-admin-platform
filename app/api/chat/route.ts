import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chatWithGemini } from "@/lib/gemini";
import { ADMINI_SYSTEM_PROMPT } from "@/lib/systemPrompts";
import prisma from "@/lib/prisma";
import { searchForm, formatFormInfo, COMMON_FORMS } from "@/lib/lawApi";
import { searchLandUse, formatLandUseResult } from "@/lib/landUseApi";
import { searchBusinessTypes } from "@/lib/formDatabase";
// RAG 시스템 (맥락 인식형 법령 검색)
import { searchLegalInfo, formatLegalResultForPrompt } from "@/lib/rag/lawService";
import { quickClassify } from "@/lib/rag/intentClassifier";

// 사용자 메시지에서 의도 파악
function detectIntent(message: string): {
  needsFormInfo: boolean;
  needsLandUse: boolean;
  formKeyword?: string;
  address?: string;
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
  ];

  let addressMatch: RegExpMatchArray | null = null;
  for (const pattern of addressPatterns) {
    addressMatch = message.match(pattern);
    if (addressMatch) break;
  }

  // 주소가 있으면 토지이용계획 조회 필요 (인허가 관련 질문일 가능성 높음)
  const hasLandKeyword = landKeywords.some(k => message.includes(k));
  const needsLandUse = addressMatch !== null && hasLandKeyword;

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
    formKeyword,
    address: addressMatch ? addressMatch[1] : undefined,
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

    // 토지이용계획 조회
    if (intent.needsLandUse && intent.address) {
      try {
        const landResult = await searchLandUse(intent.address);
        additionalContext += `\n\n[토지이용계획 조회 결과]\n${formatLandUseResult(landResult)}`;
      } catch (error) {
        console.error("토지이용계획 조회 오류:", error);
      }
    }

    // 시스템 프롬프트에 추가 컨텍스트 포함
    const enhancedPrompt = ADMINI_SYSTEM_PROMPT + additionalContext;

    const assistantMessage = await chatWithGemini(messages, enhancedPrompt);

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
