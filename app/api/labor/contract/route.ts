/**
 * 근로계약서 AI 생성 API
 * POST /api/labor/contract
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";

import { LABOR_CONTRACT_PROMPT } from "@/lib/systemPrompts";
import { reviewWithGemini } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const access = await checkFeatureAccess(session.user.id, "labor_contract");
    if (!access.allowed) {
      return NextResponse.json({
        error: `${access.requiredPlan} 이상 요금제에서 사용 가능합니다.`,
        requiredPlan: access.requiredPlan,
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      // 사업주 정보
      companyName, ownerName, bizRegNo, companyAddress,
      // 근로자 정보
      workerName, workerBirth, workerAddress, workerPhone,
      // 계약 조건
      contractType, // regular, contract, parttime
      contractStart, contractEnd,
      workplace, jobDescription,
      // 근무 조건
      workStartTime, workEndTime, breakTime,
      workDaysPerWeek, weeklyWorkHours,
      // 급여 조건
      monthlySalary, hourlyWage, payDay,
      overtimeRate, bonusInfo,
      // 기타
      probationPeriod, specialTerms,
    } = body;

    if (!companyName || !workerName || !contractType) {
      return NextResponse.json({ error: "사업주명, 근로자명, 계약유형은 필수입니다." }, { status: 400 });
    }

    const prompt = `${LABOR_CONTRACT_PROMPT}

다음 정보를 기반으로 근로계약서를 작성해주세요:

[사업주 정보]
- 사업장명: ${companyName}
- 대표자명: ${ownerName || "미입력"}
- 사업자등록번호: ${bizRegNo || "미입력"}
- 사업장 주소: ${companyAddress || "미입력"}

[근로자 정보]
- 성명: ${workerName}
- 생년월일: ${workerBirth || "미입력"}
- 주소: ${workerAddress || "미입력"}
- 연락처: ${workerPhone || "미입력"}

[계약 조건]
- 계약유형: ${contractType === "regular" ? "정규직" : contractType === "contract" ? "계약직" : "단시간(파트타임)"}
- 계약기간: ${contractStart || "미정"} ~ ${contractEnd || "정함이 없음"}
- 근무장소: ${workplace || "사업장"}
- 업무내용: ${jobDescription || "미정"}

[근무 조건]
- 근무시간: ${workStartTime || "09:00"} ~ ${workEndTime || "18:00"}
- 휴게시간: ${breakTime || "12:00~13:00 (1시간)"}
- 주 근무일수: ${workDaysPerWeek || 5}일
- 주 소정근로시간: ${weeklyWorkHours || 40}시간

[급여 조건]
- ${monthlySalary ? `월 급여: ${Number(monthlySalary).toLocaleString()}원` : `시급: ${Number(hourlyWage || 0).toLocaleString()}원`}
- 급여지급일: 매월 ${payDay || 25}일
- 연장근로수당: ${overtimeRate || "통상임금의 150%"}
- 상여금: ${bonusInfo || "별도 협의"}

[기타]
- 수습기간: ${probationPeriod || "없음"}
- 특약사항: ${specialTerms || "없음"}

위 정보를 기반으로 근로기준법을 준수하는 표준근로계약서를 작성해주세요. 빈 항목은 일반적인 내용으로 채워주세요.`;

    const contractText = await reviewWithGemini(prompt, "labor_contract");

    await deductTokens(session.user.id, "labor_contract");

    return NextResponse.json({
      success: true,
      data: {
        contractText,
        metadata: {
          contractType,
          companyName,
          workerName,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[Labor Contract API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "계약서 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
