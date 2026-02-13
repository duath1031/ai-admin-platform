export const dynamic = 'force-dynamic';

/**
 * 인허가 신청서 AI 생성 API
 * POST /api/labor/application-form
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

// 인허가 유형 정의
const APPLICATION_TYPES: Record<string, { label: string; description: string; relatedLaws: string[] }> = {
  business_registration: {
    label: "사업자등록 신청/변경",
    description: "부가가치세법에 의한 사업자등록 신규 신청 또는 정정 신고",
    relatedLaws: [
      "부가가치세법 제8조 (사업자등록)",
      "부가가치세법 시행령 제11조 (사업자등록 신청 등)",
      "소득세법 제168조 (사업자등록 및 고유번호의 부여)",
      "법인세법 제111조 (사업자등록)",
    ],
  },
  food_business: {
    label: "식품영업 허가/신고",
    description: "식품위생법에 의한 식품제조, 식품접객업 등의 영업허가 또는 신고",
    relatedLaws: [
      "식품위생법 제37조 (영업허가 등)",
      "식품위생법 시행령 제21조 (영업의 종류)",
      "식품위생법 시행규칙 제40조 (영업허가의 신청 등)",
      "식품위생법 제36조 (시설기준)",
    ],
  },
  construction_permit: {
    label: "건설업 등록/변경",
    description: "건설산업기본법에 의한 건설업 등록, 변경 신고",
    relatedLaws: [
      "건설산업기본법 제9조 (건설업의 등록 등)",
      "건설산업기본법 시행령 제13조 (건설업의 등록기준)",
      "건설산업기본법 제16조 (등록사항의 변경신고 등)",
      "건설산업기본법 시행규칙 제6조 (건설업의 등록신청)",
    ],
  },
  manufacturing_permit: {
    label: "제조업 등록/인가",
    description: "산업집적법, 중소기업기본법 등에 의한 제조업 관련 등록 및 인가",
    relatedLaws: [
      "산업집적활성화 및 공장설립에 관한 법률 제13조 (공장설립등의 승인)",
      "산업집적활성화 및 공장설립에 관한 법률 시행령 제35조",
      "중소기업기본법 제2조 (중소기업자의 범위)",
      "산업안전보건법 제42조 (유해위험방지계획서의 제출 등)",
    ],
  },
  environment_permit: {
    label: "환경 관련 인허가",
    description: "대기환경보전법, 수질 및 수생태계 보전에 관한 법률 등에 의한 환경 인허가",
    relatedLaws: [
      "대기환경보전법 제23조 (배출시설의 설치허가 및 신고)",
      "물환경보전법 제33조 (배출시설의 설치허가 및 신고)",
      "환경영향평가법 제22조 (환경영향평가의 대상사업)",
      "폐기물관리법 제25조 (폐기물처리업의 허가 등)",
    ],
  },
  fire_safety: {
    label: "소방시설 관련",
    description: "소방시설 설치유지 및 안전관리에 관한 법률에 의한 소방 관련 인허가",
    relatedLaws: [
      "소방시설 설치 및 관리에 관한 법률 제6조 (건축허가등의 동의 등)",
      "소방시설공사업법 제4조 (소방시설공사업의 등록 등)",
      "화재의 예방 및 안전관리에 관한 법률 제25조 (소방안전관리자)",
      "다중이용업소의 안전관리에 관한 특별법 제9조 (소방시설등의 설치·유지)",
    ],
  },
  medical_business: {
    label: "의료기기/의약품 관련",
    description: "의료기기법, 약사법 등에 의한 의료기기 제조/수입/판매 관련 인허가",
    relatedLaws: [
      "의료기기법 제6조 (제조업허가 등)",
      "의료기기법 제15조 (수입업허가)",
      "약사법 제31조 (제조업의 허가 등)",
      "약사법 제42조 (약국 등의 개설등록)",
    ],
  },
  general: {
    label: "기타 일반 인허가",
    description: "위 카테고리에 해당하지 않는 기타 인허가 신청",
    relatedLaws: [
      "행정절차법 제17조 (처분의 신청)",
      "민원 처리에 관한 법률 제8조 (민원의 신청)",
      "전자정부법 제12조 (행정정보의 전자적 제공)",
      "행정기본법 제17조 (처분의 이의신청)",
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const {
      applicationType,
      applicantName,
      applicantAddress,
      bizRegNo,
      companyName,
      businessDetails,
      applicationReason,
      additionalInfo,
    } = body;

    // Validation
    if (!applicationType || !APPLICATION_TYPES[applicationType]) {
      return NextResponse.json(
        { error: "유효한 인허가 유형을 선택해주세요." },
        { status: 400 }
      );
    }
    if (!applicantName?.trim()) {
      return NextResponse.json(
        { error: "신청인(대표자) 이름은 필수입니다." },
        { status: 400 }
      );
    }
    if (!companyName?.trim()) {
      return NextResponse.json(
        { error: "회사명은 필수입니다." },
        { status: 400 }
      );
    }
    if (!applicationReason?.trim()) {
      return NextResponse.json(
        { error: "신청 사유는 필수입니다." },
        { status: 400 }
      );
    }

    const typeInfo = APPLICATION_TYPES[applicationType];

    const prompt = `당신은 대한민국 행정서류 작성 전문가(행정사)입니다. 아래 정보를 바탕으로 "${typeInfo.label}" 인허가 신청서를 공식 양식에 맞게 한국어로 작성해주세요.

[작성 규칙]
1. 해당 인허가 유형에 맞는 공식 신청서 형식을 정확히 따를 것
2. 문서 상단에 신청서 제목을 명확히 기재 (예: "○○ 허가(등록/신고) 신청서")
3. 신청서의 표준 구성요소를 포함할 것:
   - 문서번호 (공란)
   - 접수일자 (공란)
   - 신청인 정보 (성명, 주소, 생년월일/사업자등록번호)
   - 신청 대상 (업종, 시설, 사업 내용 등)
   - 신청 사유 및 목적
   - 첨부서류 목록 (해당 인허가에 필요한 일반적인 구비서류 나열)
   - 관련 법령 근거 조항 명시
   - 날짜, 신청인 서명란
   - 접수처 (해당 관청명)
4. 법령 근거를 본문 내에 반드시 인용할 것
5. 공식적이고 격식 있는 문체를 사용할 것
6. "위와 같이 신청합니다" 또는 "위와 같이 (허가/등록/신고)를 신청합니다" 문구를 포함할 것

[관련 법령 근거]
${typeInfo.relatedLaws.map((law, i) => `${i + 1}. ${law}`).join("\n")}

[신청 유형]
${typeInfo.label} - ${typeInfo.description}

[신청인 정보]
- 신청인(대표자): ${applicantName}
- 회사명(상호): ${companyName}
- 사업자등록번호: ${bizRegNo || "미기재"}
- 주소: ${applicantAddress || "미기재"}

[사업 내용 상세]
${businessDetails || "별도 기재 없음"}

[신청 사유]
${applicationReason}

${additionalInfo ? `[추가 참고사항]\n${additionalInfo}` : ""}

위 정보를 기반으로 해당 인허가 유형에 맞는 공식 신청서를 완성해주세요.
반드시 실무에서 사용할 수 있는 수준의 정확한 양식으로 작성하되, 첨부서류 목록도 해당 인허가에 일반적으로 필요한 서류를 구체적으로 나열해주세요.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error("AI 응답이 비어있습니다.");
    }

    return NextResponse.json({
      success: true,
      content,
      metadata: {
        applicationType,
        typeLabel: typeInfo.label,
        generatedAt: new Date().toISOString(),
        relatedLaws: typeInfo.relatedLaws,
      },
    });
  } catch (error) {
    console.error("[Application Form API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "인허가 신청서 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
