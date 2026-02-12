/**
 * =============================================================================
 * AI Form Data Extraction API
 * =============================================================================
 * POST /api/ai/extract-form-data
 * 자연어 텍스트에서 폼 데이터 추출
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { deductTokens } from '@/lib/token/tokenService';
import { checkFeatureAccess } from '@/lib/token/planAccess';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 토큰 체크 (ai_chat 비용 적용 — 경량 AI 호출)
    const userId = session.user.id;
    const access = await checkFeatureAccess(userId, "ai_chat");
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: '플랜 업그레이드가 필요합니다.', requiredPlan: access.requiredPlan }, { status: 403 });
    }
    const deducted = await deductTokens(userId, "ai_chat");
    if (!deducted) {
      return NextResponse.json({ success: false, error: '토큰이 부족합니다.', required: 1000, redirect: '/token-charge' }, { status: 402 });
    }

    const body = await request.json();
    const { serviceCode, naturalInput, fields } = body;

    if (!naturalInput || !fields || fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'naturalInput과 fields가 필요합니다.' },
        { status: 400 }
      );
    }

    // 필드 목록 문자열 생성
    const fieldList = fields
      .map((f: { id: string; label: string }) => `- ${f.id}: ${f.label}`)
      .join('\n');

    // Gemini 프롬프트
    const prompt = `다음 텍스트에서 민원 신청에 필요한 정보를 추출해주세요.

서비스: ${serviceCode || '일반'}

필요한 필드:
${fieldList}

입력 텍스트:
"""
${naturalInput}
"""

응답 형식: 반드시 유효한 JSON 객체만 반환하세요. 추출된 필드의 id를 키로, 추출된 값을 value로 사용하세요.
추출할 수 없는 필드는 포함하지 마세요.

예시 응답:
{
  "companyName": "주식회사 어드미니",
  "representativeName": "홍길동",
  "phone": "02-1234-5678"
}`;

    // Gemini API 호출
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // JSON 추출 (마크다운 코드 블록 제거)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // 순수 JSON만 추출
    const jsonStartIndex = jsonStr.indexOf('{');
    const jsonEndIndex = jsonStr.lastIndexOf('}');
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      jsonStr = jsonStr.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    // JSON 파싱
    const extractedData = JSON.parse(jsonStr);

    console.log(`[AI Extract] Service: ${serviceCode}, Fields extracted: ${Object.keys(extractedData).length}`);

    return NextResponse.json({
      success: true,
      extractedData,
    });

  } catch (error) {
    console.error('[AI Extract] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI 추출 실패',
      },
      { status: 500 }
    );
  }
}
