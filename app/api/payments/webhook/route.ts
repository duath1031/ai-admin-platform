/**
 * PortOne V2 웹훅 처리 API
 * POST /api/payments/webhook
 *
 * PortOne에서 결제 상태 변경 시 호출됨
 * - 결제 완료, 실패, 취소 등
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPayment as getPortOnePayment, verifyWebhookSignature } from "@/lib/billing/portoneClient";

export async function POST(request: NextRequest) {
  try {
    // 원본 body를 텍스트로 먼저 읽어 시그니처 검증에 사용
    const rawBody = await request.text();

    // Standard Webhooks 시그니처 검증
    const isValid = verifyWebhookSignature(rawBody, {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    });

    if (!isValid) {
      console.error("[Webhook] 시그니처 검증 실패 - 요청 거부");
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { type, data } = body;

    console.log(`[Webhook] 수신 (검증됨): type=${type}`, data ? JSON.stringify(data).slice(0, 200) : 'no data');

    // PortOne V2 웹훅 이벤트 타입 처리
    switch (type) {
      case "Transaction.Paid": {
        // 결제 완료
        const paymentId = data?.paymentId;
        if (!paymentId) break;

        // PortOne에서 실제 결제 정보 조회 (이중 검증)
        const portonePayment = await getPortOnePayment(paymentId);
        const amount = portonePayment?.amount?.total;
        const orderId = portonePayment?.merchantId || portonePayment?.customData?.orderId;

        if (orderId) {
          const payment = await prisma.payment.findUnique({
            where: { orderId },
          });

          if (payment && payment.status !== "PAID") {
            // 금액 검증
            if (amount && amount !== payment.amount) {
              console.error(
                `[Webhook] 금액 불일치! DB: ${payment.amount}, PortOne: ${amount}`
              );
              break;
            }

            await prisma.payment.update({
              where: { orderId },
              data: {
                status: "PAID",
                impUid: paymentId,
                method: portonePayment?.method?.type || null,
                approvedAt: new Date(),
                receiptUrl: portonePayment?.receiptUrl || null,
              },
            });

            console.log(`[Webhook] 결제 완료 처리: ${orderId}`);
          }
        }
        break;
      }

      case "Transaction.Failed": {
        // 결제 실패
        const paymentId = data?.paymentId;
        if (!paymentId) break;

        const portonePayment = await getPortOnePayment(paymentId);
        const orderId = portonePayment?.merchantId;

        if (orderId) {
          await prisma.payment.updateMany({
            where: { orderId, status: { not: "PAID" } },
            data: {
              status: "FAILED",
              failReason: portonePayment?.failReason || "결제 실패",
            },
          });

          // 구독 자동결제 실패 처리
          const payment = await prisma.payment.findUnique({
            where: { orderId },
            select: { subscriptionId: true },
          });

          if (payment?.subscriptionId) {
            const sub = await prisma.subscription.findUnique({
              where: { id: payment.subscriptionId },
            });
            if (sub) {
              const newRetry = (sub.retryCount || 0) + 1;
              await prisma.subscription.update({
                where: { id: sub.id },
                data: {
                  status: newRetry >= 3 ? "grace" : "past_due",
                  retryCount: newRetry,
                  gracePeriodEndsAt:
                    newRetry >= 3
                      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                      : undefined,
                },
              });
            }
          }

          console.log(`[Webhook] 결제 실패 처리: ${orderId}`);
        }
        break;
      }

      case "Transaction.Cancelled": {
        // 결제 취소
        const paymentId = data?.paymentId;
        if (!paymentId) break;

        const portonePayment = await getPortOnePayment(paymentId);
        const orderId = portonePayment?.merchantId;

        if (orderId) {
          await prisma.payment.updateMany({
            where: { orderId },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
            },
          });
          console.log(`[Webhook] 결제 취소 처리: ${orderId}`);
        }
        break;
      }

      default:
        console.log(`[Webhook] 미처리 이벤트: ${type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    // 웹훅은 항상 200 반환 (재전송 방지)
    return NextResponse.json({ success: false, error: String(error) });
  }
}
