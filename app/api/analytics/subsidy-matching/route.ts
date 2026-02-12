/**
 * 보조금 매칭 API
 * POST /api/analytics/subsidy-matching - 매칭 실행 (마스터 프로필 기반)
 * GET  /api/analytics/subsidy-matching - 저장된 매칭 결과 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runFundMatching, type CompanyDataForFund } from "@/lib/analytics/fundMatcher";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 마스터 프로필 로드
    const profile = await prisma.companyProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        certifications: { where: { isActive: true } },
        patents: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        {
          error: "기업 프로필이 등록되지 않았습니다.",
          code: "NO_PROFILE",
          message: "마스터 프로필을 먼저 등록해주세요.",
        },
        { status: 400 }
      );
    }

    // CompanyDataForFund 형태로 변환 (BigInt → Number 변환)
    const toNum = (v: bigint | number | null | undefined): number | undefined =>
      v != null ? Number(v) : undefined;

    const companyData: CompanyDataForFund = {
      foundedDate: profile.foundedDate,
      establishmentDate: profile.establishmentDate,
      employeeCount: profile.employeeCount ? Number(profile.employeeCount) : undefined,
      capital: toNum(profile.capital),
      revenueYear1: toNum(profile.revenueYear1) ?? null,
      revenueYear2: toNum(profile.revenueYear2) ?? null,
      rndExpenditure: toNum(profile.rndExpenditure) ?? null,
      researcherCount: profile.researcherCount ? Number(profile.researcherCount) : null,
      hasResearchInstitute: profile.hasResearchInstitute || false,
      hasRndDepartment: profile.hasRndDepartment || false,
      isExporter: profile.isExporter || false,
      exportAmount: toNum(profile.exportAmount) ?? null,
      businessSector: profile.businessSector,
      certifications: profile.certifications.map((c) => ({
        certType: c.certType,
        isActive: c.isActive,
      })),
      patents: profile.patents.map((p) => ({
        patentType: p.patentType,
        status: p.status,
      })),
    };

    // 기존 fundMatcher 엔진 + DB 보조금 프로그램 매칭
    const fundResults = runFundMatching(companyData);

    // DB의 보조금 프로그램도 매칭
    const subsidyPrograms = await prisma.subsidyProgram.findMany({
      where: {
        isActive: true,
        OR: [
          { applicationEnd: null },
          { applicationEnd: { gte: new Date() } },
        ],
      },
    });

    // 보조금 매칭 결과 DB 저장 (기존 것 업데이트)
    const savedMatches = [];
    for (const program of subsidyPrograms) {
      // 간단 매칭 (업종, 규모 기반)
      let score = 50; // 기본 점수
      const matched: string[] = [];
      const unmatched: string[] = [];

      // 업종 매칭
      if (program.targetIndustry) {
        try {
          const industries = JSON.parse(program.targetIndustry);
          if (
            Array.isArray(industries) &&
            industries.some(
              (ind: string) =>
                (profile.businessSector || "").includes(ind) ||
                (profile.bizType || "").includes(ind)
            )
          ) {
            score += 20;
            matched.push("업종 일치");
          } else {
            unmatched.push("업종 불일치");
          }
        } catch {
          // 문자열 비교
          if (
            (profile.businessSector || "").includes(program.targetIndustry) ||
            (profile.bizType || "").includes(program.targetIndustry)
          ) {
            score += 20;
            matched.push("업종 일치");
          }
        }
      }

      // 규모 매칭
      if (program.targetScale) {
        const employees = profile.employeeCount || 0;
        if (
          (program.targetScale.includes("소기업") && employees < 50) ||
          (program.targetScale.includes("중기업") && employees < 300) ||
          (program.targetScale.includes("중소기업") && employees < 300)
        ) {
          score += 15;
          matched.push("규모 적합");
        }
      }

      // 지역 매칭
      if (program.targetRegion && profile.address) {
        if (profile.address.includes(program.targetRegion)) {
          score += 10;
          matched.push("지역 일치");
        }
      }

      score = Math.min(100, score);

      const match = await prisma.subsidyMatch.upsert({
        where: {
          userId_subsidyProgramId: {
            userId: session.user.id,
            subsidyProgramId: program.id,
          },
        },
        update: {
          matchScore: score,
          matchedCriteria: JSON.stringify(matched),
          unmatchedCriteria: JSON.stringify(unmatched),
        },
        create: {
          userId: session.user.id,
          subsidyProgramId: program.id,
          matchScore: score,
          matchedCriteria: JSON.stringify(matched),
          unmatchedCriteria: JSON.stringify(unmatched),
        },
        include: { subsidyProgram: true },
      });
      savedMatches.push(match);
    }

    // 결과 정렬 (점수 높은 순)
    savedMatches.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({
      success: true,
      companyName: profile.companyName,
      profileCompleteness: profile.profileCompleteness,
      fundResults: fundResults.map((r) => ({
        programId: r.program.id,
        programName: r.program.name,
        agency: r.program.agency,
        maxAmount: r.program.maxAmount,
        supportType: r.program.supportType,
        matchScore: r.matchScore,
        matchLevel: r.matchLevel,
        metRequirements: r.metRequirements,
        unmetRequirements: r.unmetRequirements,
        recommendation: r.recommendation,
        website: r.program.website,
      })),
      subsidyMatches: savedMatches.map((m) => ({
        id: m.id,
        programTitle: m.subsidyProgram.title,
        agency: m.subsidyProgram.agency,
        supportAmount: m.subsidyProgram.supportAmount,
        supportType: m.subsidyProgram.supportType,
        applicationEnd: m.subsidyProgram.applicationEnd,
        matchScore: m.matchScore,
        matchedCriteria: m.matchedCriteria,
        unmatchedCriteria: m.unmatchedCriteria,
        isBookmarked: m.isBookmarked,
        detailUrl: m.subsidyProgram.detailUrl,
      })),
    });
  } catch (error) {
    console.error("[Subsidy Matching] Error:", error);
    return NextResponse.json(
      { error: "보조금 매칭 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookmarkedOnly = searchParams.get("bookmarked") === "true";

    const where: Record<string, unknown> = { userId: session.user.id };
    if (bookmarkedOnly) where.isBookmarked = true;

    const matches = await prisma.subsidyMatch.findMany({
      where,
      include: { subsidyProgram: true },
      orderBy: { matchScore: "desc" },
    });

    return NextResponse.json({
      success: true,
      matches: matches.map((m) => ({
        id: m.id,
        programTitle: m.subsidyProgram.title,
        agency: m.subsidyProgram.agency,
        supportAmount: m.subsidyProgram.supportAmount,
        supportType: m.subsidyProgram.supportType,
        applicationEnd: m.subsidyProgram.applicationEnd,
        matchScore: m.matchScore,
        matchedCriteria: m.matchedCriteria,
        unmatchedCriteria: m.unmatchedCriteria,
        isBookmarked: m.isBookmarked,
        isApplied: m.isApplied,
        detailUrl: m.subsidyProgram.detailUrl,
      })),
    });
  } catch (error) {
    console.error("[Subsidy Matching GET] Error:", error);
    return NextResponse.json(
      { error: "매칭 결과 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
