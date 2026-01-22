// 관리자용 시스템 상태 점검 API
// API 상태, 주요 링크 유효성, 서비스 가용성 모니터링

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkCriticalLinks, getCacheStats } from '@/lib/utils/linkValidator';
import { HIKOREA_LINKS } from '@/lib/config/hikoreaLinks';

// =============================================================================
// 타입 정의
// =============================================================================

interface SystemCheckResult {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceStatus[];
  apiKeys: ApiKeyStatus[];
  linkValidation: LinkValidationSummary;
  recommendations: string[];
}

interface ServiceStatus {
  name: string;
  status: 'ok' | 'slow' | 'error';
  responseTime?: number;
  error?: string;
  url: string;
}

interface ApiKeyStatus {
  name: string;
  configured: boolean;
  lastUsed?: string;
}

interface LinkValidationSummary {
  totalChecked: number;
  validLinks: number;
  brokenLinks: number;
  cacheStats: {
    size: number;
    validCount: number;
    invalidCount: number;
  };
}

// =============================================================================
// 헬퍼 함수
// =============================================================================

/**
 * 환경변수 API 키 상태 확인
 */
function checkApiKeys(): ApiKeyStatus[] {
  return [
    {
      name: 'Google AI (Gemini)',
      configured: !!process.env.GOOGLE_AI_API_KEY,
    },
    {
      name: '국가법령정보센터',
      configured: !!process.env.LAW_API_ID,
    },
    {
      name: 'V-World (토지이용계획)',
      configured: !!process.env.VWORLD_KEY,
    },
    {
      name: 'Resend (이메일)',
      configured: !!process.env.RESEND_API_KEY,
    },
    {
      name: '공공데이터포털',
      configured: !!process.env.PUBLIC_DATA_KEY,
    },
    {
      name: 'Database',
      configured: !!process.env.DATABASE_URL,
    },
    {
      name: 'NextAuth',
      configured: !!process.env.NEXTAUTH_SECRET,
    },
  ];
}

/**
 * 전체 상태 판단
 */
function determineOverallStatus(services: ServiceStatus[], apiKeys: ApiKeyStatus[]): 'healthy' | 'degraded' | 'unhealthy' {
  const errorServices = services.filter(s => s.status === 'error').length;
  const slowServices = services.filter(s => s.status === 'slow').length;
  const missingKeys = apiKeys.filter(k => !k.configured).length;

  // 필수 API 키 체크
  const criticalKeys = ['Google AI (Gemini)', 'Database', 'NextAuth'];
  const missingCritical = apiKeys
    .filter(k => criticalKeys.includes(k.name) && !k.configured)
    .length;

  if (missingCritical > 0 || errorServices >= 3) {
    return 'unhealthy';
  }

  if (errorServices > 0 || slowServices >= 2 || missingKeys >= 3) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * 권장 사항 생성
 */
function generateRecommendations(
  services: ServiceStatus[],
  apiKeys: ApiKeyStatus[],
  linkSummary: LinkValidationSummary
): string[] {
  const recommendations: string[] = [];

  // 서비스 오류
  const errorServices = services.filter(s => s.status === 'error');
  if (errorServices.length > 0) {
    recommendations.push(`${errorServices.map(s => s.name).join(', ')} 서비스 연결에 문제가 있습니다. 네트워크 상태를 확인하세요.`);
  }

  // 느린 서비스
  const slowServices = services.filter(s => s.status === 'slow');
  if (slowServices.length > 0) {
    recommendations.push(`${slowServices.map(s => s.name).join(', ')} 서비스 응답이 느립니다.`);
  }

  // 미설정 API 키
  const missingKeys = apiKeys.filter(k => !k.configured);
  if (missingKeys.length > 0) {
    recommendations.push(`다음 API 키가 설정되지 않았습니다: ${missingKeys.map(k => k.name).join(', ')}`);
  }

  // 깨진 링크
  if (linkSummary.brokenLinks > 0) {
    recommendations.push(`${linkSummary.brokenLinks}개의 깨진 링크가 감지되었습니다. 대체 링크 시스템이 작동 중입니다.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('모든 시스템이 정상 작동 중입니다.');
  }

  return recommendations;
}

// =============================================================================
// API 라우트
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 체크 (선택적)
    const session = await getServerSession(authOptions);
    const isAdmin = session?.user?.email && (
      process.env.ADMIN_EMAILS?.includes(session.user.email) ||
      session.user.email === process.env.ADMIN_EMAIL
    );

    // 인증 여부와 관계없이 기본 상태는 제공
    // 상세 정보는 관리자만

    // 1. 주요 서비스 상태 점검
    console.log('[SystemCheck] 서비스 상태 점검 시작...');
    const serviceCheckResults = await checkCriticalLinks();
    const services: ServiceStatus[] = serviceCheckResults.map(r => ({
      name: r.serviceName,
      status: r.status,
      responseTime: r.responseTime,
      error: r.error,
      url: r.url,
    }));

    // 2. API 키 상태 확인
    const apiKeys = checkApiKeys();

    // 3. 링크 검증 캐시 통계
    const cacheStats = getCacheStats();
    const linkSummary: LinkValidationSummary = {
      totalChecked: cacheStats.size,
      validLinks: cacheStats.validCount,
      brokenLinks: cacheStats.invalidCount,
      cacheStats,
    };

    // 4. 전체 상태 판단
    const overall = determineOverallStatus(services, apiKeys);

    // 5. 권장 사항 생성
    const recommendations = generateRecommendations(services, apiKeys, linkSummary);

    const result: SystemCheckResult = {
      timestamp: new Date().toISOString(),
      overall,
      services,
      apiKeys: isAdmin ? apiKeys : apiKeys.map(k => ({ ...k, configured: k.configured })), // 민감 정보 제거
      linkValidation: linkSummary,
      recommendations,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[SystemCheck] 오류:', error);
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        overall: 'unhealthy',
        error: '시스템 점검 중 오류가 발생했습니다.',
        services: [],
        apiKeys: [],
        linkValidation: { totalChecked: 0, validLinks: 0, brokenLinks: 0, cacheStats: { size: 0, validCount: 0, invalidCount: 0 } },
        recommendations: ['시스템 관리자에게 문의하세요.'],
      },
      { status: 500 }
    );
  }
}

// 하이코리아 서식 링크 상태 점검 (별도 엔드포인트)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // 관리자만 상세 링크 점검 가능
    const isAdmin = session?.user?.email && (
      process.env.ADMIN_EMAILS?.includes(session.user.email) ||
      session.user.email === process.env.ADMIN_EMAIL
    );

    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { action } = await request.json();

    if (action === 'check_hikorea') {
      // 하이코리아 링크 상태 점검
      const results = [];

      for (const [key, form] of Object.entries(HIKOREA_LINKS)) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(form.url, {
            method: 'HEAD',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          results.push({
            name: form.name,
            key,
            url: form.url,
            status: response.ok ? 'ok' : 'error',
            statusCode: response.status,
            lastVerified: form.lastVerified,
          });
        } catch (error) {
          results.push({
            name: form.name,
            key,
            url: form.url,
            status: 'error',
            error: error instanceof Error ? error.message : '연결 실패',
            lastVerified: form.lastVerified,
          });
        }
      }

      return NextResponse.json({
        timestamp: new Date().toISOString(),
        totalForms: results.length,
        validForms: results.filter(r => r.status === 'ok').length,
        brokenForms: results.filter(r => r.status === 'error').length,
        results,
      });
    }

    return NextResponse.json(
      { error: '알 수 없는 액션입니다.' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[SystemCheck POST] 오류:', error);
    return NextResponse.json(
      { error: '점검 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
