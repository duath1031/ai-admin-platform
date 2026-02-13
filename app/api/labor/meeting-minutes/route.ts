export const dynamic = 'force-dynamic';

/**
 * 회의록/녹취록 AI 생성 API
 * POST /api/labor/meeting-minutes
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const {
      meetingType, // "board" | "shareholders" | "general" | "transcript"
      organizationName,
      meetingDate,
      meetingTime,
      location,
      chairperson,
      secretary,
      attendees, // string (comma-separated or newline-separated)
      agendaItems, // string (main agenda/topics)
      discussionContent, // string (raw notes, audio transcript, or key points)
      decisions, // string (decisions made)
      additionalNotes, // string
    } = body;

    if (!meetingType || !discussionContent) {
      return NextResponse.json(
        { error: "회의 유형과 회의 내용(또는 녹취 내용)은 필수입니다." },
        { status: 400 }
      );
    }

    const typeLabels: Record<string, string> = {
      board: "이사회 회의록",
      shareholders: "주주총회 회의록",
      general: "일반 회의록",
      transcript: "녹취록",
    };

    const typeInstructions: Record<string, string> = {
      board: `이사회 회의록 작성 규칙:
1. 상법 제391조의3에 따른 이사회 의사록 법정 기재사항을 반드시 포함
2. 의사일정, 부의안건, 의결사항을 명확히 구분
3. 각 안건별로 찬성/반대/기권 의결 결과 기재
4. 출석이사 및 감사의 기명날인/서명란 포함
5. 의장(대표이사) 선출 및 성원보고 포함
6. "의장은 위 의안이 원안대로 가결되었음을 선포하다" 형식 사용`,
      shareholders: `주주총회 회의록 작성 규칙:
1. 상법 제373조에 따른 주주총회 의사록 법정 기재사항 포함
2. 총 발행주식수, 출석주주 및 의결권 있는 주식수 기재
3. 정족수 충족 여부 확인 (보통결의: 출석의결권 과반수 + 발행주식 1/4 이상)
4. 특별결의 사항은 별도 정족수 기재 (출석의결권 2/3 이상 + 발행주식 1/3 이상)
5. 의안별 표결 결과(찬성/반대/기권) 상세 기재
6. 의장(대표이사 또는 선출의장) 개회선언 및 폐회선언 포함
7. 공증 필요 시 안내문구 추가`,
      general: `일반 회의록 작성 규칙:
1. 회의 기본정보 (일시, 장소, 참석자) 명확히 기재
2. 안건별로 논의 내용과 결정사항을 구분하여 정리
3. 각 안건의 담당자와 이행기한을 명시
4. 회의 결론 및 차기 회의 일정 기재
5. 작성자와 참석자 확인란 포함
6. 비즈니스 표준 형식 준수`,
      transcript: `녹취록 작성 규칙:
1. 발언자별로 발언 내용을 시간순으로 정리
2. 발언자 식별이 어려운 경우 "참석자A", "참석자B" 등으로 표기
3. 비언어적 요소(웃음, 침묵, 동의 등)는 [괄호]로 표기
4. 핵심 논의사항과 결정사항을 별도 요약으로 정리
5. 녹취 시작/종료 시간 기재
6. "이 녹취록은 녹음 내용을 기반으로 작성되었습니다" 문구 포함
7. 법적 증거력을 위한 작성일시 및 작성자 기재`,
    };

    const meetingLabel = typeLabels[meetingType] || "회의록";
    const instructions = typeInstructions[meetingType] || typeInstructions.general;

    const prompt = `당신은 대한민국 법인/단체의 공식 문서 작성 전문가입니다. 아래 정보를 바탕으로 ${meetingLabel}을 한국어로 작성해주세요.

[작성 규칙]
${instructions}

[공통 규칙]
- 경어체(합니다/습니다) 사용
- 날짜는 "2026년 2월 13일" 형식
- 금액은 "금 0,000,000원(금 천만 원)" 형식으로 한글 병기
- 문서 상단에 "${meetingLabel}" 제목
- 하단에 작성일자, 작성자 기재란 포함

[회의 기본정보]
- 단체/법인명: ${organizationName || "미기재"}
- 회의 일시: ${meetingDate || "미기재"} ${meetingTime || ""}
- 장소: ${location || "미기재"}
- 의장/사회자: ${chairperson || "미기재"}
- 서기/작성자: ${secretary || "미기재"}
- 참석자: ${attendees || "미기재"}

${agendaItems ? `[안건/의제]\n${agendaItems}\n` : ""}

[회의 내용 / 녹취 내용]
${discussionContent}

${decisions ? `[결정사항]\n${decisions}\n` : ""}
${additionalNotes ? `[추가사항]\n${additionalNotes}\n` : ""}

위 정보를 기반으로 완성도 높은 ${meetingLabel}을 작성해주세요. 법적 유효성과 실무 활용도를 모두 갖추도록 작성하세요.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error("AI 응답이 비어있습니다.");
    }

    return NextResponse.json({
      success: true,
      content,
      metadata: {
        generatedAt: new Date().toISOString(),
        meetingType,
        meetingLabel,
      },
    });
  } catch (error) {
    console.error("[Meeting Minutes API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "회의록 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
