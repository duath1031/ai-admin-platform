export const dynamic = 'force-dynamic';

/**
 * 기업부설연구소 / 연구개발전담부서 적격성 진단 API
 * POST /api/labor/research-institute
 *
 * - KOITA(한국산업기술진흥협회) 인정 기준 기반 분석
 * - 기초연구진흥 및 기술개발지원에 관한 법률 근거
 * - Gemini 2.0 Flash AI 분석
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

interface RequestBody {
  companyName: string;
  bizRegNo: string;
  businessSector: string;
  employeeCount: number;
  researcherCount: number;
  rndExpenditure: number;
  revenueYear1: number;
  hasResearchInstitute: boolean;
  hasRndDepartment: boolean;
  researchFields: string;
  existingPatents: string;
  targetType: "institute" | "department";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body: RequestBody = await request.json();
    const {
      companyName,
      bizRegNo,
      businessSector,
      employeeCount,
      researcherCount,
      rndExpenditure,
      revenueYear1,
      hasResearchInstitute,
      hasRndDepartment,
      researchFields,
      existingPatents,
      targetType,
    } = body;

    // Validation
    if (!companyName || !targetType) {
      return NextResponse.json(
        { error: "기업명과 진단 유형(연구소/전담부서)은 필수입니다." },
        { status: 400 }
      );
    }

    const targetLabel = targetType === "institute" ? "기업부설연구소" : "연구개발전담부서";

    const prompt = `당신은 대한민국 기업부설연구소 및 연구개발전담부서 인정 전문 컨설턴트입니다.
"기초연구진흥 및 기술개발지원에 관한 법률"(기술개발촉진법) 및 KOITA(한국산업기술진흥협회) 인정 기준을 정확히 적용하여 기업의 적격성을 진단해주세요.

[인정 기준 요약]

■ 기업부설연구소 (연구소)
- 연구전담요원: 벤처/소기업 3명+, 중기업 5명+, 중견기업 7명+, 대기업 10명+
- 독립된 연구 공간 필수 (물리적 분리, 타 부서와 구분)
- 연구개발 활동 실적 (또는 계획서)
- 대표자 또는 임원이 연구전담요원으로 겸직 불가 (일부 예외)

■ 연구개발전담부서 (전담부서)
- 연구전담요원: 1명+ (소기업), 2명+ (중소기업), 3명+ (중견/대기업)
- 독립 공간 불요 (전담부서로 조직도에 명시되면 OK)
- 연구개발 활동 실적 (또는 계획서)

■ 연구전담요원 자격
- 이공계 학사 이상 학위 소지자
- 국가기술자격 기사 이상 소지자
- 해당 분야 연구경력 보유자 (전문학사+경력 등)
- 연구업무에 전념하는 상근 직원

■ 세제 혜택 (2026년 기준 주요항목)
- 연구인력개발비 세액공제 (조세특례제한법 제10조): 중소기업 25%, 중견 8%, 대기업 0~2%
- 연구개발 관련 출연금 등 과세특례
- 연구전담요원 소득세 감면 (연 500만원 한도)
- 연구소용 부동산 취득세/재산세 감면
- 관세 감면 (연구용 수입물품)
- 기업부설창작연구소(디자인) 추가 혜택
- R&D 설비투자 세액공제
- 병역특례 연구요원 배정 가능 (연구소에 한함)

[분석 대상 기업 정보]
- 기업명: ${companyName}
- 사업자등록번호: ${bizRegNo || "미입력"}
- 업종: ${businessSector || "미입력"}
- 전체 직원수: ${employeeCount || 0}명
- 연구전담요원 수: ${researcherCount || 0}명
- 연간 R&D 투자액: ${rndExpenditure ? Number(rndExpenditure).toLocaleString() + "원" : "미입력"}
- 최근 매출액: ${revenueYear1 ? Number(revenueYear1).toLocaleString() + "원" : "미입력"}
- 연구 분야: ${researchFields || "미입력"}
- 기존 특허/지식재산: ${existingPatents || "없음"}
- 현재 기업부설연구소 보유: ${hasResearchInstitute ? "있음" : "없음"}
- 현재 연구개발전담부서 보유: ${hasRndDepartment ? "있음" : "없음"}

[진단 대상]
${targetLabel}

[응답 형식]
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "eligible": "적격" | "부적격" | "조건부적격",
  "targetType": "${targetType}",
  "score": 0~100 (적격성 점수),
  "currentStatus": "현재 기업 상태에 대한 종합 분석 (3~5줄)",
  "gaps": [
    "부족한 요건 1 (구체적으로)",
    "부족한 요건 2"
  ],
  "requiredActions": [
    "필요 조치 1 (구체적인 실행 방법 포함)",
    "필요 조치 2"
  ],
  "benefits": [
    "혜택 1",
    "혜택 2"
  ],
  "taxBenefits": [
    "세제 혜택 1 (관련 법조항 포함)",
    "세제 혜택 2"
  ],
  "estimatedTimeline": "예상 소요기간 (KOITA 심사 포함)"
}

- gaps가 없으면 빈 배열 []
- 적격이면 score 80 이상, 조건부적격이면 50~79, 부적격이면 50 미만
- 각 항목은 한국어로 상세하게 작성
- taxBenefits에는 반드시 관련 법 조항을 명시`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error("AI 응답이 비어있습니다.");
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI 응답에서 JSON을 추출할 수 없습니다.");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("AI 응답 JSON 파싱 실패");
    }

    // Validate required fields and set defaults
    const resultData = {
      eligible: parsed.eligible || "부적격",
      targetType: parsed.targetType || targetType,
      score: typeof parsed.score === "number" ? parsed.score : 0,
      currentStatus: parsed.currentStatus || "분석 결과를 확인할 수 없습니다.",
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      requiredActions: Array.isArray(parsed.requiredActions) ? parsed.requiredActions : [],
      benefits: Array.isArray(parsed.benefits) ? parsed.benefits : [],
      taxBenefits: Array.isArray(parsed.taxBenefits) ? parsed.taxBenefits : [],
      estimatedTimeline: parsed.estimatedTimeline || "약 2~4주 (서류 준비 포함)",
    };

    return NextResponse.json({
      success: true,
      result: resultData,
    });
  } catch (error) {
    console.error("[Research Institute API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "적격성 진단 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
