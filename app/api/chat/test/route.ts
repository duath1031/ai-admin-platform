/**
 * Minimal Test API - 단계별 테스트
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";

export const maxDuration = 60; // 60초 타임아웃
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: {},
  };

  // Step 1: 기본 응답
  results.steps.basic = "OK";

  // Step 2: 환경변수
  results.steps.env = {
    hasGoogleKey: !!process.env.GOOGLE_AI_API_KEY,
    keyLength: process.env.GOOGLE_AI_API_KEY?.length || 0,
  };

  // Step 3: DB 연결
  try {
    const start = Date.now();
    const count = await prisma.knowledgeDocument.count();
    results.steps.database = {
      status: "OK",
      documentCount: count,
      latency: Date.now() - start,
    };
  } catch (e) {
    results.steps.database = {
      status: "ERROR",
      error: e instanceof Error ? e.message : "Unknown",
    };
  }

  // Step 4: Knowledge 문서 조회
  try {
    const start = Date.now();
    const docs = await prisma.knowledgeDocument.findMany({
      where: { status: "completed", processingMode: "gemini_file" },
      select: { id: true, title: true, geminiFileUri: true },
      take: 3,
    });
    results.steps.knowledge = {
      status: "OK",
      count: docs.length,
      docs: docs.map(d => ({ id: d.id, title: d.title, hasUri: !!d.geminiFileUri })),
      latency: Date.now() - start,
    };
  } catch (e) {
    results.steps.knowledge = {
      status: "ERROR",
      error: e instanceof Error ? e.message : "Unknown",
    };
  }

  // Step 5: Gemini 연결 테스트 (간단한 호출)
  try {
    const start = Date.now();
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("Say OK");
    const text = result.response.text();
    results.steps.gemini = {
      status: "OK",
      response: text.substring(0, 50),
      latency: Date.now() - start,
    };
  } catch (e) {
    results.steps.gemini = {
      status: "ERROR",
      error: e instanceof Error ? e.message : "Unknown",
    };
  }

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  try {
    // 인증 체크
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, step = "full" } = await req.json();
    const lastMessage = messages?.[messages.length - 1]?.content || "테스트";

    // Step별 테스트
    if (step === "gemini_only") {
      // Gemini만 테스트 (Knowledge 없이)
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(lastMessage);
      return NextResponse.json({ message: result.response.text(), step: "gemini_only" });
    }

    if (step === "knowledge") {
      // Knowledge 파일 조회만
      const docs = await prisma.knowledgeDocument.findMany({
        where: { status: "completed", processingMode: "gemini_file" },
        select: { geminiFileUri: true, geminiMimeType: true },
        take: 3,
      });
      return NextResponse.json({
        message: `Found ${docs.length} documents`,
        docs: docs.map(d => ({ uri: d.geminiFileUri?.substring(0, 50), mime: d.geminiMimeType })),
        step: "knowledge"
      });
    }

    if (step === "full") {
      // 전체 테스트 (Knowledge + Gemini)
      const docs = await prisma.knowledgeDocument.findMany({
        where: { status: "completed", processingMode: "gemini_file" },
        select: { geminiFileUri: true, geminiMimeType: true },
        take: 3,
      });

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: "간단히 답변하세요."
      });

      const fileParts = docs
        .filter(d => d.geminiFileUri && d.geminiMimeType)
        .map(d => ({
          fileData: { fileUri: d.geminiFileUri!, mimeType: d.geminiMimeType! }
        }));

      if (fileParts.length > 0) {
        const result = await model.generateContent([
          ...fileParts,
          { text: lastMessage }
        ]);
        return NextResponse.json({
          message: result.response.text(),
          filesUsed: fileParts.length,
          step: "full_with_knowledge"
        });
      } else {
        const result = await model.generateContent(lastMessage);
        return NextResponse.json({
          message: result.response.text(),
          filesUsed: 0,
          step: "full_no_knowledge"
        });
      }
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });

  } catch (error) {
    console.error("[Test API] Error:", error);
    return NextResponse.json({
      error: "Error",
      message: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    }, { status: 500 });
  }
}
