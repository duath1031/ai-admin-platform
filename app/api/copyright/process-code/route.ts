/**
 * 소스코드 전처리 API (마스킹 + 30페이지 추출)
 * POST /api/copyright/process-code
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";
import { maskSecrets, extractPages } from "@/lib/copyright/copyrightHelper";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "copyright_code_process");
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: `${access.requiredPlan} 이상 요금제에서 사용 가능합니다.`,
          requiredPlan: access.requiredPlan,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { sourceCode, linesPerPage } = body;

    if (!sourceCode || typeof sourceCode !== "string") {
      return NextResponse.json({ error: "소스코드를 입력해주세요." }, { status: 400 });
    }

    if (sourceCode.length > 5_000_000) {
      return NextResponse.json({ error: "소스코드는 5MB 이하여야 합니다." }, { status: 400 });
    }

    // 1. 비밀정보 마스킹
    const maskResult = maskSecrets(sourceCode);

    // 2. 30페이지 추출
    const extractResult = extractPages(maskResult.maskedCode, linesPerPage || 50);

    // 토큰 차감
    await deductTokens(session.user.id, "copyright_code_process");

    return NextResponse.json({
      success: true,
      data: {
        maskedCode: maskResult.maskedCode,
        extractedCode: extractResult.extractedCode,
        stats: {
          totalLines: extractResult.totalLines,
          maskedCount: maskResult.maskedCount,
          maskedItems: maskResult.maskedItems,
          extractedPages: extractResult.pageCount,
          extractedLines: extractResult.extractedLines,
          sections: extractResult.sections,
        },
      },
    });
  } catch (error) {
    console.error("[Copyright Process Code API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "소스코드 전처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
