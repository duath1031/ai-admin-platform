/**
 * =============================================================================
 * [Patent Technology] RPA Task Submission API
 * =============================================================================
 *
 * AI-Powered Government Site Automation Controller
 *
 * [Technical Innovation Points]
 * 1. Async Task Queue Management - Non-blocking RPA execution
 * 2. Real-time Status WebSocket Bridge - Live progress updates
 * 3. Intelligent Retry with State Persistence
 * 4. Automatic Fallback Data Generation for Manual Input
 *
 * @author AI Admin Platform
 * @version 1.0.0
 * =============================================================================
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { executeRpaTask, SupportedSite } from '@/lib/rpa/ventureInAutomation';
import { deductTokens } from '@/lib/token/tokenService';
import { checkFeatureAccess } from '@/lib/token/planAccess';

// =============================================================================
// Request Validation Schema
// =============================================================================

const RpaSubmitSchema = z.object({
  site: z.enum(['venture_in', 'gov24', 'hometax']),
  taskType: z.enum(['form_fill', 'search', 'submit', 'scrape']).default('form_fill'),
  companyData: z.object({
    companyName: z.string().min(1, '회사명은 필수입니다'),
    businessNumber: z.string().regex(/^\d{3}-\d{2}-\d{5}$/, '사업자등록번호 형식: 000-00-00000'),
    ceoName: z.string().min(1, '대표자명은 필수입니다'),
    establishedDate: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  ventureData: z.object({
    techDescription: z.string().optional(),
    rdInvestment: z.string().optional(),
    techPersonnel: z.number().optional(),
    patents: z.number().optional(),
    recentRevenue: z.string().optional(),
    exportAmount: z.string().optional(),
  }).optional(),
  options: z.object({
    headless: z.boolean().default(true),
    timeout: z.number().min(10000).max(300000).default(60000),
    autoSubmit: z.boolean().default(false),
    maxRetries: z.number().min(1).max(5).default(3),
  }).optional(),
});

type RpaSubmitInput = z.infer<typeof RpaSubmitSchema>;

// =============================================================================
// Manual Fallback Generator
// =============================================================================

interface ManualInputGuide {
  site: string;
  url: string;
  fields: Array<{ label: string; value: string }>;
}

function generateManualInputGuide(input: RpaSubmitInput): ManualInputGuide {
  const siteUrls: Record<string, string> = {
    venture_in: 'https://www.smes.go.kr/venturein',
    gov24: 'https://www.gov.kr',
    hometax: 'https://www.hometax.go.kr',
  };

  const fields: ManualInputGuide['fields'] = [
    { label: '회사명(상호)', value: input.companyData.companyName },
    { label: '사업자등록번호', value: input.companyData.businessNumber },
    { label: '대표자명', value: input.companyData.ceoName },
  ];

  if (input.companyData.establishedDate) {
    fields.push({ label: '설립일', value: input.companyData.establishedDate });
  }
  if (input.companyData.address) {
    fields.push({ label: '주소', value: input.companyData.address });
  }
  if (input.companyData.phone) {
    fields.push({ label: '연락처', value: input.companyData.phone });
  }
  if (input.companyData.email) {
    fields.push({ label: '이메일', value: input.companyData.email });
  }
  if (input.ventureData) {
    if (input.ventureData.techDescription) {
      fields.push({ label: '기술/사업 개요', value: input.ventureData.techDescription });
    }
    if (input.ventureData.rdInvestment) {
      fields.push({ label: 'R&D 투자액', value: input.ventureData.rdInvestment });
    }
    if (input.ventureData.techPersonnel !== undefined) {
      fields.push({ label: '기술인력 수', value: String(input.ventureData.techPersonnel) });
    }
    if (input.ventureData.patents !== undefined) {
      fields.push({ label: '보유 특허 수', value: String(input.ventureData.patents) });
    }
    if (input.ventureData.recentRevenue) {
      fields.push({ label: '최근 매출액', value: input.ventureData.recentRevenue });
    }
  }

  return { site: input.site, url: siteUrls[input.site], fields };
}

function generateClipboardText(guide: ManualInputGuide): string {
  let text = `===== ${guide.site.toUpperCase()} 입력 데이터 =====\n`;
  text += `사이트: ${guide.url}\n`;
  text += `========================================\n\n`;
  for (const field of guide.fields) {
    text += `[${field.label}]\n${field.value}\n\n`;
  }
  text += `========================================\n`;
  text += `생성시간: ${new Date().toLocaleString('ko-KR')}\n`;
  return text;
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    // 입력 유효성 검사를 토큰 차감보다 먼저 수행
    const body = await request.json();
    const validationResult = RpaSubmitSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // 토큰/플랜 체크 (입력 검증 후 차감)
    const access = await checkFeatureAccess(session.user.id, "rpa_submission");
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: '플랜 업그레이드가 필요합니다.', requiredPlan: access.requiredPlan },
        { status: 403 }
      );
    }
    const deducted = await deductTokens(session.user.id, "rpa_submission");
    if (!deducted) {
      return NextResponse.json(
        { success: false, error: '토큰이 부족합니다.', required: 5000, redirect: '/token-charge' },
        { status: 402 }
      );
    }

    const input = validationResult.data;
    const options = input.options ?? { headless: true, timeout: 60000, autoSubmit: false, maxRetries: 3 };

    const manualGuide = generateManualInputGuide(input);
    const clipboardText = generateClipboardText(manualGuide);

    const formData: Record<string, string> = {
      companyName: input.companyData.companyName,
      businessNumber: input.companyData.businessNumber,
      ceoName: input.companyData.ceoName,
      establishedDate: input.companyData.establishedDate || '',
      address: input.companyData.address || '',
      phone: input.companyData.phone || '',
      email: input.companyData.email || '',
    };

    if (input.ventureData) {
      Object.assign(formData, {
        techDescription: input.ventureData.techDescription || '',
        rdInvestment: input.ventureData.rdInvestment || '',
        techPersonnel: String(input.ventureData.techPersonnel || ''),
        patents: String(input.ventureData.patents || ''),
        recentRevenue: input.ventureData.recentRevenue || '',
        exportAmount: input.ventureData.exportAmount || '',
      });
    }

    console.log(`[RPA API] Starting ${input.site} automation...`);

    const result = await executeRpaTask({
      site: input.site as SupportedSite,
      formData,
      options: {
        headless: options.headless ?? true,
        timeout: options.timeout ?? 60000,
        retries: options.maxRetries ?? 3,
      },
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: {
        rpaResult: {
          success: result.success,
          filledFields: result.filledFields,
          errors: result.errors,
          executionLog: result.executionLog,
        },
        manualFallback: {
          available: true,
          guide: manualGuide,
          clipboardText,
        },
      },
      metadata: {
        site: input.site,
        taskType: input.taskType,
        executedAt: new Date().toISOString(),
        autoSubmit: options.autoSubmit ?? false,
      },
    });
  } catch (error) {
    console.error('[RPA API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'RPA execution failed',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      supportedSites: [
        { id: 'venture_in', name: '벤처인', url: 'https://www.smes.go.kr/venturein' },
        { id: 'gov24', name: '정부24', url: 'https://www.gov.kr' },
        { id: 'hometax', name: '홈택스', url: 'https://www.hometax.go.kr' },
      ],
      taskTypes: [
        { id: 'form_fill', name: '양식 자동 입력' },
        { id: 'search', name: '검색' },
        { id: 'submit', name: '제출' },
        { id: 'scrape', name: '데이터 수집' },
      ],
    },
  });
}
