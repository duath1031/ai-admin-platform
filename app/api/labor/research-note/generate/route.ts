/**
 * 연구노트 AI 보강 API
 * POST /api/labor/research-note/generate
 * 간단한 메모/키워드 → Gemini AI가 KOITA 표준 연구노트 형식으로 정리
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { memo, projectName, title } = body;

    if (!memo) {
      return NextResponse.json(
        { error: "AI 보강을 위한 메모 내용을 입력해주세요." },
        { status: 400 }
      );
    }

    const prompt = `당신은 R&D 연구노트 작성 전문가입니다. 아래 입력을 KOITA(한국산업기술진흥협회) 표준 연구노트 양식에 맞게 정리해주세요.

[입력 정보]
${projectName ? `과제명: ${projectName}` : ""}
${title ? `제목: ${title}` : ""}
메모/키워드: ${memo}

[요구사항]
1. 연구목적 (purpose): 해당 실험/연구의 목적과 배경을 2~4문장으로 서술
2. 실험/연구 내용 (content): 구체적인 실험 방법, 절차, 조건을 단계별로 상세히 기술. 가능하면 번호 매기기 사용. 최소 5문장 이상.
3. 결과 (result): 실험 결과와 데이터를 정리. 수치적 결과가 있으면 포함.
4. 결론 및 고찰 (conclusion): 결과에 대한 해석, 의미, 개선점을 2~3문장으로 서술
5. 향후 계획 (nextPlan): 다음 단계 연구/실험 계획을 1~3문장으로 서술

[출력 형식]
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
{
  "purpose": "...",
  "content": "...",
  "result": "...",
  "conclusion": "...",
  "nextPlan": "..."
}

전문적이고 객관적인 어조로 작성하되, 입력 내용을 최대한 구체적으로 확장해주세요.
줄바꿈은 \\n으로 표현하세요.`;

    const genResult = await model.generateContent(prompt);
    const responseText = genResult.response.text();

    // JSON 파싱 시도 (코드블록 제거 포함)
    let parsed;
    try {
      const cleaned = responseText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // JSON 파싱 실패 시 정규식으로 추출
      const extractField = (field: string): string => {
        const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]*(?:\\\\"[^"]*)*)"`, "s");
        const match = responseText.match(regex);
        return match ? match[1].replace(/\\"/g, '"') : "";
      };
      parsed = {
        purpose: extractField("purpose"),
        content: extractField("content"),
        result: extractField("result"),
        conclusion: extractField("conclusion"),
        nextPlan: extractField("nextPlan"),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        purpose: parsed.purpose || "",
        content: parsed.content || "",
        result: parsed.result || "",
        conclusion: parsed.conclusion || "",
        nextPlan: parsed.nextPlan || "",
      },
    });
  } catch (error) {
    console.error("[ResearchNote Generate] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI 보강 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
