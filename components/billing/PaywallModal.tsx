"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "plan_required" | "insufficient_tokens";
  featureName?: string;
  currentPlan?: string;
  requiredPlan?: string;
  balance?: number;
  cost?: number;
}

const PLAN_DISPLAY: Record<string, { name: string; price: string; color: string }> = {
  starter: { name: "Starter", price: "무료", color: "text-gray-500" },
  standard: { name: "Standard", price: "90,000원/월", color: "text-blue-600" },
  pro: { name: "Pro", price: "150,000원/월", color: "text-purple-600" },
  pro_plus: { name: "Pro Plus", price: "220,000원/월", color: "text-amber-600" },
};

export default function PaywallModal({
  isOpen,
  onClose,
  type,
  featureName,
  currentPlan = "starter",
  requiredPlan = "standard",
  balance = 0,
  cost = 0,
}: PaywallModalProps) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  const required = PLAN_DISPLAY[requiredPlan] || PLAN_DISPLAY.standard;
  const current = PLAN_DISPLAY[currentPlan] || PLAN_DISPLAY.starter;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        closing ? "animate-fadeOut" : "animate-fadeIn"
      }`}
    >
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* 모달 */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 ${
          closing ? "animate-scaleOut" : "animate-scaleIn"
        }`}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {type === "plan_required" ? (
          <>
            {/* 플랜 업그레이드 필요 */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                요금제 업그레이드가 필요합니다
              </h3>
              <p className="text-gray-500 mt-2">
                <strong className="text-gray-900">{featureName || "이 기능"}</strong>은
                <span className={`font-semibold ${required.color}`}> {required.name}</span> 플랜부터 사용 가능합니다.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">현재 플랜</span>
                <span className={`text-sm font-medium ${current.color}`}>
                  {current.name} ({current.price})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">필요 플랜</span>
                <span className={`text-sm font-bold ${required.color}`}>
                  {required.name} ({required.price})
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  handleClose();
                  router.push("/pricing");
                }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-colors shadow-lg"
              >
                요금제 보기
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 토큰 부족 */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                토큰이 부족합니다
              </h3>
              <p className="text-gray-500 mt-2">
                <strong className="text-gray-900">{featureName || "이 기능"}</strong> 사용에
                <strong className="text-amber-600"> {cost.toLocaleString()}</strong> 토큰이 필요합니다.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">현재 잔액</span>
                <span className="text-sm font-bold text-red-500">
                  {balance.toLocaleString()} 토큰
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">필요 토큰</span>
                <span className="text-sm font-medium text-gray-900">
                  {cost.toLocaleString()} 토큰
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-500">부족분</span>
                <span className="text-sm font-bold text-red-600">
                  {Math.max(0, cost - balance).toLocaleString()} 토큰
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  handleClose();
                  router.push("/mypage");
                }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-colors shadow-lg"
              >
                토큰 충전하기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
