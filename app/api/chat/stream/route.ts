import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chatWithKnowledgeStream, FileDataPart } from "@/lib/gemini";
import { getActiveSystemPrompt } from "@/lib/systemPromptService";
import { getKnowledgeContext } from "@/lib/ai/knowledgeQuery";

// Vercel 서버리스 함수 타임아웃 설정
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Knowledge Base 임시 비활성화 (성능 문제로 인해)
    // TODO: NotebookLM API 또는 RAG 방식으로 대체 예정
    const knowledgeFiles: FileDataPart[] = [];
    const additionalContext = "";
    console.log("[Chat Stream] Knowledge Base 비활성화 상태 - 시스템 프롬프트만 사용");

    // 시스템 프롬프트
    const baseSystemPrompt = await getActiveSystemPrompt();
    const enhancedPrompt = baseSystemPrompt + additionalContext;

    // 스트리밍 응답 생성
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = chatWithKnowledgeStream(
            messages,
            enhancedPrompt,
            knowledgeFiles
          );

          for await (const chunk of generator) {
            // Server-Sent Events 형식
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("[Chat Stream] 스트리밍 오류:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "스트리밍 오류가 발생했습니다." })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Chat Stream] Error:", error);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
