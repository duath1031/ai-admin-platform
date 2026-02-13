export const dynamic = 'force-dynamic';

/**
 * 내용증명 AI 생성 API
 * POST /api/labor/legal-notice
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
      senderName,
      senderAddress,
      recipientName,
      recipientAddress,
      subject,
      details,
      demandAmount,
      demandDeadline,
      tone, // "formal" | "strong" | "diplomatic"
    } = body;

    // Validation
    if (!senderName || !recipientName || !subject || !details) {
      return NextResponse.json(
        { error: "발신인명, 수신인명, 제목, 상세내용은 필수입니다." },
        { status: 400 }
      );
    }

    const toneDescription =
      tone === "strong"
        ? "강경하고 단호한 어조 (법적 조치를 분명히 경고)"
        : tone === "diplomatic"
        ? "외교적이고 원만한 어조 (협의 가능성을 열어둠)"
        : "정중하되 명확한 어조 (법적 사실관계를 객관적으로 전달)";

    const prompt = `당신은 대한민국 법률문서 작성 전문가입니다. 아래 정보를 바탕으로 내용증명 우편 형식에 맞는 법적 문서를 한국어로 작성해주세요.

[작성 규칙]
1. 내용증명 표준 형식을 정확히 따를 것
2. 문서 상단에 "내 용 증 명"이라는 제목을 넣을 것
3. 발신인 및 수신인 정보를 명확히 기재할 것
4. 본문은 다음 구조를 따를 것:
   - 사실관계 (발생한 사건의 경위를 시간순으로 정리)
   - 법적 근거 (관련 법률 조항 인용)
   - 요구사항 (구체적인 이행 요구)
   - 이행기한 및 불이행 시 조치 경고
5. 어조: ${toneDescription}
6. 날짜와 발신인 서명란을 포함할 것
7. 마지막에 "위 내용을 내용증명 우편으로 발송합니다."라는 문구를 넣을 것

[발신인 정보]
- 성명: ${senderName}
- 주소: ${senderAddress || "미기재"}

[수신인 정보]
- 성명: ${recipientName}
- 주소: ${recipientAddress || "미기재"}

[내용증명 제목]
${subject}

[상세 내용 (사실관계)]
${details}

${demandAmount ? `[청구금액]\n${Number(demandAmount).toLocaleString()}원\n` : ""}
${demandDeadline ? `[이행기한]\n${demandDeadline}\n` : ""}

위 정보를 기반으로 내용증명서를 완성해주세요. 법적 효력을 가질 수 있도록 정확한 법률 용어를 사용하고, 사실관계와 요구사항을 명확하게 구분하여 작성해주세요.`;

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
        tone,
      },
    });
  } catch (error) {
    console.error("[Legal Notice API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "내용증명 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
