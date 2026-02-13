export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/subsidy/bookmark
 * 보조금 매칭 결과 즐겨찾기 토글
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  try {
    const { matchId } = await req.json();
    if (!matchId) {
      return NextResponse.json({ error: "matchId 필요" }, { status: 400 });
    }

    const match = await prisma.subsidyMatch.findFirst({
      where: { id: matchId, userId: session.user.id },
    });

    if (!match) {
      return NextResponse.json({ error: "매칭 결과를 찾을 수 없습니다." }, { status: 404 });
    }

    const updated = await prisma.subsidyMatch.update({
      where: { id: matchId },
      data: { isBookmarked: !match.isBookmarked },
      include: { subsidyProgram: { select: { title: true, applicationEnd: true } } },
    });

    return NextResponse.json({
      success: true,
      isBookmarked: updated.isBookmarked,
      programTitle: updated.subsidyProgram.title,
    });
  } catch (error) {
    console.error("[Subsidy Bookmark] Error:", error);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * GET /api/subsidy/bookmark
 * 즐겨찾기한 보조금 목록 조회
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  try {
    const bookmarks = await prisma.subsidyMatch.findMany({
      where: {
        userId: session.user.id,
        isBookmarked: true,
      },
      include: {
        subsidyProgram: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const results = bookmarks.map((b) => ({
      id: b.id,
      matchScore: b.matchScore,
      matchedCriteria: b.matchedCriteria ? JSON.parse(b.matchedCriteria) : [],
      unmatchedCriteria: b.unmatchedCriteria ? JSON.parse(b.unmatchedCriteria) : [],
      isApplied: b.isApplied,
      appliedAt: b.appliedAt,
      program: {
        id: b.subsidyProgram.id,
        title: b.subsidyProgram.title,
        agency: b.subsidyProgram.agency,
        supportAmount: b.subsidyProgram.supportAmount,
        supportType: b.subsidyProgram.supportType,
        applicationEnd: b.subsidyProgram.applicationEnd,
        detailUrl: b.subsidyProgram.detailUrl,
      },
    }));

    return NextResponse.json({ success: true, bookmarks: results });
  } catch (error) {
    console.error("[Subsidy Bookmark] Error:", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
