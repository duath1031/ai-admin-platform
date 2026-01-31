/**
 * 결제 준비 API
 * POST /api/payment/prepare
 * Payment 레코드(READY)를 생성하고 merchantUid를 발급
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { orderName, amount, itemType } = body;

    if (!orderName || !amount || !itemType) {
      return NextResponse.json(
        { error: "orderName, amount, itemType은 필수입니다." },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "올바른 결제 금액을 입력하세요." },
        { status: 400 }
      );
    }

    // 주문번호 생성: order_{timestamp}_{random}
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const merchantUid = `order_${timestamp}_${random}`;

    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        orderId: merchantUid,
        amount,
        itemType,
        itemName: orderName,
        status: "READY",
      },
    });

    return NextResponse.json({
      success: true,
      merchantUid: payment.orderId,
      amount: payment.amount,
      orderName: payment.itemName,
    });
  } catch (error) {
    console.error("[Payment Prepare] Error:", error);
    return NextResponse.json(
      { error: "결제 준비 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
