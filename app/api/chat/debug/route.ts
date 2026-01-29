/**
 * Chat Debug API - 인증 없이 테스트용
 * GET /api/chat/debug - 시스템 상태 확인
 * POST /api/chat/debug - 간단한 AI 테스트
 */

import { NextRequest, NextResponse } from "next/server";
import { chatWithGemini } from "@/lib/gemini";
import { getActiveSystemPrompt } from "@/lib/systemPromptService";
import prisma from "@/lib/prisma";

export async function GET() {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      hasGoogleApiKey: !!process.env.GOOGLE_AI_API_KEY,
      nodeEnv: process.env.NODE_ENV,
    },
  };

  // DB 연결 테스트
  try {
    const count = await prisma.knowledgeDocument.count();
    checks.database = { status: "ok", documentCount: count };
  } catch (error) {
    checks.database = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown",
    };
  }

  // System Prompt 테스트
  try {
    const prompt = await getActiveSystemPrompt();
    checks.systemPrompt = {
      status: "ok",
      length: prompt.length,
      preview: prompt.substring(0, 100) + "...",
    };
  } catch (error) {
    checks.systemPrompt = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown",
    };
  }

  return NextResponse.json(checks);
}

export async function POST(req: NextRequest) {
  try {
    const { message = "안녕하세요" } = await req.json().catch(() => ({}));

    console.log("[Debug] Testing Gemini with message:", message);

    const systemPrompt = await getActiveSystemPrompt();
    const response = await chatWithGemini(
      [{ role: "user", content: message }],
      systemPrompt
    );

    return NextResponse.json({
      success: true,
      message: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Debug] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
