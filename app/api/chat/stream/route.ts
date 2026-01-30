import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { chatWithKnowledgeStream, FileDataPart } from "@/lib/gemini";
import { getActiveSystemPrompt } from "@/lib/systemPromptService";
import { getKnowledgeContextFast } from "@/lib/ai/knowledgeQuery";

// Vercel 서버리스 함수 타임아웃 설정
export const maxDuration = 60;

// 외부 API 타임아웃 헬퍼 함수
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), timeoutMs)
    ),
  ]);
}

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

    // Knowledge Base - Gemini File URI 방식 (Fast Path - 자동 갱신 없음)
    let knowledgeFiles: FileDataPart[] = [];
    let additionalContext = "";

    try {
      // 카테고리 자동 감지
      let targetCategory: string | undefined;
      if (/비자|사증|출입국|하이코리아|체류|외국인/i.test(lastUserMessage)) {
        targetCategory = "출입국";
      } else if (/숙박|호텔|모텔|펜션|게스트하우스|관광숙박/i.test(lastUserMessage)) {
        targetCategory = "관광숙박";
      } else if (/음식점|식품|휴게음식|일반음식|위생/i.test(lastUserMessage)) {
        targetCategory = "인허가";
      }

      const kbResult = await withTimeout(
        getKnowledgeContextFast(targetCategory, 1),
        3000,
        { fileParts: [], documentTitles: [] }
      );

      if (kbResult.fileParts.length > 0) {
        knowledgeFiles = kbResult.fileParts;
        console.log(`[Chat Stream] Knowledge Base 연동: ${kbResult.documentTitles.join(', ')}`);

        additionalContext = `\n\n[Knowledge Base 문서 참고]
📚 첨부된 문서: ${kbResult.documentTitles.join(', ')}
- 첨부된 PDF 문서의 내용을 우선 참고하여 답변하세요.
- 문서에 관련 내용이 있으면 인용하여 답변하세요.
- 문서에 없는 내용은 시스템 프롬프트 기반으로 답변하세요.
`;
      } else {
        console.log("[Chat Stream] Knowledge Base: 유효한 문서 없음");
      }
    } catch (error) {
      console.error("[Chat Stream] Knowledge Base 오류:", error);
    }

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
