export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reviewWithGemini, type UserTier } from "@/lib/gemini";
import { CONTRACT_ANALYSIS_PROMPT } from "@/lib/systemPrompts";
import { deductTokens } from "@/lib/token/tokenService";
import { checkFeatureAccess, getUserPlanCode } from "@/lib/token/planAccess";

function planCodeToUserTier(planCode: string): UserTier {
  const map: Record<string, UserTier> = {
    starter: 'free', standard: 'basic', pro: 'professional', pro_plus: 'pro_plus'
  };
  return map[planCode] || 'free';
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const access = await checkFeatureAccess(userId, "contract_analysis");
    if (!access.allowed) {
      return NextResponse.json({ error: "플랜 업그레이드가 필요합니다.", requiredPlan: access.requiredPlan }, { status: 403 });
    }

    const { content, contractType } = await req.json();
    if (!content || content.trim().length < 100) {
      return NextResponse.json({ error: "계약서 내용이 너무 짧습니다. 최소 100자 이상 입력해주세요." }, { status: 400 });
    }

    const deducted = await deductTokens(userId, "contract_analysis");
    if (!deducted) {
      return NextResponse.json({ error: "토큰이 부족합니다.", required: 4000, redirect: "/token-charge" }, { status: 402 });
    }

    const planCode = await getUserPlanCode(userId);
    const userTier = planCodeToUserTier(planCode);

    const typeHint = contractType ? `\n[계약 유형 힌트: ${contractType}]` : "";
    const userContent = `다음 계약서를 분석해주세요:${typeHint}\n\n${content}`;

    const result = await reviewWithGemini(userContent, CONTRACT_ANALYSIS_PROMPT, userTier);

    // reviewWithGemini returns { analysis: string, suggestions: string[] }
    // Try to parse analysis as JSON for structured result
    let structured = null;
    try {
      const jsonMatch = result.analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structured = JSON.parse(jsonMatch[0]);
      }
    } catch {}

    if (structured) {
      return NextResponse.json({ success: true, ...structured });
    }

    // Fallback: return raw analysis
    return NextResponse.json({
      success: true,
      overallScore: 50,
      overallAssessment: result.analysis,
      contractType: contractType || "미분류",
      parties: [],
      summary: result.analysis.substring(0, 200),
      keyTerms: [],
      risks: [],
      missingClauses: [],
      recommendations: result.suggestions || [],
    });
  } catch (error) {
    console.error("[Contract Analysis API] Error:", error);
    return NextResponse.json({ error: "계약서 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
