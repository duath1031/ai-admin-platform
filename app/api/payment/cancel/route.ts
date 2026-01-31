/**
 * 결제 취소 API
 * POST /api/payment/cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PORTONE_API_URL = "https://api.portone.io";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { merchantUid, reason } = body;

    if (!merchantUid) {
      return NextResponse.json(
        { error: "merchantUid는 필수입니다." },
        { status: 400 }
      );
    }

    // DB에서 결제 조회
    const payment = await prisma.payment.findUnique({
      where: { orderId: merchantUid },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "결제 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (payment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "결제 소유자가 일치하지 않습니다." },
        { status: 403 }
      );
    }

    if (payment.status !== "PAID") {
      return NextResponse.json(
        { error: `취소할 수 없는 결제 상태입니다. (상태: ${payment.status})` },
        { status: 400 }
      );
    }

    // PortOne V2 결제 취소 API 호출
    if (payment.impUid) {
      const secret = process.env.PORTONE_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: "결제 시스템 설정 오류" },
          { status: 500 }
        );
      }

      const cancelRes = await fetch(
        `${PORTONE_API_URL}/payments/${encodeURIComponent(payment.impUid)}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `PortOne ${secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: reason || "사용자 요청 취소",
          }),
        }
      );

      if (!cancelRes.ok) {
        const text = await cancelRes.text();
        console.error("[Payment Cancel] PortOne API error:", text);
        return NextResponse.json(
          { error: "결제 취소 처리 중 오류가 발생했습니다." },
          { status: 500 }
        );
      }
    }

    // DB 상태 업데이트
    const updatedPayment = await prisma.payment.update({
      where: { orderId: merchantUid },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        failReason: reason || "사용자 요청 취소",
      },
    });

    console.log(`[Payment Cancel] 결제 취소: ${merchantUid}`);

    return NextResponse.json({
      success: true,
      payment: {
        merchantUid: updatedPayment.orderId,
        status: updatedPayment.status,
      },
    });
  } catch (error) {
    console.error("[Payment Cancel] Error:", error);
    return NextResponse.json(
      { error: "결제 취소 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
