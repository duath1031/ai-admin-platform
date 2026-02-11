import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkBalance, deductTokens } from "./tokenService";
import { TOKEN_FEATURE_NAMES } from "@/lib/config/tokenCosts";

type ApiHandler = (
  req: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse>;

/**
 * API 라우트 래퍼 HOF
 * 잔액 체크 → 실행 → 토큰 차감
 *
 * Usage:
 *   export const POST = withTokenCheck("ai_chat", async (req) => {
 *     // ... your logic
 *     return NextResponse.json({ result });
 *   });
 */
export function withTokenCheck(feature: string, handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // 2. 잔액 확인
    const { sufficient, balance, cost } = await checkBalance(
      session.user.id,
      feature
    );

    if (!sufficient) {
      const featureName = TOKEN_FEATURE_NAMES[feature] || feature;
      return NextResponse.json(
        {
          error: "토큰이 부족합니다.",
          code: "INSUFFICIENT_TOKENS",
          details: {
            feature: featureName,
            required: cost,
            balance,
          },
        },
        { status: 402 }
      );
    }

    // 3. 핸들러 실행
    const response = await handler(req, context);

    // 4. 성공 시에만 토큰 차감 (4xx/5xx 응답은 차감하지 않음)
    if (response.status >= 200 && response.status < 300) {
      await deductTokens(session.user.id, feature);
    }

    return response;
  };
}
