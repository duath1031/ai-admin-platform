import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;

export async function generateDocument(
  type: string,
  inputData: Record<string, string>
): Promise<string> {
  const systemPrompt = getSystemPromptForDocumentType(type);

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `다음 정보를 바탕으로 ${getDocumentTypeName(type)}를 작성해주세요:\n\n${JSON.stringify(inputData, null, 2)}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content || "";
}

export async function chatWithAI(
  messages: { role: "user" | "assistant" | "system"; content: string }[]
): Promise<string> {
  const systemMessage = {
    role: "system" as const,
    content: `당신은 대한민국의 행정 절차와 민원 서류에 정통한 AI 행정사입니다.
사용자의 행정 관련 질문에 친절하고 정확하게 답변해주세요.
필요한 서류, 절차, 주의사항 등을 상세히 안내해주세요.
법적 조언이 필요한 경우 전문 변호사 상담을 권유하세요.`,
  };

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [systemMessage, ...messages],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || "";
}

export async function reviewDocument(
  content: string,
  documentType?: string
): Promise<{ analysis: string; suggestions: string[] }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `당신은 행정 서류 검토 전문가입니다.
제출된 서류를 분석하여 다음을 확인해주세요:
1. 필수 항목 누락 여부
2. 형식 오류
3. 내용 불일치 또는 모순
4. 법적/행정적 문제점
5. 개선 제안사항

JSON 형식으로 응답해주세요:
{
  "analysis": "전체적인 분석 내용",
  "suggestions": ["제안1", "제안2", ...]
}`,
      },
      {
        role: "user",
        content: `다음 ${documentType || "서류"}를 검토해주세요:\n\n${content}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const responseText = response.choices[0]?.message?.content || "";

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      analysis: responseText,
      suggestions: [],
    };
  }
}

function getSystemPromptForDocumentType(type: string): string {
  const prompts: Record<string, string> = {
    petition: `당신은 진정서 작성 전문가입니다.
진정서는 행정기관에 부당한 처분이나 불이익에 대해 시정을 요청하는 문서입니다.
법적 근거를 명시하고, 사실관계를 명확히 기술하며, 요청사항을 구체적으로 작성해주세요.
형식: 수신, 진정인 정보, 피진정인 정보, 진정 취지, 진정 이유, 증거자료, 날짜, 서명`,

    appeal: `당신은 탄원서 작성 전문가입니다.
탄원서는 재판부나 행정기관에 선처나 배려를 호소하는 문서입니다.
진정성 있는 어조로 작성하되, 구체적인 사정과 근거를 제시해주세요.
형식: 수신, 사건번호(해당시), 탄원인 정보, 탄원 대상자 관계, 탄원 취지, 탄원 사유, 날짜, 서명`,

    objection: `당신은 이의신청서 작성 전문가입니다.
이의신청서는 행정처분에 대해 재검토를 요청하는 공식 문서입니다.
법적 근거와 처분의 부당성을 논리적으로 기술해주세요.
형식: 수신, 이의신청인 정보, 원처분 내용, 이의신청 취지, 이의신청 이유, 증거자료, 날짜, 서명`,

    application: `당신은 각종 신청서 작성 전문가입니다.
신청 목적에 맞는 형식과 필수 기재사항을 정확히 작성해주세요.
형식: 수신, 신청인 정보, 신청 내용, 첨부서류 목록, 날짜, 서명`,
  };

  return prompts[type] || prompts.application;
}

function getDocumentTypeName(type: string): string {
  const names: Record<string, string> = {
    petition: "진정서",
    appeal: "탄원서",
    objection: "이의신청서",
    application: "신청서",
  };
  return names[type] || "서류";
}
