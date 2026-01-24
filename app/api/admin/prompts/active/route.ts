import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: 활성 기본 프롬프트 조회 (AI 채팅용 - 인증 불필요)
export async function GET() {
  try {
    // 기본 프롬프트 우선 조회
    let prompt = await prisma.systemPrompt.findFirst({
      where: { isDefault: true, isActive: true },
    });

    // 기본 프롬프트가 없으면 활성화된 첫 번째 프롬프트 사용
    if (!prompt) {
      prompt = await prisma.systemPrompt.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!prompt) {
      return NextResponse.json({ prompt: null, content: null });
    }

    return NextResponse.json({
      prompt: {
        id: prompt.id,
        name: prompt.name,
        displayName: prompt.displayName,
      },
      content: prompt.content,
    });
  } catch (error: any) {
    console.error("[Active Prompt API] 조회 오류:", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
