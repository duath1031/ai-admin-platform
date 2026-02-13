export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/subsidy/deadlines
 * 마감임박 보조금 목록 (30일 이내 마감)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    // 마감 30일 이내 활성 프로그램
    const urgentPrograms = await prisma.subsidyProgram.findMany({
      where: {
        isActive: true,
        applicationEnd: {
          gte: now,
          lte: thirtyDaysLater,
        },
      },
      orderBy: { applicationEnd: "asc" },
    });

    // 사용자의 매칭 결과도 함께 조회
    const userMatches = await prisma.subsidyMatch.findMany({
      where: {
        userId: session.user.id,
        subsidyProgramId: { in: urgentPrograms.map((p) => p.id) },
      },
    });

    const matchMap = new Map(userMatches.map((m) => [m.subsidyProgramId, m]));

    const results = urgentPrograms.map((p) => {
      const match = matchMap.get(p.id);
      const daysLeft = Math.ceil(
        (p.applicationEnd!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: p.id,
        title: p.title,
        agency: p.agency,
        supportAmount: p.supportAmount,
        supportType: p.supportType,
        applicationEnd: p.applicationEnd,
        detailUrl: p.detailUrl,
        daysLeft,
        urgency: daysLeft <= 3 ? "critical" : daysLeft <= 7 ? "high" : daysLeft <= 14 ? "medium" : "low",
        match: match
          ? {
              id: match.id,
              matchScore: match.matchScore,
              isBookmarked: match.isBookmarked,
              isApplied: match.isApplied,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      total: results.length,
      critical: results.filter((r) => r.urgency === "critical").length,
      deadlines: results,
    });
  } catch (error) {
    console.error("[Subsidy Deadlines] Error:", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
