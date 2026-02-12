/**
 * 보조금 북마크 토글 API
 * PATCH /api/analytics/subsidy-matching/bookmark
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { matchId, isBookmarked } = body;

    if (!matchId) {
      return NextResponse.json(
        { error: "matchId는 필수입니다." },
        { status: 400 }
      );
    }

    // 소유권 확인
    const match = await prisma.subsidyMatch.findFirst({
      where: { id: matchId, userId: session.user.id },
    });

    if (!match) {
      return NextResponse.json(
        { error: "매칭 결과를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const updated = await prisma.subsidyMatch.update({
      where: { id: matchId },
      data: { isBookmarked: isBookmarked ?? !match.isBookmarked },
    });

    return NextResponse.json({
      success: true,
      isBookmarked: updated.isBookmarked,
    });
  } catch (error) {
    console.error("[Subsidy Bookmark] Error:", error);
    return NextResponse.json(
      { error: "북마크 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
