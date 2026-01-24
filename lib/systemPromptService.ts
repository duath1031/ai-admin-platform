import { prisma } from "@/lib/prisma";
import { ADMINI_SYSTEM_PROMPT } from "@/lib/systemPrompts";

// 캐시 설정 (5분)
let cachedPrompt: { content: string; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * DB에서 활성 시스템 프롬프트를 가져옵니다.
 * DB에 프롬프트가 없으면 기본 프롬프트를 반환합니다.
 */
export async function getActiveSystemPrompt(): Promise<string> {
  // 캐시 확인
  if (cachedPrompt && Date.now() - cachedPrompt.fetchedAt < CACHE_TTL) {
    return cachedPrompt.content;
  }

  try {
    // 기본 프롬프트 우선 조회
    let prompt = await prisma.systemPrompt.findFirst({
      where: { isDefault: true, isActive: true },
      select: { content: true },
    });

    // 기본 프롬프트가 없으면 활성화된 첫 번째 프롬프트 사용
    if (!prompt) {
      prompt = await prisma.systemPrompt.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { content: true },
      });
    }

    // DB에 프롬프트가 없으면 기본 프롬프트 사용
    const content = prompt?.content || ADMINI_SYSTEM_PROMPT;

    // 캐시 업데이트
    cachedPrompt = { content, fetchedAt: Date.now() };

    return content;
  } catch (error) {
    console.error("[SystemPromptService] DB 조회 오류, 기본 프롬프트 사용:", error);
    return ADMINI_SYSTEM_PROMPT;
  }
}

/**
 * 캐시를 강제로 무효화합니다.
 * 관리자가 프롬프트를 수정했을 때 호출합니다.
 */
export function invalidatePromptCache(): void {
  cachedPrompt = null;
}
