export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateWithGemini } from "@/lib/gemini";
import { DOCUMENT_GENERATION_PROMPTS } from "@/lib/systemPrompts";

// GET: Fetch user's documents
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await prisma.document.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Documents fetch error:", error);
    return NextResponse.json(
      { error: "서류 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: Generate document using AI
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.json();
    const { type, title, applicantName, applicantId, applicantAddress, applicantPhone, recipient, purpose, reason, additionalInfo } = formData;

    if (!type || !purpose || !reason) {
      return NextResponse.json(
        { error: "필수 정보를 입력해주세요." },
        { status: 400 }
      );
    }

    const systemPrompt = DOCUMENT_GENERATION_PROMPTS[type as keyof typeof DOCUMENT_GENERATION_PROMPTS] || DOCUMENT_GENERATION_PROMPTS.application;

    const userContent = `다음 정보를 바탕으로 서류를 작성해주세요:

제목: ${title || "미지정"}
신청인 성명: ${applicantName}
주민등록번호: ${applicantId}
주소: ${applicantAddress}
연락처: ${applicantPhone}
수신(제출처): ${recipient}
요청 취지: ${purpose}
상세 사유: ${reason}
${additionalInfo ? `추가 정보: ${additionalInfo}` : ""}

위 정보를 바탕으로 전문적이고 격식을 갖춘 서류를 작성해주세요.
실제 제출 가능한 형식으로 작성하되, 빈 부분은 [OO] 형태로 표시해주세요.`;

    const content = await generateWithGemini(userContent, systemPrompt);

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Document generation error:", error);
    return NextResponse.json(
      { error: "서류 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
