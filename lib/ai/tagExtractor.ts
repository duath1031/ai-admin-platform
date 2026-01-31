/**
 * =============================================================================
 * Smart Tag Extractor - 문서 업로드 시 AI 태그 자동 추출
 * =============================================================================
 * Gemini-2.0-Flash로 문서를 분석하여:
 * - 핵심 키워드(태그) 추출
 * - 문서 요약 생성
 * - 카테고리 자동 분류
 *
 * 업로드 직후 비동기로 실행되어 tags/description 필드에 저장
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

// 시스템에서 사용하는 카테고리 목록
const KNOWN_CATEGORIES = [
  "출입국",
  "관광숙박",
  "인허가",
  "기업행정",
  "부동산",
  "교육",
  "위생",
  "조달",
  "건축",
  "법인",
];

export interface DocumentTagResult {
  tags: string[];
  summary: string;
  suggestedCategory: string;
}

/**
 * Gemini File URI를 사용하여 문서의 태그/요약/카테고리를 추출
 * - 업로드 완료 후 호출 (fileUri 필요)
 * - 실패 시 빈 결과 반환 (업로드 프로세스를 중단시키지 않음)
 */
export async function extractDocumentTags(
  fileUri: string,
  mimeType: string
): Promise<DocumentTagResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    const prompt = `당신은 대한민국 행정/법률 문서 분석 전문가입니다.
첨부된 문서를 분석하여 아래 JSON 형식으로 정보를 추출하세요.

## 추출 규칙

### tags (10~20개)
- 문서의 핵심 주제를 나타내는 한국어 키워드
- 행정/법률 전문 용어를 우선 포함 (예: 관광숙박업, 용도변경, 건축물대장)
- 관련 업종명 포함 (예: 호텔, 호스텔, 음식점, 카페)
- 관련 절차/행위 포함 (예: 허가, 신고, 등록, 변경, 폐업)
- 관련 법령명이 있으면 포함 (예: 관광진흥법, 식품위생법)
- 일반 사용자가 검색할 만한 키워드도 포함 (예: 창업, 개업)

### summary
- 문서 핵심 내용을 2~3문장으로 요약

### suggestedCategory
- 다음 중 가장 적합한 카테고리 하나 선택: ${KNOWN_CATEGORIES.join(", ")}
- 해당 없으면 "기타"

## 응답 형식 (JSON만 출력)
{
  "tags": ["키워드1", "키워드2", ...],
  "summary": "문서 요약 내용",
  "suggestedCategory": "카테고리"
}`;

    const parts = [
      { fileData: { fileUri, mimeType } },
      { text: prompt },
    ];

    console.log(`[TagExtractor] 태그 추출 시작: ${fileUri}`);
    const result = await model.generateContent(parts);
    const responseText = result.response.text();

    // JSON 파싱
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const tagResult: DocumentTagResult = {
        tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : [],
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        suggestedCategory: KNOWN_CATEGORIES.includes(parsed.suggestedCategory)
          ? parsed.suggestedCategory
          : "기타",
      };

      console.log(`[TagExtractor] 추출 완료: ${tagResult.tags.length}개 태그, 카테고리="${tagResult.suggestedCategory}"`);
      console.log(`[TagExtractor] 태그: ${tagResult.tags.join(", ")}`);

      return tagResult;
    }

    console.warn("[TagExtractor] JSON 파싱 실패 - 응답:", responseText.substring(0, 200));
    return { tags: [], summary: "", suggestedCategory: "기타" };

  } catch (error) {
    console.error("[TagExtractor] 태그 추출 오류:", error);
    return { tags: [], summary: "", suggestedCategory: "기타" };
  }
}
