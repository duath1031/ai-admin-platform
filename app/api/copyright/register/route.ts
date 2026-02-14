/**
 * 창작의도 기술서 AI 생성 API
 * POST /api/copyright/register
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";
import { buildCreationDescriptionPrompt, type ProgramInfo } from "@/lib/copyright/copyrightHelper";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "copyright_description");
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: `${access.requiredPlan} 이상 요금제에서 사용 가능합니다.`,
          requiredPlan: access.requiredPlan,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const info: ProgramInfo = body;

    // 필수값 검증
    if (!info.programName?.trim()) {
      return NextResponse.json({ error: "프로그램명을 입력해주세요." }, { status: 400 });
    }
    if (!info.version?.trim()) {
      return NextResponse.json({ error: "버전을 입력해주세요." }, { status: 400 });
    }
    if (!info.creationDate?.trim()) {
      return NextResponse.json({ error: "창작일을 입력해주세요." }, { status: 400 });
    }
    if (!info.description?.trim()) {
      return NextResponse.json({ error: "프로그램 설명을 입력해주세요." }, { status: 400 });
    }
    if (!info.authorName?.trim()) {
      return NextResponse.json({ error: "저작자명을 입력해주세요." }, { status: 400 });
    }
    if (!info.programmingLanguages || info.programmingLanguages.length === 0) {
      return NextResponse.json({ error: "프로그래밍 언어를 선택해주세요." }, { status: 400 });
    }
    if (!info.category?.trim()) {
      return NextResponse.json({ error: "분류를 선택해주세요." }, { status: 400 });
    }
    if (!info.features || info.features.length === 0) {
      return NextResponse.json({ error: "주요 기능을 1개 이상 입력해주세요." }, { status: 400 });
    }

    // 프롬프트 생성
    const prompt = buildCreationDescriptionPrompt(info);

    // Gemini Flash로 창작의도 기술서 생성
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    });

    const result = await model.generateContent(prompt);
    const description = result.response.text();

    // 글자 수 계산
    const wordCount = description.replace(/\s/g, "").length;

    // 토큰 차감
    await deductTokens(session.user.id, "copyright_description");

    return NextResponse.json({
      success: true,
      data: {
        description,
        wordCount,
      },
    });
  } catch (error) {
    console.error("[Copyright Register API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "창작의도 기술서 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
