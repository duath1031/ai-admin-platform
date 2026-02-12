import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { grantTokens } from "@/lib/token/tokenService";
import { prisma } from "@/lib/prisma";
import { payWithBillingKey } from "@/lib/billing/portoneClient";

/**
 * 추가 토큰 패키지
 * 실제 API 비용(Gemini/Claude) 대비 충분한 마진 확보
 * 예: 20,000원 패키지 → 실제 API 비용 ~3,000~6,000원 → 마진 70%+
 */
const TOKEN_PACKAGES: Record<
  string,
  { tokens: number; price: number; label: string; description: string }
> = {
  basic: {
    tokens: 100000,
    price: 10000,
    label: "10만 토큰",
    description: "AI 상담 100회 또는 서류작성 33건",
  },
  standard: {
    tokens: 300000,
    price: 20000,
    label: "30만 토큰",
    description: "AI 상담 300회 또는 서류작성 100건",
  },
  premium: {
    tokens: 1000000,
    price: 50000,
    label: "100만 토큰",
    description: "AI 상담 1,000회 또는 서류작성 333건",
  },
};

/** 주문번호 생성 */
function generateOrderId() {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `token_${ts}_${rand}`;
}

/**
 * POST: 토큰 패키지 구매 (빌링키 결제)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const userId = session.user.id;
  const { packageId } = await req.json();

  const pkg = TOKEN_PACKAGES[packageId];
  if (!pkg) {
    return NextResponse.json(
      { error: "유효하지 않은 패키지입니다." },
      { status: 400 }
    );
  }

  // 등록된 기본 빌링키 조회
  const billingKey = await prisma.billingKey.findFirst({
    where: { userId, isDefault: true },
  });

  if (!billingKey) {
    return NextResponse.json(
      { error: "등록된 결제수단이 없습니다. 먼저 카드를 등록해주세요.", needBillingKey: true },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, credits: true },
  });

  const orderId = generateOrderId();

  try {
    // PortOne 빌링키 결제
    const payResult = await payWithBillingKey({
      paymentId: orderId,
      billingKey: billingKey.billingKey,
      orderName: `Admini 토큰 충전 - ${pkg.label}`,
      amount: pkg.price,
      customerId: userId,
      customerName: user?.name || undefined,
      customerEmail: user?.email || undefined,
    });

    // 트랜잭션: 토큰 충전 + 결제 기록 + 크레딧 트랜잭션
    const result = await prisma.$transaction(async (tx) => {
      // 토큰 충전
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: pkg.tokens } },
        select: { credits: true },
      });

      // 결제 기록
      await tx.payment.create({
        data: {
          userId,
          orderId,
          paymentKey: payResult.paymentId || orderId,
          amount: pkg.price,
          itemType: "token_purchase",
          itemName: `토큰 충전 - ${pkg.label}`,
          status: "PAID",
          method: payResult.method?.type || "CARD",
          approvedAt: new Date(),
          receiptUrl: payResult.receiptUrl || null,
          impUid: payResult.paymentId || null,
        },
      });

      // 크레딧 트랜잭션 기록
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: pkg.tokens,
          balance: updatedUser.credits,
          type: "token_purchase",
          description: `토큰 충전 ${pkg.label} (${pkg.price.toLocaleString()}원)`,
        },
      });

      return updatedUser.credits;
    });

    return NextResponse.json({
      success: true,
      charged: pkg.tokens,
      price: pkg.price,
      balance: result,
      orderId,
    });
  } catch (error: unknown) {
    console.error("[Token Purchase] 결제 실패:", error);
    return NextResponse.json(
      { error: "결제에 실패했습니다. 카드 정보를 확인해주세요.", detail: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET: 토큰 패키지 목록 조회
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  // 현재 잔액도 함께 반환
  let balance = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true },
    });
    balance = user?.credits ?? 0;
  }

  return NextResponse.json({
    balance,
    packages: Object.entries(TOKEN_PACKAGES).map(([id, pkg]) => ({
      id,
      tokens: pkg.tokens,
      price: pkg.price,
      label: pkg.label,
      description: pkg.description,
      pricePerToken: (pkg.price / pkg.tokens).toFixed(4),
    })),
  });
}
