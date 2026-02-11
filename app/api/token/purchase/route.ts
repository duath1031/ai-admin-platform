import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { grantTokens } from "@/lib/token/tokenService";

// 토큰 패키지 정의
const TOKEN_PACKAGES: Record<string, { tokens: number; price: number }> = {
  small: { tokens: 50000, price: 5000 },
  medium: { tokens: 200000, price: 15000 },
  large: { tokens: 500000, price: 30000 },
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const { packageId } = await req.json();

  const pkg = TOKEN_PACKAGES[packageId];
  if (!pkg) {
    return NextResponse.json(
      { error: "유효하지 않은 패키지입니다." },
      { status: 400 }
    );
  }

  // TODO: 실제 결제 처리 (PortOne 빌링키 결제) 후 토큰 충전
  // 현재는 토큰만 충전 (결제 연동은 Task #3에서 구현)
  const newBalance = await grantTokens(session.user.id, pkg.tokens);

  return NextResponse.json({
    success: true,
    charged: pkg.tokens,
    balance: newBalance,
  });
}

export async function GET() {
  return NextResponse.json({
    packages: Object.entries(TOKEN_PACKAGES).map(([id, pkg]) => ({
      id,
      tokens: pkg.tokens,
      price: pkg.price,
      label: `${(pkg.tokens / 1000).toFixed(0)}K 토큰`,
    })),
  });
}
