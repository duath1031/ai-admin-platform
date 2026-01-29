/**
 * Simple Chat API - 최소 기능 테스트용
 * 에러 원인 격리를 위해 Knowledge Base만 사용
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

export async function POST(req: NextRequest) {
  console.log("[Simple Chat] === START ===");

  try {
    // Step 1: 인증 확인
    console.log("[Simple Chat] Step 1: Checking auth...");
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log("[Simple Chat] No session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[Simple Chat] Auth OK:", session.user.email);

    // Step 2: 요청 파싱
    console.log("[Simple Chat] Step 2: Parsing request...");
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }
    const lastMessage = messages[messages.length - 1]?.content || "";
    console.log("[Simple Chat] Message:", lastMessage.substring(0, 50));

    // Step 3: Knowledge Base 조회
    console.log("[Simple Chat] Step 3: Querying Knowledge Base...");
    let knowledgeFiles: Array<{ fileData: { fileUri: string; mimeType: string } }> = [];

    try {
      const documents = await prisma.knowledgeDocument.findMany({
        where: {
          status: "completed",
          processingMode: "gemini_file",
        },
        select: {
          id: true,
          title: true,
          geminiFileUri: true,
          geminiMimeType: true,
        },
        take: 3,
      });

      console.log("[Simple Chat] Found documents:", documents.length);

      for (const doc of documents) {
        if (doc.geminiFileUri && doc.geminiMimeType) {
          knowledgeFiles.push({
            fileData: {
              fileUri: doc.geminiFileUri,
              mimeType: doc.geminiMimeType,
            },
          });
        }
      }
      console.log("[Simple Chat] Valid files:", knowledgeFiles.length);
    } catch (dbError) {
      console.error("[Simple Chat] DB Error:", dbError);
      // DB 에러시 빈 배열로 진행
    }

    // Step 4: Gemini 호출
    console.log("[Simple Chat] Step 4: Calling Gemini...");
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: "당신은 행정 민원 전문 AI 상담사입니다. 한국어로 친절하게 답변하세요.",
    });

    let response: string;

    if (knowledgeFiles.length > 0) {
      console.log("[Simple Chat] Using Knowledge files");
      const parts = [
        ...knowledgeFiles,
        { text: lastMessage },
      ];
      const result = await model.generateContent(parts);
      response = result.response.text();
    } else {
      console.log("[Simple Chat] Basic chat (no knowledge)");
      const result = await model.generateContent(lastMessage);
      response = result.response.text();
    }

    console.log("[Simple Chat] Response length:", response.length);
    console.log("[Simple Chat] === SUCCESS ===");

    return NextResponse.json({ message: response });

  } catch (error) {
    console.error("[Simple Chat] === ERROR ===");
    console.error("[Simple Chat] Error type:", typeof error);
    console.error("[Simple Chat] Error:", error);
    if (error instanceof Error) {
      console.error("[Simple Chat] Name:", error.name);
      console.error("[Simple Chat] Message:", error.message);
      console.error("[Simple Chat] Stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
        debug: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
