import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reviewWithGemini } from "@/lib/gemini";
import { DOCUMENT_REVIEW_PROMPT } from "@/lib/systemPrompts";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, documentType } = await req.json();

    if (!content || content.trim().length < 50) {
      return NextResponse.json(
        { error: "검토할 내용이 너무 짧습니다. 최소 50자 이상 입력해주세요." },
        { status: 400 }
      );
    }

    const userContent = `다음 ${documentType || "서류"}를 검토해주세요:\n\n${content}`;
    const result = await reviewWithGemini(userContent, DOCUMENT_REVIEW_PROMPT);

    return NextResponse.json({
      completeness: 0,
      analysis: result.analysis,
      issues: [],
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error("Review error:", error);
    return NextResponse.json(
      { error: "서류 검토 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
