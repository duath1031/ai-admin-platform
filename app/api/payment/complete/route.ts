/**
 * 결제 완료 검증 API  [Critical - 이중 검증]
 * POST /api/payment/complete
 *
 * 1. DB에서 merchantUid로 Payment(READY) 조회
 * 2. PortOne V2 API로 실제 결제 금액 조회
 * 3. DB 금액과 PortOne 금액 일치 검증
 * 4. 불일치 시 즉시 결제 취소
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PORTONE_API_URL = "https://api.portone.io";

async function getPortOnePayment(paymentId: string) {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error("PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.");

  const res = await fetch(`${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${secret}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PortOne API 오류 (${res.status}): ${text}`);
  }

  return res.json();
}

async function cancelPortOnePayment(paymentId: string, reason: string) {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error("PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.");

  const res = await fetch(
    `${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `PortOne ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[Payment Cancel] PortOne cancel failed:", text);
  }

  return res.ok;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { paymentId, merchantUid } = body;

    if (!paymentId || !merchantUid) {
      return NextResponse.json(
        { error: "paymentId와 merchantUid는 필수입니다." },
        { status: 400 }
      );
    }

    // 1. DB에서 READY 상태 결제 조회
    const payment = await prisma.payment.findUnique({
      where: { orderId: merchantUid },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "주문 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (payment.status !== "READY") {
      return NextResponse.json(
        { error: `이미 처리된 결제입니다. (상태: ${payment.status})` },
        { status: 400 }
      );
    }

    if (payment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "결제 소유자가 일치하지 않습니다." },
        { status: 403 }
      );
    }

    // 2. PortOne V2 API로 실제 결제 정보 조회
    const portOnePayment = await getPortOnePayment(paymentId);

    // 3. 금액 검증 — DB 금액과 PortOne 실제 결제 금액 비교
    const paidAmount = portOnePayment.amount?.total;

    if (paidAmount !== payment.amount) {
      // 금액 불일치 → 즉시 취소
      console.error(
        `[Payment Complete] 금액 불일치! DB: ${payment.amount}, PortOne: ${paidAmount}, merchantUid: ${merchantUid}`
      );

      await cancelPortOnePayment(paymentId, "결제 금액 불일치 (위변조 의심)");

      await prisma.payment.update({
        where: { orderId: merchantUid },
        data: {
          status: "CANCELLED",
          impUid: paymentId,
          failReason: `금액 불일치: 요청 ${payment.amount}원, 실제 ${paidAmount}원`,
          cancelledAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: "결제 금액이 일치하지 않습니다. 결제가 자동 취소되었습니다." },
        { status: 400 }
      );
    }

    // 4. 금액 일치 → PAID 처리
    const receiptUrl = portOnePayment.receiptUrl || null;
    const method = portOnePayment.method?.type || portOnePayment.payMethod || null;

    const updatedPayment = await prisma.payment.update({
      where: { orderId: merchantUid },
      data: {
        status: "PAID",
        impUid: paymentId,
        method,
        receiptUrl,
        approvedAt: new Date(),
      },
    });

    console.log(`[Payment Complete] 결제 완료: ${merchantUid}, ${payment.amount}원`);

    return NextResponse.json({
      success: true,
      payment: {
        merchantUid: updatedPayment.orderId,
        amount: updatedPayment.amount,
        status: updatedPayment.status,
        receiptUrl: updatedPayment.receiptUrl,
      },
    });
  } catch (error) {
    console.error("[Payment Complete] Error:", error);
    const message = error instanceof Error ? error.message : "결제 검증 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
