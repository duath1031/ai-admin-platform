/**
 * =============================================================================
 * Document Chunking Service
 * =============================================================================
 * 문서를 의미 단위(Chunk)로 분할하는 서비스
 * - Chunk Size: 1000자 (권장)
 * - Overlap: 200자 (문맥 유지)
 */

export interface Chunk {
  content: string;
  index: number;
  pageNumber?: number;
  sectionTitle?: string;
  tokenCount?: number;
}

export interface ChunkingOptions {
  chunkSize?: number;       // 청크 크기 (기본: 1000자)
  chunkOverlap?: number;    // 오버랩 크기 (기본: 200자)
  separators?: string[];    // 구분자 우선순위
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", "。", ". ", "! ", "? ", "; ", ", ", " "],
};

/**
 * 텍스트를 청크로 분할
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, chunkOverlap, separators } = opts;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // 텍스트 정리
  const cleanedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const chunks: Chunk[] = [];
  let currentPosition = 0;
  let chunkIndex = 0;

  while (currentPosition < cleanedText.length) {
    // 청크 끝 위치 계산
    let endPosition = Math.min(currentPosition + chunkSize, cleanedText.length);

    // 청크가 문장 중간에서 끊기지 않도록 구분자 찾기
    if (endPosition < cleanedText.length) {
      const searchText = cleanedText.slice(currentPosition, endPosition);
      let bestSplitPos = -1;

      // 구분자 우선순위대로 검색
      for (const separator of separators) {
        const lastIndex = searchText.lastIndexOf(separator);
        if (lastIndex > chunkSize * 0.5) { // 최소 50% 이상 채워야 함
          bestSplitPos = lastIndex + separator.length;
          break;
        }
      }

      if (bestSplitPos > 0) {
        endPosition = currentPosition + bestSplitPos;
      }
    }

    // 청크 추출
    const chunkContent = cleanedText.slice(currentPosition, endPosition).trim();

    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        index: chunkIndex,
        tokenCount: estimateTokenCount(chunkContent),
      });
      chunkIndex++;
    }

    // 다음 위치 (오버랩 적용)
    currentPosition = endPosition - chunkOverlap;

    // 무한 루프 방지
    if (currentPosition <= 0 && endPosition >= cleanedText.length) {
      break;
    }
    if (currentPosition < 0) {
      currentPosition = 0;
    }
  }

  return chunks;
}

/**
 * 페이지별 텍스트를 청크로 분할 (PDF용)
 */
export function chunkPages(
  pages: Array<{ pageNumber: number; text: string }>,
  options: ChunkingOptions = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allChunks: Chunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const pageChunks = chunkText(page.text, opts);

    for (const chunk of pageChunks) {
      allChunks.push({
        ...chunk,
        index: globalIndex,
        pageNumber: page.pageNumber,
      });
      globalIndex++;
    }
  }

  return allChunks;
}

/**
 * 섹션별 텍스트를 청크로 분할 (HWP/DOCX용)
 */
export function chunkSections(
  sections: Array<{ title?: string; content: string }>,
  options: ChunkingOptions = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allChunks: Chunk[] = [];
  let globalIndex = 0;

  for (const section of sections) {
    const sectionChunks = chunkText(section.content, opts);

    for (const chunk of sectionChunks) {
      allChunks.push({
        ...chunk,
        index: globalIndex,
        sectionTitle: section.title,
      });
      globalIndex++;
    }
  }

  return allChunks;
}

/**
 * 토큰 수 추정 (간단한 휴리스틱)
 * - 한글: 약 0.7 토큰/글자
 * - 영문: 약 0.25 토큰/글자
 */
export function estimateTokenCount(text: string): number {
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const otherChars = text.length - koreanChars;

  return Math.ceil(koreanChars * 0.7 + otherChars * 0.25);
}

/**
 * 청크 유효성 검사
 */
export function validateChunks(chunks: Chunk[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (chunks.length === 0) {
    issues.push("No chunks generated");
  }

  for (const chunk of chunks) {
    if (!chunk.content || chunk.content.trim().length === 0) {
      issues.push(`Empty chunk at index ${chunk.index}`);
    }
    if (chunk.content.length > 10000) {
      issues.push(`Chunk ${chunk.index} exceeds maximum size (${chunk.content.length} chars)`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * 청크 통계
 */
export function getChunkStats(chunks: Chunk[]): {
  totalChunks: number;
  totalCharacters: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  estimatedTokens: number;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      totalCharacters: 0,
      avgChunkSize: 0,
      minChunkSize: 0,
      maxChunkSize: 0,
      estimatedTokens: 0,
    };
  }

  const sizes = chunks.map(c => c.content.length);
  const totalCharacters = sizes.reduce((a, b) => a + b, 0);
  const estimatedTokens = chunks.reduce((a, c) => a + (c.tokenCount || 0), 0);

  return {
    totalChunks: chunks.length,
    totalCharacters,
    avgChunkSize: Math.round(totalCharacters / chunks.length),
    minChunkSize: Math.min(...sizes),
    maxChunkSize: Math.max(...sizes),
    estimatedTokens,
  };
}
