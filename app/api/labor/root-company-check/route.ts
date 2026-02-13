/**
 * 뿌리기업 확인 AI 분석 API
 * POST /api/labor/root-company-check
 *
 * "뿌리산업 진흥과 첨단화에 관한 법률" 기준으로
 * 6대 뿌리기술(주조/금형/소성가공/용접/표면처리/열처리) 해당 여부를 AI가 분석합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "");

interface RootCompanyCheckInput {
  companyName: string;
  bizRegNo: string;
  industryCode: string;
  businessSector: string;
  manufacturingItems: string;
  factoryAddress: string;
  mainRawMaterials: string;
  employeeCount: number;
  hasFactoryRegistration: boolean;
}

interface RootCompanyResult {
  isRootCompany: "해당" | "미해당" | "부분해당";
  matchedTechnologies: string[];
  score: number;
  analysis: string;
  recommendations: string[];
  requiredDocuments: string[];
  benefits: string[];
}

const SYSTEM_PROMPT = `당신은 대한민국 "뿌리산업 진흥과 첨단화에 관한 법률" 전문 분석 AI입니다.

[뿌리산업 정의]
뿌리산업이란 제조업의 생산과정에 필수적으로 활용되는 공정기술을 보유한 산업으로,
「뿌리산업 진흥과 첨단화에 관한 법률」 제2조에 따라 다음 6대 뿌리기술을 의미합니다:

1. **주조(鑄造)**: 금속을 녹여 거푸집(주형)에 부어 형상을 만드는 기술
   - 해당 업종: 사형주조, 금형주조, 다이캐스팅, 정밀주조(로스트왁스), 원심주조, 연속주조
   - 관련 제품: 엔진블록, 실린더헤드, 밸브바디, 맨홀뚜껑, 공작기계부품

2. **금형(金型)**: 금속 재료를 이용하여 제품의 형상을 만들기 위한 틀을 제작하는 기술
   - 해당 업종: 프레스금형, 사출금형, 다이캐스트금형, 단조금형, 유리금형, 고무금형
   - 관련 제품: 자동차부품금형, 전자부품금형, 가전금형, 포장용기금형

3. **소성가공(塑性加工)**: 금속 재료에 힘을 가하여 원하는 형상으로 변형시키는 기술
   - 해당 업종: 프레스가공, 판금, 단조(鍛造), 압출, 인발, 전조, 냉간/열간 성형
   - 관련 제품: 자동차 차체부품, 볼트/너트, 기어, 배관부품, 알루미늄 프로파일

4. **용접(熔接)**: 금속 재료를 열이나 압력으로 접합하는 기술
   - 해당 업종: 아크용접, TIG/MIG 용접, 레이저용접, 전자빔용접, 마찰용접, 저항용접, 브레이징
   - 관련 제품: 철구조물, 압력용기, 배관, 선박부품, 자동차부품

5. **표면처리(表面處理)**: 금속/비금속 표면에 기능성을 부여하는 기술
   - 해당 업종: 도금(전기도금, 무전해도금), 도장, 양극산화, PVD/CVD, 열용사, 화성처리
   - 관련 제품: 전자부품, 자동차 외장부품, 반도체부품, 장식품, 방식(防蝕)처리부품

6. **열처리(熱處理)**: 금속 재료를 가열/냉각하여 물성을 변화시키는 기술
   - 해당 업종: 담금질, 뜨임, 풀림, 불림, 침탄, 질화, 고주파열처리, 진공열처리
   - 관련 제품: 기어, 베어링, 공구, 금형부품, 스프링, 체결부품

[분석 기준]
1. 기업의 주요 제조물품, 업종, 원자재를 종합적으로 분석합니다.
2. 6대 뿌리기술 중 해당하는 기술을 모두 식별합니다.
3. 직접 수행하는 기술뿐만 아니라, 핵심 공정으로 활용하는 경우도 포함합니다.
4. 뿌리기업 확인서 발급을 위한 실질적인 조언을 제공합니다.

[응답 형식]
반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 포함하지 마세요.
{
  "isRootCompany": "해당" | "미해당" | "부분해당",
  "matchedTechnologies": ["매칭된 뿌리기술명 배열"],
  "score": 0~100 (뿌리기업 해당 가능성 점수),
  "analysis": "상세 분석 텍스트 (업종, 제조공정, 뿌리기술 연관성 등을 서술)",
  "recommendations": ["뿌리기업 인증을 위한 개선/준비 권고사항 배열"],
  "requiredDocuments": ["뿌리기업 확인서 신청 시 필요한 서류 배열"],
  "benefits": ["뿌리기업 인증 시 받을 수 있는 혜택 배열"]
}

[판정 기준]
- "해당": 6대 뿌리기술 중 1개 이상을 주요 공정으로 직접 수행하며, 제조업 기반인 경우 (score 70 이상)
- "부분해당": 뿌리기술을 부분적으로 활용하거나, 추가 확인이 필요한 경우 (score 40~69)
- "미해당": 뿌리기술과 관련성이 낮거나, 서비스업 등 제조업이 아닌 경우 (score 39 이하)`;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body: RootCompanyCheckInput = await request.json();
    const {
      companyName,
      bizRegNo,
      industryCode,
      businessSector,
      manufacturingItems,
      factoryAddress,
      mainRawMaterials,
      employeeCount,
      hasFactoryRegistration,
    } = body;

    if (!companyName) {
      return NextResponse.json({ error: "기업명은 필수입니다." }, { status: 400 });
    }

    // Gemini 2.0 Flash로 분석
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    });

    const userPrompt = `다음 기업 정보를 분석하여 뿌리기업 해당 여부를 판정해주세요.

[기업 정보]
- 기업명: ${companyName}
- 사업자등록번호: ${bizRegNo || "미입력"}
- 업종 대분류: ${businessSector || "미입력"}
- 산업분류코드: ${industryCode || "미입력"}
- 주요 제조물품: ${manufacturingItems || "미입력"}
- 공장 소재지: ${factoryAddress || "미입력"}
- 주요 원자재: ${mainRawMaterials || "미입력"}
- 상시근로자 수: ${employeeCount || "미입력"}명
- 공장등록증 보유: ${hasFactoryRegistration ? "보유" : "미보유"}

위 정보를 기반으로 6대 뿌리기술(주조, 금형, 소성가공, 용접, 표면처리, 열처리) 해당 여부를 분석해주세요.`;

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;
    const aiResult = await model.generateContent(fullPrompt);
    const responseText = aiResult.response.text();

    // JSON 파싱
    let result: RootCompanyResult;
    try {
      // JSON 블록 추출 (```json ... ``` 또는 { ... })
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) ||
                        responseText.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        result = JSON.parse(jsonStr);
      } else {
        throw new Error("JSON 형식 응답을 받지 못했습니다.");
      }
    } catch (parseError) {
      console.error("[Root Company Check] JSON parse error:", parseError, "Raw:", responseText);
      // 파싱 실패 시 기본 응답 생성
      result = {
        isRootCompany: "미해당",
        matchedTechnologies: [],
        score: 0,
        analysis: responseText,
        recommendations: ["AI 분석 결과를 정확히 파싱하지 못했습니다. 다시 시도해주세요."],
        requiredDocuments: [],
        benefits: [],
      };
    }

    // 응답 검증 및 기본값 보정
    if (!result.matchedTechnologies) result.matchedTechnologies = [];
    if (!result.recommendations) result.recommendations = [];
    if (!result.requiredDocuments) result.requiredDocuments = [];
    if (!result.benefits) result.benefits = [];
    if (typeof result.score !== "number") result.score = 0;

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[Root Company Check API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "뿌리기업 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
