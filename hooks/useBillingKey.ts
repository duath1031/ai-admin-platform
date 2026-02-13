"use client";

import { useState } from "react";
import * as PortOne from "@portone/browser-sdk/v2";

interface BillingKeyResult {
  success: boolean;
  billingKey?: string;
  error?: string;
}

/**
 * PortOne V2 SDK를 통한 빌링키 발급 + 구독 생성 훅
 *
 * 플로우:
 * 1. PortOne.requestIssueBillingKey() → 카드 정보 입력 팝업
 * 2. 발급된 billingKey를 POST /api/payments/billing로 전송
 * 3. 서버에서 빌링키 저장 + 구독 생성 + 첫 결제
 */
export function useBillingKey() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issueBillingKey(): Promise<BillingKeyResult> {
    setLoading(true);
    setError(null);

    try {
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

      if (!storeId || !channelKey) {
        throw new Error("결제 시스템이 설정되지 않았습니다. 관리자에게 문의하세요.");
      }

      const response = await PortOne.requestIssueBillingKey({
        storeId,
        channelKey,
        billingKeyMethod: "CARD",
      });

      if (!response || response.code) {
        throw new Error(response?.message || "카드 등록이 취소되었습니다.");
      }

      if (!response.billingKey) {
        throw new Error("빌링키 발급에 실패했습니다.");
      }

      return { success: true, billingKey: response.billingKey };
    } catch (err) {
      const message = err instanceof Error ? err.message : "카드 등록 중 오류가 발생했습니다.";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }

  async function registerAndSubscribe(planCode: string): Promise<{
    success: boolean;
    subscription?: { id: string; planName: string; status: string; nextBillingDate: string };
    error?: string;
  }> {
    setLoading(true);
    setError(null);

    try {
      // 1. 빌링키 발급
      const keyResult = await issueBillingKey();
      if (!keyResult.success || !keyResult.billingKey) {
        return { success: false, error: keyResult.error };
      }

      // 2. 서버에 빌링키 + 구독 생성 요청
      const res = await fetch("/api/payments/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingKey: keyResult.billingKey,
          planCode,
          withTrial: false, // 바로 결제 시작
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "구독 생성에 실패했습니다.");
      }

      return {
        success: true,
        subscription: data.subscription,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "구독 처리 중 오류가 발생했습니다.";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }

  return { issueBillingKey, registerAndSubscribe, loading, error };
}
