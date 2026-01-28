/**
 * Knowledge Base 검색 테스트 API
 * GET /api/knowledge/search?q=검색어
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { retrieveKnowledge, checkKnowledgeBaseStatus, shouldSearchKnowledge } from "@/lib/rag/retriever";
import { getVectorStats, checkVectorSetup } from "@/lib/rag/vectorStore";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const threshold = parseFloat(searchParams.get("threshold") || "0.3");
    const topK = parseInt(searchParams.get("topK") || "5");

    // 1. Vector 설정 확인
    const vectorSetup = await checkVectorSetup();

    // 2. Knowledge Base 상태 확인
    const kbStatus = await checkKnowledgeBaseStatus();

    // 3. Vector 통계
    const vectorStats = await getVectorStats();

    // 4. 검색 필요성 판단
    const shouldSearch = query ? shouldSearchKnowledge(query) : false;

    // 5. 실제 검색 수행 (쿼리가 있는 경우)
    let searchResult = null;
    if (query) {
      searchResult = await retrieveKnowledge(query, {
        topK,
        threshold,
      });
    }

    return NextResponse.json({
      success: true,
      debug: {
        vectorSetup,
        kbStatus,
        vectorStats,
        shouldSearch,
        query,
        threshold,
        topK,
      },
      searchResult: searchResult ? {
        success: searchResult.success,
        resultsCount: searchResult.results.length,
        metadata: searchResult.metadata,
        results: searchResult.results.map(r => ({
          content: r.content.substring(0, 200) + "...",
          similarity: r.similarity,
          documentTitle: r.document?.title,
          documentId: r.documentId,
          chunkIndex: r.chunkIndex,
        })),
        context: searchResult.context ? searchResult.context.substring(0, 500) + "..." : null,
        error: searchResult.error,
      } : null,
    });

  } catch (error) {
    console.error("[Knowledge Search API] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
