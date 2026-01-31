"use client";

import { useState } from "react";
import * as PortOne from "@portone/browser-sdk/v2";

interface PaymentRequest {
  orderName: string;
  amount: number;
  itemType: string;
}

interface PaymentResult {
  success: boolean;
  merchantUid?: string;
  amount?: number;
  receiptUrl?: string | null;
  error?: string;
}

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestPayment({
    orderName,
    amount,
    itemType,
  }: PaymentRequest): Promise<PaymentResult> {
    setLoading(true);
    setError(null);

    try {
      // 1. 서버에서 결제 준비 (merchantUid 발급)
      const prepareRes = await fetch("/api/payment/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderName, amount, itemType }),
      });

      const prepareData = await prepareRes.json();
      if (!prepareData.success) {
        throw new Error(prepareData.error || "결제 준비 실패");
      }

      const { merchantUid } = prepareData;

      // 2. PortOne V2 SDK 결제 요청
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

      if (!storeId || !channelKey) {
        throw new Error("결제 시스템이 설정되지 않았습니다.");
      }

      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId: merchantUid,
        orderName,
        totalAmount: amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
      });

      if (!response || response.code) {
        throw new Error(response?.message || "결제가 취소되었습니다.");
      }

      // 3. 서버 검증 (이중 검증)
      const completeRes = await fetch("/api/payment/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: response.paymentId,
          merchantUid,
        }),
      });

      const completeData = await completeRes.json();
      if (!completeData.success) {
        throw new Error(completeData.error || "결제 검증 실패");
      }

      return {
        success: true,
        merchantUid,
        amount: completeData.payment.amount,
        receiptUrl: completeData.payment.receiptUrl,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "결제 중 오류가 발생했습니다.";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }

  return { requestPayment, loading, error };
}
