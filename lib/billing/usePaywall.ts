"use client";

import { useState, useCallback } from "react";

interface PaywallState {
  isOpen: boolean;
  type: "plan_required" | "insufficient_tokens";
  featureName?: string;
  currentPlan?: string;
  requiredPlan?: string;
  balance?: number;
  cost?: number;
}

const initialState: PaywallState = {
  isOpen: false,
  type: "plan_required",
};

/**
 * 페이월 훅
 *
 * 사용법:
 * ```tsx
 * const { paywallProps, checkAndConsume, showPaywall } = usePaywall();
 *
 * const handleClick = async () => {
 *   const ok = await checkAndConsume("ai_chat");
 *   if (!ok) return; // 페이월 모달이 자동으로 표시됨
 *   // 기능 실행
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleClick}>AI 상담</button>
 *     <PaywallModal {...paywallProps} />
 *   </>
 * );
 * ```
 */
export function usePaywall() {
  const [state, setState] = useState<PaywallState>(initialState);

  const close = useCallback(() => {
    setState(initialState);
  }, []);

  const showPaywall = useCallback((data: Omit<PaywallState, "isOpen">) => {
    setState({ ...data, isOpen: true });
  }, []);

  /**
   * 토큰 차감 시도.
   * 성공 시 true, 실패 시 false + 자동 페이월 표시
   */
  const checkAndConsume = useCallback(
    async (feature: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/tokens/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feature }),
        });

        if (res.ok) return true;

        const data = await res.json();

        if (data.code === "PLAN_REQUIRED") {
          setState({
            isOpen: true,
            type: "plan_required",
            featureName: data.featureName,
            currentPlan: data.currentPlan,
            requiredPlan: data.requiredPlan,
          });
          return false;
        }

        if (data.code === "INSUFFICIENT_TOKENS") {
          setState({
            isOpen: true,
            type: "insufficient_tokens",
            featureName: data.featureName,
            balance: data.balance,
            cost: data.cost,
          });
          return false;
        }

        // 기타 에러
        console.error("[Paywall]", data.error);
        return false;
      } catch (error) {
        console.error("[Paywall] Network error:", error);
        return false;
      }
    },
    []
  );

  return {
    paywallProps: {
      isOpen: state.isOpen,
      onClose: close,
      type: state.type,
      featureName: state.featureName,
      currentPlan: state.currentPlan,
      requiredPlan: state.requiredPlan,
      balance: state.balance,
      cost: state.cost,
    },
    checkAndConsume,
    showPaywall,
    closePaywall: close,
  };
}
