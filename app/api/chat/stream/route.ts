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

// =============================================================================
// Knowledge Base 문서 관련성 필터 (Agentic RAG)
// =============================================================================

const KB_RELEVANCE_THRESHOLD = 0.2;

/** 질문에서 주제 키워드 추출 */
function extractTopicKeywords(message: string): string[] {
  const topicMap: Record<string, string[]> = {
    "숙박": ["숙박", "호텔", "호스텔", "모텔", "펜션", "게스트하우스", "민박", "리조트", "관광숙박"],
    "비자": ["비자", "사증", "출입국", "체류", "외국인", "하이코리아", "영주권"],
    "음식점": ["음식점", "식당", "카페", "휴게음식", "일반음식", "위생", "식품"],
    "조달": ["공공조달", "조달", "입찰", "낙찰", "계약", "나라장터"],
    "건축": ["건축", "건물", "건축물대장", "용도변경", "건폐율", "용적률"],
    "토지": ["토지", "용도지역", "개발행위", "토지이용"],
    "사업자": ["사업자등록", "창업", "개업", "폐업"],
    "공장": ["공장", "제조업", "제조시설", "생산시설"],
    "학원": ["학원", "교습소", "학원설립"],
    "광고": ["옥외광고", "간판", "현수막", "광고물"],
    "미용": ["미용업", "미용실", "헤어샵", "네일샵"],
    "정책자금": ["정책자금", "중진공", "소진공", "융자", "지원금"],
    "법인": ["법인설립", "법인", "주식회사", "유한회사"],
    "허가": ["허가", "인허가", "신고", "등록", "면허"],
  };

  const found: string[] = [];
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(k => message.includes(k))) {
      found.push(topic);
      keywords.forEach(k => { if (message.includes(k)) found.push(k); });
    }
  }
  return [...new Set(found)];
}

/** 문서 제목 vs 질문 키워드 매칭으로 관련성 점수 (0~1) 반환 */
function scoreDocumentRelevance(docTitle: string, userMessage: string): number {
  const titleLower = docTitle.toLowerCase();
  const messageLower = userMessage.toLowerCase();
  const topicKeywords = extractTopicKeywords(messageLower);

  if (topicKeywords.length === 0) return 0;

  let matchCount = 0;
  for (const keyword of topicKeywords) {
    if (titleLower.includes(keyword)) {
      matchCount++;
    }
  }

  const titleWords = titleLower.split(/[\s·\-_,./()]+/).filter(w => w.length >= 2);
  for (const word of titleWords) {
    if (messageLower.includes(word)) {
      matchCount++;
    }
  }

  const totalChecks = topicKeywords.length + titleWords.length;
  return totalChecks > 0 ? matchCount / totalChecks : 0;
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
      } else if (/숙박|호텔|호스텔|모텔|펜션|게스트하우스|관광숙박/i.test(lastUserMessage)) {
        targetCategory = "관광숙박";
      } else if (/음식점|식품|휴게음식|일반음식|위생/i.test(lastUserMessage)) {
        targetCategory = "인허가";
      } else if (/공공조달|조달|입찰|낙찰|계약|기업행정/i.test(lastUserMessage)) {
        targetCategory = "기업행정";
      }

      // 카테고리 매칭되지 않으면 지식베이스 스킵 (관련 없는 문서 주입 방지)
      if (!targetCategory) {
        console.log("[Chat Stream] Knowledge Base: 카테고리 매칭 없음 - 스킵");
      }

      // 후보 5개까지 가져와서 관련성 필터링
      const kbResult = targetCategory ? await withTimeout(
        getKnowledgeContextFast(targetCategory, 5),
        3000,
        { fileParts: [], documentTitles: [] }
      ) : { fileParts: [], documentTitles: [] };

      if (kbResult.fileParts.length > 0) {
        // 관련성 필터: 각 문서의 제목과 질문의 키워드 매칭 점수 계산
        const scoredDocs = kbResult.documentTitles.map((title, idx) => ({
          title,
          filePart: kbResult.fileParts[idx],
          score: scoreDocumentRelevance(title, lastUserMessage),
        }));

        scoredDocs.sort((a, b) => b.score - a.score);

        const relevantDocs = scoredDocs.filter(d => d.score >= KB_RELEVANCE_THRESHOLD);

        console.log(`[Chat Stream] KB 관련성 점수: ${scoredDocs.map(d => `${d.title}=${d.score.toFixed(2)}`).join(', ')}`);

        if (relevantDocs.length > 0) {
          const bestDoc = relevantDocs[0];
          knowledgeFiles = [bestDoc.filePart];
          console.log(`[Chat Stream] Knowledge Base 연동: ${bestDoc.title} (점수: ${bestDoc.score.toFixed(2)})`);

          additionalContext = `\n\n[Knowledge Base 문서 참고]
📚 첨부된 문서: ${bestDoc.title}
- 질문과 직접 관련된 내용이 있는 경우에만 인용하세요. 관련 없으면 무시하세요.
- 문서에 없는 내용은 시스템 프롬프트와 전문 지식 기반으로 답변하세요.
`;
        } else {
          console.log(`[Chat Stream] Knowledge Base: 관련 문서 없음 (임계값 ${KB_RELEVANCE_THRESHOLD} 미만) - 스킵`);
        }
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
