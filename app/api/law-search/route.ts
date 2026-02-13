export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchLegalInfo } from "@/lib/rag/lawService";
import { deductTokens } from "@/lib/token/tokenService";
import { checkFeatureAccess } from "@/lib/token/planAccess";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const access = await checkFeatureAccess(userId, "law_search");
    if (!access.allowed) {
      return NextResponse.json(
        { error: "플랜 업그레이드가 필요합니다.", requiredPlan: access.requiredPlan },
        { status: 403 }
      );
    }

    const { query } = await req.json();
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: "검색어를 입력해주세요." }, { status: 400 });
    }

    const deducted = await deductTokens(userId, "law_search");
    if (!deducted) {
      return NextResponse.json(
        { error: "토큰이 부족합니다.", required: 2000, redirect: "/token-charge" },
        { status: 402 }
      );
    }

    const result = await searchLegalInfo(query.trim());
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Law Search API] Error:", error);
    return NextResponse.json(
      { success: false, error: "법령 검색 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
