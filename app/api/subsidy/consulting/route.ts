import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductTokens } from "@/lib/token/tokenService";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

/**
 * POST /api/subsidy/consulting
 * AI 전략 컨설팅 — 특정 보조금에 대한 합격 전략 + 액션 플랜
 * 토큰 차감: 3,000
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

  const deducted = await deductTokens(userId, "subsidy_matching", 3000);
  if (!deducted) {
    return NextResponse.json(
      { error: "토큰이 부족합니다.", required: 3000 },
      { status: 402 }
    );
  }

  const { subsidyMatchId, programName, programInfo } = await req.json();

  try {
    // 기업 프로필 로드
    const profile = await prisma.companyProfile.findFirst({
      where: { userId },
      include: { certifications: true, patents: true },
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

    // AI 컨설팅 프롬프트
    const prompt = `당신은 대한민국 정부 보조금/정책자금 전문 컨설턴트입니다.

[기업 정보]
- 기업명: ${profileData.companyName || "미입력"}
- 업종: ${profileData.businessSector || profileData.bizType || "미입력"}
- 설립일: ${profileData.foundedDate || profileData.establishmentDate || "미입력"}
- 직원수: ${profileData.employeeCount || 0}명
- 최근 매출: ${profileData.revenueYear1 ? `${(profileData.revenueYear1 / 100000000).toFixed(1)}억원` : "미입력"}
- R&D 투자: ${profileData.rndExpenditure ? `${(profileData.rndExpenditure / 100000000).toFixed(1)}억원` : "미입력"}
- 연구인력: ${profileData.researcherCount || 0}명
- 연구소/전담부서: ${profileData.hasResearchInstitute ? "있음" : "없음"}
- 보유인증: ${profileData.certifications?.map((c: { certType: string }) => c.certType).join(", ") || "없음"}
- 특허: ${profileData.patents?.length || 0}건
- 수출여부: ${profileData.isExporter ? "예" : "아니오"}

[대상 보조금/정책자금]
- 프로그램명: ${programName || "미지정"}
${programInfo ? `- 상세정보: ${programInfo}` : ""}

위 기업 정보를 바탕으로 해당 보조금/정책자금에 대해 아래 형식으로 분석해주세요:

## 1. 적격성 분석
- 해당 기업이 이 프로그램에 적합한지 분석
- 충족하는 요건과 미충족 요건을 구분

## 2. 합격 전략
- 심사에서 높은 점수를 받기 위한 전략 3~5가지
- 각 전략별 구체적 실행 방법

## 3. 보완이 필요한 항목
- 현재 부족한 부분과 보완 방법
- 예: "벤처인증 취득 시 가산점 +5점 가능"

## 4. 단계별 액션 플랜
- Step 1부터 신청 완료까지 타임라인
- 각 단계별 소요 기간과 준비물

## 5. 예상 경쟁률 및 성공 확률
- 해당 사업의 예상 경쟁률
- 이 기업의 예상 성공 확률 (%)

## 6. 주의사항
- 자주 발생하는 반려 사유
- 피해야 할 실수

한국어로 답변하고, 구체적인 법적 근거나 정부 공고 기준을 인용하세요.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    // 크레딧 트랜잭션 기록
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: -3000,
        balance: 0,
        type: "token_deduction",
        description: `subsidy_matching - AI 전략 컨설팅: ${programName || "보조금"}`,
      },
    });

    return NextResponse.json({
      success: true,
      programName: programName || "보조금 프로그램",
      analysis,
      tokensUsed: 3000,
    });
  } catch (error) {
    console.error("[Subsidy Consulting] Error:", error);
    return NextResponse.json(
      { error: "AI 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
