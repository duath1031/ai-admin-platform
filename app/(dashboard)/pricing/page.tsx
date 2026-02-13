"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Plan {
  id: string;
  planCode: string;
  displayName: string;
  price: number;
  credits: number;
  tokenQuota: number;
  features: string;
}

interface CurrentSub {
  subscription: {
    id: string;
    status: string;
  } | null;
  currentPlan: {
    planCode: string;
    displayName: string;
    price: number;
  };
}

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "AI 상담 1회",
    "서류 작성 1건",
    "전체 기능 미리보기",
    "(계정당 평생 1회)",
  ],
  standard: [
    "AI 상담 (1,000토큰/회)",
    "서류 작성 20건/월",
    "문서24/민원 접수 5건",
    "건축행정AI",
    "서류 검토",
    "보조금 기본 매칭",
    "월 100만 토큰",
  ],
  pro: [
    "Standard 전체 포함",
    "입찰 분석 (시뮬레이터)",
    "비자AI",
    "인증 진단",
    "정책자금 매칭",
    "계약서 AI 분석",
    "내용증명 작성",
    "4대보험 신고서",
    "급여명세서/근로계약서",
    "월 300만 토큰",
  ],
  pro_plus: [
    "Pro 전체 포함",
    "거래처(B2B) 50개 관리",
    "거래처별 서류함/대시보드",
    "거래처 기준 전체 기능 사용",
    "일괄 보조금매칭",
    "리포트 자동생성",
    "월 500만 토큰",
  ],
};

const PLAN_TARGET: Record<string, string> = {
  starter: "체험용",
  standard: "일반인, 소상공인",
  pro: "행정사, 기업담당자, 공무원",
  pro_plus: "전문행정사, 기업법무팀",
};

const PLAN_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  starter: { bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-100 text-gray-600" },
  standard: { bg: "bg-blue-50", border: "border-blue-300", badge: "bg-blue-100 text-blue-700" },
  pro: { bg: "bg-purple-50", border: "border-purple-400", badge: "bg-purple-100 text-purple-700" },
  pro_plus: { bg: "bg-amber-50", border: "border-amber-400", badge: "bg-amber-100 text-amber-700" },
};

// 월결제 가격
const MONTHLY_PRICES: Record<string, number> = {
  standard: 99000,
  pro: 165000,
  pro_plus: 300000,
};

// 연결제 월 환산 가격 (기존 DB 가격 = 연결제 기준)
const ANNUAL_MONTHLY_PRICES: Record<string, number> = {
  standard: 90000,
  pro: 150000,
  pro_plus: 250000,
};

// 할인율 표시 오버라이드 (실제 계산 대신 고정 표시)
const DISCOUNT_OVERRIDE: Record<string, number> = {
  pro_plus: 20,
};

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnnual, setIsAnnual] = useState(true); // 기본 연결제 (할인 표시)

  useEffect(() => {
    Promise.all([
      fetch("/api/plans").then((r) => r.json()),
      session ? fetch("/api/payments/subscription").then((r) => r.json()) : null,
    ]).then(([plansData, subData]) => {
      if (plansData.success) setPlans(plansData.plans);
      if (subData?.success) setCurrentSub(subData);
      setLoading(false);
    });
  }, [session]);

  const currentPlanCode = currentSub?.currentPlan?.planCode || "starter";

  const handleSubscribe = (planCode: string) => {
    if (!session) {
      router.push("/api/auth/signin");
      return;
    }
    router.push(`/subscription?plan=${planCode}&cycle=${isAnnual ? "annual" : "monthly"}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          AI 직원 1명, 월 {isAnnual ? "9만" : "9.9만"}원부터
        </h1>
        <p className="text-lg text-gray-500 mb-6">
          경리 + 노무사 + 행정사 + 입찰담당 + 경영컨설턴트의 역할을 AI가 대신합니다
        </p>

        {/* 월결제 / 연결제 토글 */}
        <div className="inline-flex items-center gap-3 bg-gray-100 rounded-full p-1">
          <button
            onClick={() => setIsAnnual(false)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              !isAnnual
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            월결제
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              isAnnual
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            연결제
            <span className="ml-1.5 text-xs text-green-600 font-bold">20% OFF</span>
          </button>
        </div>
        {isAnnual && (
          <p className="mt-2 text-sm text-green-600 font-medium">
            연결제 시 최대 20% 할인!
          </p>
        )}
      </div>

      {/* 요금제 카드 — 4열 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const colors = PLAN_COLORS[plan.planCode] || PLAN_COLORS.starter;
          const features = PLAN_FEATURES[plan.planCode] || [];
          const isCurrent = currentPlanCode === plan.planCode;
          const isPopular = plan.planCode === "pro";

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 ${colors.border} ${colors.bg} p-5 flex flex-col ${
                isPopular ? "ring-2 ring-purple-500 shadow-xl scale-[1.02]" : "shadow-md"
              } transition-all hover:shadow-lg`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    BEST
                  </span>
                </div>
              )}

              {/* 플랜명 + 대상자 */}
              <div className="mb-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                  {plan.displayName}
                </span>
                {PLAN_TARGET[plan.planCode] && (
                  <p className="text-xs text-gray-500 mt-1.5">{PLAN_TARGET[plan.planCode]}</p>
                )}
              </div>

              {/* 가격 */}
              <div className="mb-4">
                {plan.price === 0 ? (
                  <div className="text-2xl font-bold text-gray-900">무료</div>
                ) : (() => {
                  const monthlyPrice = MONTHLY_PRICES[plan.planCode] || plan.price;
                  const annualMonthly = ANNUAL_MONTHLY_PRICES[plan.planCode] || plan.price;
                  const displayPrice = isAnnual ? annualMonthly : monthlyPrice;
                  const savings = DISCOUNT_OVERRIDE[plan.planCode] || Math.round(((monthlyPrice - annualMonthly) / monthlyPrice) * 100);
                  return (
                    <>
                      {isAnnual && monthlyPrice > annualMonthly && (
                        <div className="text-sm text-gray-400 line-through mb-0.5">
                          월 {monthlyPrice.toLocaleString()}원
                        </div>
                      )}
                      <div className="text-2xl font-bold text-gray-900">
                        {displayPrice.toLocaleString()}
                        <span className="text-base font-normal text-gray-500">원</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {isAnnual ? `/월 (연 ${(annualMonthly * 12).toLocaleString()}원)` : "/월"}
                      </div>
                      {isAnnual && savings > 0 && (
                        <span className="inline-block mt-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          {savings}% 할인
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* 토큰 */}
              <div className="mb-4 py-1.5 px-2 bg-white/60 rounded-lg">
                <span className="text-xs text-gray-600">
                  {plan.tokenQuota === -1
                    ? "토큰 무제한"
                    : plan.tokenQuota < 10000
                    ? `${plan.tokenQuota.toLocaleString()} 토큰`
                    : `월 ${(plan.tokenQuota / 10000).toFixed(0)}만 토큰`}
                </span>
              </div>

              {/* 기능 목록 */}
              <ul className="space-y-2 mb-6 flex-1">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <svg
                      className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-xs text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA 버튼 */}
              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2.5 px-3 bg-gray-200 text-gray-500 text-sm font-medium rounded-xl cursor-not-allowed"
                >
                  현재 플랜
                </button>
              ) : plan.planCode === "starter" ? (
                <button
                  disabled
                  className="w-full py-2.5 px-3 border border-gray-300 text-gray-600 text-sm font-medium rounded-xl cursor-not-allowed"
                >
                  기본 제공
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.planCode)}
                  className={`w-full py-2.5 px-3 text-sm font-bold rounded-xl transition-colors shadow-lg ${
                    isPopular
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {currentSub?.subscription ? "플랜 변경" : "1일 무료 체험"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 건당 과금 안내 */}
      <div className="mt-12 bg-gray-50 rounded-2xl p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
          On-Demand (건당 과금)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">50,000원</div>
            <div className="text-gray-700 font-medium">대행접수 1건</div>
            <div className="text-sm text-gray-500 mt-1">전문가가 직접 민원 접수</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <div className="text-2xl font-bold text-green-600 mb-2">10,000원</div>
            <div className="text-gray-700 font-medium">토지분석 보고서</div>
            <div className="text-sm text-gray-500 mt-1">V-World + 건축물대장 통합</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <div className="text-2xl font-bold text-purple-600 mb-2">10,000원</div>
            <div className="text-gray-700 font-medium">인허가 진단 보고서</div>
            <div className="text-sm text-gray-500 mt-1">PDF 리포트 자동 생성</div>
          </div>
        </div>
      </div>

      {/* 토큰 비용표 */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
          기능별 토큰 사용량
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { name: "AI 상담", cost: "1,000" },
            { name: "서류 생성", cost: "3,000" },
            { name: "토지 조회", cost: "1,500" },
            { name: "법령 검색", cost: "2,000" },
            { name: "입찰 시뮬", cost: "2,000" },
            { name: "RPA 접수", cost: "5,000" },
            { name: "계약서 분석", cost: "4,000" },
            { name: "인증 진단", cost: "2,000" },
            { name: "정책자금", cost: "2,000" },
            { name: "보조금 매칭", cost: "2,000" },
          ].map((item) => (
            <div key={item.name} className="text-center py-3 px-2 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">{item.name}</div>
              <div className="text-sm font-bold text-gray-900">{item.cost}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
