import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductTokens } from "@/lib/token/tokenService";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { runFundMatching } from "@/lib/analytics/fundMatcher";

/**
 * POST /api/subsidy/match
 * 보조금 매칭 실행 — 마스터 프로필 기반 + DB 보조금 프로그램 + fundMatcher
 * 토큰 차감: 2,000
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const userId = session.user.id;

  // 플랜 접근 권한 체크
  const access = await checkFeatureAccess(userId, "subsidy_matching");
  if (!access.allowed) {
    return NextResponse.json(
      { error: "플랜 업그레이드가 필요합니다.", requiredPlan: access.requiredPlan },
      { status: 403 }
    );
  }

  // 토큰 차감 (2,000)
  const deducted = await deductTokens(userId, "subsidy_matching");
  if (!deducted) {
    return NextResponse.json(
      { error: "토큰이 부족합니다.", required: 2000 },
      { status: 402 }
    );
  }

  try {
    // 마스터 프로필 로드
    const profile = await prisma.companyProfile.findFirst({
      where: { userId },
      include: { certifications: true, patents: true },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "기업 프로필을 먼저 등록해주세요.", needProfile: true },
        { status: 400 }
      );
    }

    // BigInt → Number 변환
    const profileData = JSON.parse(
      JSON.stringify(profile, (_, v) => (typeof v === "bigint" ? Number(v) : v))
    );

    // 1) fundMatcher 엔진 (7개 정책자금)
    const fundResults = runFundMatching(profileData);

    // 2) DB 보조금 프로그램 매칭
    const activePrograms = await prisma.subsidyProgram.findMany({
      where: {
        isActive: true,
        OR: [
          { applicationEnd: null },
          { applicationEnd: { gte: new Date() } },
        ],
      },
    });

    const subsidyMatches = [];
    for (const program of activePrograms) {
      let score = 50; // 기본 점수
      const matched: string[] = [];
      const unmatched: string[] = [];

      // 업종 매칭
      if (program.targetIndustry) {
        try {
          const industries = JSON.parse(program.targetIndustry);
          if (Array.isArray(industries)) {
            const bizSector = profileData.businessSector || profileData.bizType || "";
            if (industries.some((ind: string) => bizSector.includes(ind) || ind.includes(bizSector))) {
              score += 20;
              matched.push("업종 일치");
            } else {
              unmatched.push("업종 불일치");
            }
          }
        } catch { /* skip */ }
      }

      // 규모 매칭
      if (program.targetScale) {
        const emp = profileData.employeeCount || 0;
        const scaleMatch =
          (program.targetScale.includes("소기업") && emp <= 50) ||
          (program.targetScale.includes("중기업") && emp <= 300) ||
          (program.targetScale.includes("중견기업") && emp <= 1000) ||
          program.targetScale.includes("전체");
        if (scaleMatch) {
          score += 15;
          matched.push("기업 규모 적합");
        } else {
          unmatched.push("기업 규모 부적합");
        }
      }

      // 지역 매칭
      if (program.targetRegion && profileData.address) {
        if (profileData.address.includes(program.targetRegion)) {
          score += 10;
          matched.push("소재지 일치");
        }
      }

      // 인증 보너스
      if (profileData.certifications?.length > 0) {
        score += 5;
        matched.push(`인증 ${profileData.certifications.length}건 보유`);
      }

      score = Math.min(score, 100);

      // DB 저장 (upsert)
      const match = await prisma.subsidyMatch.upsert({
        where: {
          userId_subsidyProgramId: {
            userId,
            subsidyProgramId: program.id,
          },
        },
        update: {
          matchScore: score,
          matchedCriteria: JSON.stringify(matched),
          unmatchedCriteria: JSON.stringify(unmatched),
        },
        create: {
          userId,
          subsidyProgramId: program.id,
          matchScore: score,
          matchedCriteria: JSON.stringify(matched),
          unmatchedCriteria: JSON.stringify(unmatched),
        },
        include: { subsidyProgram: true },
      });

      subsidyMatches.push({
        id: match.id,
        programTitle: program.title,
        agency: program.agency,
        supportAmount: program.supportAmount,
        supportType: program.supportType,
        applicationEnd: program.applicationEnd,
        detailUrl: program.detailUrl,
        matchScore: score,
        matchedCriteria: matched,
        unmatchedCriteria: unmatched,
        isBookmarked: match.isBookmarked,
        isApplied: match.isApplied,
      });
    }

    // 정렬 (점수 높은 순)
    subsidyMatches.sort((a, b) => b.matchScore - a.matchScore);
    const fundSorted = [...fundResults].sort((a, b) => b.matchScore - a.matchScore);

    // 총액 계산
    const allPrograms = [
      ...fundSorted.map((f) => ({
        title: f.program.name,
        maxAmount: f.program.maxAmount,
        matchScore: f.matchScore,
      })),
      ...subsidyMatches.map((s) => ({
        title: s.programTitle,
        maxAmount: s.supportAmount || "",
        matchScore: s.matchScore,
      })),
    ];
    const highMatchCount = allPrograms.filter((p) => p.matchScore >= 70).length;

    // 크레딧 트랜잭션 기록
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: -2000,
        balance: 0, // 실제 잔액은 deductTokens에서 처리됨
        type: "token_deduction",
        description: "subsidy_matching - 보조금 매칭 실행",
      },
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalPrograms: allPrograms.length,
        highMatchCount,
        fundProgramCount: fundSorted.length,
        dbProgramCount: subsidyMatches.length,
      },
      fundResults: fundSorted,
      subsidyMatches,
    });
  } catch (error) {
    console.error("[Subsidy Match] Error:", error);
    return NextResponse.json(
      { error: "보조금 매칭 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
