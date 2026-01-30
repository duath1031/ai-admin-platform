import { GoogleGenerativeAI, DynamicRetrievalMode } from "@google/generative-ai";
import type { Tool } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

// Google Search Grounding 도구 (MODE_DYNAMIC: Gemini가 필요 시에만 검색)
const GOOGLE_SEARCH_TOOL: Tool = {
  googleSearchRetrieval: {
    dynamicRetrievalConfig: {
      mode: DynamicRetrievalMode.MODE_DYNAMIC,
      dynamicThreshold: 0.3,
    },
  },
} as Tool;

// =============================================================================
// AI 모델 설정
// 사용자 등급에 따라 다른 모델 사용
// =============================================================================

export type UserTier = 'free' | 'basic' | 'professional' | 'enterprise';

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
    temperature: 0.7,
    maxOutputTokens: 1024,
    description: '무료 사용자용 - 빠른 응답'
  },
  basic: {
    modelName: 'gemini-2.0-flash',
    temperature: 0.7,
    maxOutputTokens: 2048,
    description: '기본 사용자용 - 확장된 응답'
  },
  professional: {
    modelName: 'gemini-1.5-pro',
    temperature: 0.5,
    maxOutputTokens: 4096,
    description: '전문가용 (행정사, 정부기관) - 상세하고 정확한 응답'
  },
  enterprise: {
    modelName: 'gemini-1.5-pro',
    temperature: 0.3,
    maxOutputTokens: 8192,
    description: '기업/기관용 - 최대 성능'
  }
};

// 전문가용 시스템 프롬프트 추가 지침
const PROFESSIONAL_SYSTEM_PROMPT_SUFFIX = `

[전문가 모드 활성화]
- 법률, 행정 관련 답변 시 관련 법령 조항을 명시하세요.
- 민원 처리 절차를 단계별로 상세히 안내하세요.
- 필요한 구비서류와 수수료를 정확히 안내하세요.
- 처리 기한과 유의사항을 포함하세요.
- 담당 부서 및 연락처 정보를 제공하세요.
`;

// 사용자 등급에 따른 모델 설정 반환
function getModelConfig(userTier: UserTier = 'free'): ModelConfig {
  return MODEL_CONFIGS[userTier] || MODEL_CONFIGS.free;
}

// 시스템 프롬프트 강화 (전문가 등급인 경우)
function enhanceSystemPrompt(systemPrompt: string, userTier: UserTier): string {
  if (userTier === 'professional' || userTier === 'enterprise') {
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

  // systemInstruction을 사용하여 Google AI Studio "나의 지침"과 동일한 효과
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

  // 대화 내역을 Gemini 형식으로 변환
  const chatHistory = messages.slice(0, -1).map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  const chat = model.startChat({
    history: chatHistory,
  });

  // 마지막 사용자 메시지 전송
  const lastMessage = messages[messages.length - 1];
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

  // Long Context 지원 모델 사용 (gemini-2.0-flash)
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

  // 마지막 사용자 메시지
  const lastMessage = messages[messages.length - 1];

  // Knowledge 파일이 있는 경우 generateContent 사용
  if (knowledgeFiles.length > 0) {
    console.log(`[Gemini] Knowledge 파일 ${knowledgeFiles.length}개와 함께 질의`);

    // 파일 + 대화 기록 + 현재 질문 조합
    const conversationContext = messages.slice(0, -1).length > 0
      ? `\n\n[이전 대화]\n${messages.slice(0, -1).map(m =>
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
  const chatHistory = messages.slice(0, -1).map(msg => ({
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
  userTier: UserTier = 'free'
): AsyncGenerator<string, void, unknown> {
  const config = getModelConfig(userTier);
  const enhancedPrompt = enhanceSystemPrompt(systemPrompt, userTier);

  // Long Context 지원 모델 사용
  const modelName = knowledgeFiles.length > 0 ? 'gemini-2.0-flash' : config.modelName;

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: enhancedPrompt,
    generationConfig: {
      temperature: config.temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: config.maxOutputTokens,
    }
  });

  const lastMessage = messages[messages.length - 1];

  // Knowledge 파일이 있는 경우
  if (knowledgeFiles.length > 0) {
    console.log(`[Gemini Stream] Knowledge 파일 ${knowledgeFiles.length}개와 함께 스트리밍 질의`);

    const conversationContext = messages.slice(0, -1).length > 0
      ? `\n\n[이전 대화]\n${messages.slice(0, -1).map(m =>
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
  const chatHistory = messages.slice(0, -1).map(msg => ({
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
}

export default genAI;
