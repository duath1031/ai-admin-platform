import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductTokens } from "@/lib/token/tokenService";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

/**
 * POST /api/subsidy/generate-application
 * 보조금 신청서 자동 대필 — 기업 데이터 + AI 분석으로 신청서 초안 생성
 * 토큰 차감: 5,000
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const userId = session.user.id;

  const access = await checkFeatureAccess(userId, "subsidy_matching");
  if (!access.allowed) {
    return NextResponse.json(
      { error: "플랜 업그레이드가 필요합니다.", requiredPlan: access.requiredPlan },
      { status: 403 }
    );
  }

  const deducted = await deductTokens(userId, "document_create", 5000);
  if (!deducted) {
    return NextResponse.json(
      { error: "토큰이 부족합니다.", required: 5000 },
      { status: 402 }
    );
  }

  const { programName, programInfo, applicationFields } = await req.json();

  try {
    const profile = await prisma.companyProfile.findFirst({
      where: { userId },
      include: { certifications: true, patents: true, performances: true },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "기업 프로필을 먼저 등록해주세요." },
        { status: 400 }
      );
    }

    const profileData = JSON.parse(
      JSON.stringify(profile, (_, v) => (typeof v === "bigint" ? Number(v) : v))
    );

    // 실적 요약
    const perfSummary = profileData.performances?.length
      ? profileData.performances
          .slice(0, 5)
          .map((p: { projectName: string; contractAmount: number }) =>
            `${p.projectName} (${p.contractAmount ? `${(p.contractAmount / 100000000).toFixed(1)}억` : "-"})`
          )
          .join(", ")
      : "없음";

    const prompt = `당신은 대한민국 정부 보조금/정책자금 신청서 전문 작성자입니다.

[기업 정보]
- 기업명: ${profileData.companyName || "○○주식회사"}
- 대표자: ${profileData.ownerName || "○○○"}
- 사업자번호: ${profileData.bizRegNo || "000-00-00000"}
- 주소: ${profileData.address || "미입력"}
- 업종: ${profileData.businessSector || profileData.bizType || "미입력"}
- 설립일: ${profileData.foundedDate || "미입력"}
- 직원수: ${profileData.employeeCount || 0}명
- 최근 매출: ${profileData.revenueYear1 ? `${(profileData.revenueYear1 / 100000000).toFixed(1)}억원` : "미입력"}
- R&D 투자: ${profileData.rndExpenditure ? `${(profileData.rndExpenditure / 100000000).toFixed(1)}억원` : "미입력"}
- 연구인력: ${profileData.researcherCount || 0}명
- 보유인증: ${profileData.certifications?.map((c: { certType: string }) => c.certType).join(", ") || "없음"}
- 특허: ${profileData.patents?.length || 0}건
- 주요 실적: ${perfSummary}
- 자본금: ${profileData.capital ? `${(profileData.capital / 100000000).toFixed(1)}억원` : "미입력"}

[대상 프로그램]
- 프로그램명: ${programName || "정부 보조금"}
${programInfo ? `- 상세: ${programInfo}` : ""}
${applicationFields ? `- 신청서 항목: ${applicationFields}` : ""}

위 기업 정보를 바탕으로 보조금 신청서 초안을 작성해주세요.

포함할 섹션:
1. **기업 개요** — 회사 소개, 주요 사업 내용, 경쟁력
2. **사업 목표** — 해당 보조금으로 달성할 목표
3. **사업 계획** — 구체적 실행 계획 (6개월~1년 기준)
4. **추진 일정표** — 월별 마일스톤 (표 형태)
5. **소요 예산** — 항목별 예산 산출 내역 (인건비, 재료비, 외주비 등)
6. **기대 효과** — 정량적 성과 지표 (매출증가, 고용창출, R&D 성과 등)
7. **기업 역량** — 수행 능력 증빙 (실적, 인력, 인프라)

작성 지침:
- 정부 공고 심사 기준에 맞는 전문적 어투
- 구체적 수치와 데이터 활용
- 정량적 목표를 명확히 제시
- 한국어로 작성`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: { maxOutputTokens: 8192 },
    });
    const result = await model.generateContent(prompt);
    const applicationDraft = result.response.text();

    // 서류 DB에 저장
    const document = await prisma.document.create({
      data: {
        userId,
        title: `${programName || "보조금"} 신청서 초안`,
        content: applicationDraft,
        type: "subsidy_application",
        status: "draft",
      },
    });

    // 크레딧 트랜잭션 기록
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: -5000,
        balance: 0,
        type: "token_deduction",
        description: `document_create - 보조금 신청서: ${programName || "보조금"}`,
      },
    });

    return NextResponse.json({
      success: true,
      documentId: document.id,
      programName: programName || "보조금 프로그램",
      applicationDraft,
      tokensUsed: 5000,
    });
  } catch (error) {
    console.error("[Subsidy Application] Error:", error);
    return NextResponse.json(
      { error: "신청서 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
