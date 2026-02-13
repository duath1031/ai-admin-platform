import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

// Google Search Grounding 도구 (Gemini 2.0 호환 형식)
const GOOGLE_SEARCH_TOOL = { googleSearch: {} } as any;

// =============================================================================
// AI 모델 설정
// 사용자 등급에 따라 다른 모델 사용
// =============================================================================

export type UserTier = 'free' | 'basic' | 'professional' | 'pro_plus';

export interface ModelConfig {
  modelName: string;
  temperature: number;
  maxOutputTokens: number;
  description: string;
}

// 사용자 등급별 모델 설정
const MODEL_CONFIGS: Record<UserTier, ModelConfig> = {
  free: {
    modelName: 'gemini-2.0-flash',
    temperature: 0.6,
    maxOutputTokens: 4096,
    description: '무료 사용자용 - 빠른 응답'
  },
  basic: {
    modelName: 'gemini-2.0-flash',
    temperature: 0.5,
    maxOutputTokens: 8192,
    description: '기본 사용자용 - 확장된 응답'
  },
  professional: {
    modelName: 'gemini-2.0-flash',
    temperature: 0.4,
    maxOutputTokens: 16384,
    description: '전문가용 (행정사, 정부기관) - 상세하고 정확한 응답'
  },
  pro_plus: {
    modelName: 'gemini-2.0-flash',
    temperature: 0.3,
    maxOutputTokens: 32768,
    description: 'Pro Plus - 최대 성능, 최대 출력'
  },
};

// 대화 히스토리 관리: 너무 긴 대화는 최근 메시지만 유지
const MAX_HISTORY_MESSAGES = 40; // 최대 40개 메시지 (user+assistant 합산)
const KEEP_FIRST_MESSAGES = 2;   // 초기 컨텍스트 유지

export function trimConversationHistory(
  messages: { role: string; content: string }[]
): { role: string; content: string }[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;

  // 첫 2개(초기 컨텍스트) + 최근 메시지 유지
  const keepRecent = MAX_HISTORY_MESSAGES - KEEP_FIRST_MESSAGES;
  const firstPart = messages.slice(0, KEEP_FIRST_MESSAGES);
  const recentPart = messages.slice(-keepRecent);

  console.log(`[Gemini] 대화 히스토리 트리밍: ${messages.length}개 → ${firstPart.length + recentPart.length}개`);
  return [...firstPart, ...recentPart];
}

// 전문가용 시스템 프롬프트 추가 지침
const PROFESSIONAL_SYSTEM_PROMPT_SUFFIX = `

[전문가 모드 활성화]
- 법률, 행정 관련 답변 시 관련 법령 조항을 명시하세요.
- 민원 처리 절차를 단계별로 상세히 안내하세요.
- 필요한 구비서류와 수수료를 정확히 안내하세요.
- 처리 기한과 유의사항을 포함하세요.
- 담당 부서 및 연락처 정보를 제공하세요.
- 답변이 길어지더라도 끝까지 완성하세요. 절대 중간에 자르지 마세요.
- 복잡한 질문에는 목차/번호를 사용하여 체계적으로 답변하세요.
`;

// 사용자 등급에 따른 모델 설정 반환
function getModelConfig(userTier: UserTier = 'free'): ModelConfig {
  return MODEL_CONFIGS[userTier] || MODEL_CONFIGS.free;
}

// 시스템 프롬프트 강화 (전문가 등급인 경우)
function enhanceSystemPrompt(systemPrompt: string, userTier: UserTier): string {
  if (userTier === 'professional' || userTier === 'pro_plus') {
    return systemPrompt + PROFESSIONAL_SYSTEM_PROMPT_SUFFIX;
  }
  return systemPrompt;
}

export async function chatWithGemini(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  userTier: UserTier = 'free',
  enableGrounding: boolean = false
): Promise<string> {
  const config = getModelConfig(userTier);
  const enhancedPrompt = enhanceSystemPrompt(systemPrompt, userTier);

  const model = genAI.getGenerativeModel({
    model: config.modelName,
    systemInstruction: enhancedPrompt,
    generationConfig: {
      temperature: config.temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: config.maxOutputTokens,
    },
    ...(enableGrounding && { tools: [GOOGLE_SEARCH_TOOL] }),
  });

  // 대화 히스토리 트리밍
  const trimmedMessages = trimConversationHistory(messages);
  const chatHistory = trimmedMessages.slice(0, -1).map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  const chat = model.startChat({
    history: chatHistory,
  });

  const lastMessage = trimmedMessages[trimmedMessages.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response;

  return response.text();
}

export async function generateWithGemini(
  prompt: string,
  systemPrompt: string,
  userTier: UserTier = 'free'
): Promise<string> {
  const config = getModelConfig(userTier);
  const enhancedPrompt = enhanceSystemPrompt(systemPrompt, userTier);

  const model = genAI.getGenerativeModel({
    model: config.modelName,
    generationConfig: {
      temperature: config.temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: config.maxOutputTokens,
    }
  });

  const fullPrompt = `[시스템 지침]\n${enhancedPrompt}\n\n[사용자 요청]\n${prompt}`;
  const result = await model.generateContent(fullPrompt);
  const response = result.response;

  return response.text();
}

export async function reviewWithGemini(
  content: string,
  reviewPrompt: string,
  userTier: UserTier = 'free'
): Promise<{ analysis: string; suggestions: string[] }> {
  const config = getModelConfig(userTier);

  const model = genAI.getGenerativeModel({
    model: config.modelName,
    generationConfig: {
      temperature: config.temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: config.maxOutputTokens,
    }
  });

  const fullPrompt = `${reviewPrompt}\n\n${content}`;
  const result = await model.generateContent(fullPrompt);
  const responseText = result.response.text();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      analysis: responseText,
      suggestions: [],
    };
  } catch {
    return {
      analysis: responseText,
      suggestions: [],
    };
  }
}

// 모델 정보 조회 함수
export function getAvailableModels(): Record<UserTier, ModelConfig> {
  return MODEL_CONFIGS;
}

// 현재 사용자의 모델 정보 조회
export function getCurrentModelInfo(userTier: UserTier): ModelConfig {
  return getModelConfig(userTier);
}

// =============================================================================
// Knowledge Base 연동 (Gemini File API - Long Context)
// =============================================================================

export interface FileDataPart {
  fileData: {
    fileUri: string;
    mimeType: string;
  };
}

/**
 * Knowledge Base 문서를 포함한 Gemini 채팅
 * - 파일 URI를 fileData로 직접 전달 (NotebookLM 방식)
 * - Long Context로 전체 문서 내용 활용
 */
export async function chatWithKnowledge(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  knowledgeFiles: FileDataPart[] = [],
  userTier: UserTier = 'free',
  enableGrounding: boolean = false
): Promise<string> {
  const config = getModelConfig(userTier);
  const enhancedPrompt = enhanceSystemPrompt(systemPrompt, userTier);

  const modelName = knowledgeFiles.length > 0 ? 'gemini-2.0-flash' : config.modelName;

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: enhancedPrompt,
    generationConfig: {
      temperature: config.temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: config.maxOutputTokens,
    },
    ...(enableGrounding && { tools: [GOOGLE_SEARCH_TOOL] }),
  });

  // 대화 히스토리 트리밍
  const trimmedMessages = trimConversationHistory(messages);
  const lastMessage = trimmedMessages[trimmedMessages.length - 1];

  // Knowledge 파일이 있는 경우 generateContent 사용
  if (knowledgeFiles.length > 0) {
    console.log(`[Gemini] Knowledge 파일 ${knowledgeFiles.length}개와 함께 질의`);

    const conversationContext = trimmedMessages.slice(0, -1).length > 0
      ? `\n\n[이전 대화]\n${trimmedMessages.slice(0, -1).map(m =>
          `${m.role === 'assistant' ? 'AI' : '사용자'}: ${m.content}`
        ).join('\n\n')}\n\n[현재 질문]\n${lastMessage.content}`
      : lastMessage.content;

    const parts = [
      ...knowledgeFiles,
      { text: conversationContext },
    ];

    const result = await model.generateContent(parts);
    return result.response.text();
  }

  // Knowledge 파일이 없는 경우 기존 채팅 방식
  const chatHistory = trimmedMessages.slice(0, -1).map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  const chat = model.startChat({
    history: chatHistory,
  });

  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text();
}

/**
 * 단순 질의 (Knowledge 파일만으로 응답)
 */
export async function queryKnowledgeFiles(
  query: string,
  knowledgeFiles: FileDataPart[],
  systemPrompt: string = "제공된 문서를 참고하여 질문에 정확하게 답변하세요."
): Promise<string> {
  if (knowledgeFiles.length === 0) {
    return "참고할 문서가 없습니다.";
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4096,
    }
  });

  const parts = [
    ...knowledgeFiles,
    { text: query },
  ];

  const result = await model.generateContent(parts);
  return result.response.text();
}

/**
 * Knowledge Base 문서를 포함한 Gemini 스트리밍 채팅
 * - 실시간으로 응답을 스트리밍
 */
export async function* chatWithKnowledgeStream(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  knowledgeFiles: FileDataPart[] = [],
  userTier: UserTier = 'free',
  enableGrounding: boolean = false
): AsyncGenerator<string, void, unknown> {
  const config = getModelConfig(userTier);
  const enhancedPrompt = enhanceSystemPrompt(systemPrompt, userTier);
  const modelName = knowledgeFiles.length > 0 ? 'gemini-2.0-flash' : config.modelName;

  // 대화 히스토리 트리밍 (긴 대화 잘림 방지)
  const trimmedMessages = trimConversationHistory(messages);
  const lastMessage = trimmedMessages[trimmedMessages.length - 1];

  // Grounding 활성화 시도 → 실패 시 grounding 없이 재시도
  const attempts = enableGrounding ? [true, false] : [false];

  for (const useGrounding of attempts) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: enhancedPrompt,
        generationConfig: {
          temperature: config.temperature,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: config.maxOutputTokens,
        },
        ...(useGrounding && { tools: [GOOGLE_SEARCH_TOOL] }),
      });

      if (knowledgeFiles.length > 0) {
        console.log(`[Gemini Stream] Knowledge ${knowledgeFiles.length}개 + Grounding=${useGrounding}`);

        const conversationContext = trimmedMessages.slice(0, -1).length > 0
          ? `\n\n[이전 대화]\n${trimmedMessages.slice(0, -1).map(m =>
              `${m.role === 'assistant' ? 'AI' : '사용자'}: ${m.content}`
            ).join('\n\n')}\n\n[현재 질문]\n${lastMessage.content}`
          : lastMessage.content;

        const parts = [
          ...knowledgeFiles,
          { text: conversationContext },
        ];

        const result = await model.generateContentStream(parts);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            yield text;
          }
        }
        return;
      }

      // Knowledge 파일이 없는 경우
      const chatHistory = trimmedMessages.slice(0, -1).map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: chatHistory,
      });

      const result = await chat.sendMessageStream(lastMessage.content);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
      return; // 성공하면 종료
    } catch (error) {
      if (useGrounding && attempts.length > 1) {
        console.warn(`[Gemini Stream] Grounding 실패, grounding 없이 재시도:`, error);
        continue; // 다음 시도 (grounding 없이)
      }
      throw error; // 마지막 시도도 실패하면 에러 전파
    }
  }
}

export default genAI;
