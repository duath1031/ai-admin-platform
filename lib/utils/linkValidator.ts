// 링크 유효성 검사 및 대체 링크 생성 유틸리티
// 국가법령정보센터 서식 링크 등 자주 깨지는 링크 처리

import { HIKOREA_LINKS, getHikoreaLink } from '../config/hikoreaLinks';

// =============================================================================
// 타입 정의
// =============================================================================

export interface LinkValidationResult {
  url: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
  responseTime?: number;
  checkedAt: Date;
}

export interface FallbackLink {
  original: string;
  fallback: string;
  type: 'search' | 'alternative' | 'hardcoded';
  description: string;
}

// =============================================================================
// 링크 유효성 검사
// =============================================================================

// 검사 제외 도메인 (항상 유효로 처리)
const SKIP_VALIDATION_DOMAINS = [
  'www.gov.kr',       // 정부24 (로그인 필요)
  'minwon.go.kr',     // 민원24
  'easylaw.go.kr',    // 찾기쉬운 생활법령
];

// 캐시 (메모리 기반, 15분 유효)
const validationCache = new Map<string, { result: LinkValidationResult; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15분

/**
 * URL 유효성 검사 (HEAD 요청)
 * 깨진 링크를 사용자에게 주기 전에 서버 사이드에서 체크
 */
export async function validateLink(url: string): Promise<LinkValidationResult> {
  const now = Date.now();

  // 1. 캐시 확인
  const cached = validationCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  // 2. 하이코리아 링크는 하드코딩된 URL 사용
  if (url.includes('hikorea.go.kr')) {
    const hikoreaLink = findHikoreaFallback(url);
    if (hikoreaLink) {
      const result: LinkValidationResult = {
        url: hikoreaLink,
        isValid: true,
        checkedAt: new Date(),
      };
      validationCache.set(url, { result, expiresAt: now + CACHE_TTL_MS });
      return result;
    }
  }

  // 3. 검사 제외 도메인 확인
  try {
    const urlObj = new URL(url);
    if (SKIP_VALIDATION_DOMAINS.some(d => urlObj.hostname.includes(d))) {
      const result: LinkValidationResult = {
        url,
        isValid: true, // 검사 스킵, 유효로 처리
        checkedAt: new Date(),
      };
      validationCache.set(url, { result, expiresAt: now + CACHE_TTL_MS });
      return result;
    }
  } catch {
    return {
      url,
      isValid: false,
      error: '잘못된 URL 형식',
      checkedAt: new Date(),
    };
  }

  // 4. HEAD 요청으로 유효성 검사
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkValidator/1.0)',
      },
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    const isValid = response.ok; // 200-299 범위

    const result: LinkValidationResult = {
      url,
      isValid,
      statusCode: response.status,
      responseTime,
      checkedAt: new Date(),
    };

    if (!isValid) {
      result.error = `HTTP ${response.status}`;
    }

    // 캐시 저장
    validationCache.set(url, { result, expiresAt: now + CACHE_TTL_MS });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    const result: LinkValidationResult = {
      url,
      isValid: false,
      error: errorMessage.includes('abort') ? '타임아웃' : errorMessage,
      responseTime: Date.now() - startTime,
      checkedAt: new Date(),
    };

    // 실패도 캐시 (더 짧은 시간)
    validationCache.set(url, { result, expiresAt: now + (5 * 60 * 1000) }); // 5분

    return result;
  }
}

/**
 * 여러 URL 일괄 검사
 */
export async function validateLinks(urls: string[]): Promise<Map<string, LinkValidationResult>> {
  const results = new Map<string, LinkValidationResult>();
  const promises = urls.map(async (url) => {
    const result = await validateLink(url);
    results.set(url, result);
  });

  await Promise.all(promises);
  return results;
}

// =============================================================================
// 대체 링크 생성
// =============================================================================

/**
 * 국가법령정보센터 검색 페이지 링크 생성
 */
export function generateLawSearchLink(lawName: string): string {
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=1&query=${encodeURIComponent(lawName)}`;
}

/**
 * 서식 검색 링크 생성
 */
export function generateFormSearchLink(lawName: string): string {
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=8&query=${encodeURIComponent(lawName)}`;
}

/**
 * 판례 검색 링크 생성
 */
export function generatePrecedentSearchLink(keyword: string): string {
  return `https://www.law.go.kr/LSW/precSc.do?menuId=7&query=${encodeURIComponent(keyword)}`;
}

/**
 * 유형별 대체 링크 생성
 */
export function generateFallbackLink(
  keyword: string,
  type: 'law' | 'form' | 'precedent' = 'law'
): string {
  switch (type) {
    case 'form':
      return generateFormSearchLink(keyword);
    case 'precedent':
      return generatePrecedentSearchLink(keyword);
    case 'law':
    default:
      return generateLawSearchLink(keyword);
  }
}

/**
 * 하이코리아 대체 링크 찾기
 */
function findHikoreaFallback(originalUrl: string): string | null {
  // URL에서 키워드 추출 시도
  const keywords = ['통합신청서', '신청서', '체류', '비자', '사증'];

  for (const keyword of keywords) {
    if (originalUrl.includes(keyword)) {
      const link = getHikoreaLink(keyword);
      if (link) return link.url;
    }
  }

  // 기본 하이코리아 서식 페이지
  return HIKOREA_LINKS.default?.url || 'https://www.hikorea.go.kr/board/BoardDownloadList.pt';
}

// =============================================================================
// 안전한 링크 제공
// =============================================================================

/**
 * 안전한 링크 제공 (검증 + 대체)
 * 깨진 링크 대신 항상 작동하는 링크를 반환
 */
export async function getSafeLink(
  originalUrl: string,
  lawName: string,
  type: 'law' | 'form' | 'precedent' = 'form'
): Promise<FallbackLink> {
  // 하이코리아 특수 처리
  if (originalUrl.includes('hikorea.go.kr')) {
    const hikoreaLink = findHikoreaFallback(originalUrl);
    if (hikoreaLink) {
      return {
        original: originalUrl,
        fallback: hikoreaLink,
        type: 'hardcoded',
        description: '하이코리아 공식 서식 페이지에서 다운로드 가능합니다.',
      };
    }
  }

  // 링크 검증
  const validation = await validateLink(originalUrl);

  if (validation.isValid) {
    return {
      original: originalUrl,
      fallback: originalUrl,
      type: 'alternative',
      description: '직접 다운로드 링크가 유효합니다.',
    };
  }

  // 대체 검색 링크 생성
  const fallbackUrl = generateFallbackLink(lawName, type);

  return {
    original: originalUrl,
    fallback: fallbackUrl,
    type: 'search',
    description: `직접 링크가 불안정하여 검색 페이지를 제공합니다. "${lawName}"을(를) 검색하세요.`,
  };
}

// =============================================================================
// 캐시 관리
// =============================================================================

/**
 * 캐시 초기화
 */
export function clearValidationCache(): void {
  validationCache.clear();
}

/**
 * 캐시 통계
 */
export function getCacheStats(): { size: number; validCount: number; invalidCount: number } {
  let validCount = 0;
  let invalidCount = 0;

  validationCache.forEach(({ result }) => {
    if (result.isValid) validCount++;
    else invalidCount++;
  });

  return {
    size: validationCache.size,
    validCount,
    invalidCount,
  };
}

// =============================================================================
// 시스템 점검용 함수
// =============================================================================

/**
 * 주요 서비스 URL 상태 점검
 */
export async function checkCriticalLinks(): Promise<{
  serviceName: string;
  url: string;
  status: 'ok' | 'error' | 'slow';
  responseTime?: number;
  error?: string;
}[]> {
  const criticalUrls = [
    { name: '국가법령정보센터', url: 'https://www.law.go.kr' },
    { name: '국가법령정보센터 API', url: 'https://www.law.go.kr/DRF/lawSearch.do?OC=test&target=law&type=XML&query=민법' },
    { name: '정부24', url: 'https://www.gov.kr' },
    { name: '토지이음', url: 'https://www.eum.go.kr' },
    { name: 'V-World API', url: 'https://api.vworld.kr' },
    { name: '하이코리아', url: 'https://www.hikorea.go.kr' },
  ];

  const results = await Promise.all(
    criticalUrls.map(async ({ name, url }) => {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        return {
          serviceName: name,
          url,
          status: response.ok ? (responseTime > 3000 ? 'slow' : 'ok') : 'error',
          responseTime,
        } as const;
      } catch (error) {
        return {
          serviceName: name,
          url,
          status: 'error' as const,
          error: error instanceof Error ? error.message : '연결 실패',
        };
      }
    })
  );

  return results;
}
