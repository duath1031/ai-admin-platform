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
    "AI 상담 3회/월",
    "서류 작성 1건/월",
    "기본 서식 열람",
    "링크 안내",
  ],
  standard: [
    "AI 상담 무제한",
    "서류 작성 20건/월",
    "민원 자동접수 (문서24)",
    "인허가 자가진단",
    "서류 검토",
    "보조금 기본 매칭",
    "기한 알림",
    "월 100만 토큰",
  ],
  pro: [
    "Standard 전체 포함",
    "입찰 분석 (시뮬레이터)",
    "정책자금 상세 매칭",
    "인증 진단 (벤처/이노비즈)",
    "비자 계산기",
    "노무/HR 관리",
    "계약서 AI 분석",
    "월 300만 토큰",
  ],
  enterprise: [
    "Pro 전체 포함",
    "부동산 토지분석 리포트",
    "안전관리 (TBM)",
    "전용 API 연동",
    "화이트라벨",
    "전담 매니저",
    "커스텀 서식",
    "토큰 무제한",
  ],
};

const PLAN_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  starter: { bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-100 text-gray-600" },
  standard: { bg: "bg-blue-50", border: "border-blue-300", badge: "bg-blue-100 text-blue-700" },
  pro: { bg: "bg-purple-50", border: "border-purple-400", badge: "bg-purple-100 text-purple-700" },
  enterprise: { bg: "bg-amber-50", border: "border-amber-400", badge: "bg-amber-100 text-amber-700" },
};

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);
  const [loading, setLoading] = useState(true);

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
    // TODO: PortOne SDK 빌링키 발급 → /api/payments/billing 호출
    router.push(`/subscription?plan=${planCode}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          AI 직원 1명, 월 10만원부터
        </h1>
        <p className="text-lg text-gray-500">
          경리 + 노무사 + 행정사 + 입찰담당 + 경영컨설턴트의 역할을 AI가 대신합니다
        </p>
      </div>

      {/* 요금제 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const colors = PLAN_COLORS[plan.planCode] || PLAN_COLORS.starter;
          const features = PLAN_FEATURES[plan.planCode] || [];
          const isCurrent = currentPlanCode === plan.planCode;
          const isPopular = plan.planCode === "pro";

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 ${colors.border} ${colors.bg} p-6 flex flex-col ${
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

              {/* 플랜명 */}
              <div className="mb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                  {plan.displayName}
                </span>
              </div>

              {/* 가격 */}
              <div className="mb-6">
                {plan.price === 0 ? (
                  <div className="text-3xl font-bold text-gray-900">무료</div>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-gray-900">
                      {(plan.price / 1000).toFixed(0)}
                      <span className="text-lg font-normal text-gray-500">,000원</span>
                    </div>
                    <div className="text-sm text-gray-500">/월</div>
                  </>
                )}
              </div>

              {/* 토큰 */}
              <div className="mb-6 py-2 px-3 bg-white/60 rounded-lg">
                <span className="text-sm text-gray-600">
                  {plan.tokenQuota === -1
                    ? "토큰 무제한"
                    : `월 ${(plan.tokenQuota / 10000).toFixed(0)}만 토큰`}
                </span>
              </div>

              {/* 기능 목록 */}
              <ul className="space-y-3 mb-8 flex-1">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
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
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA 버튼 */}
              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-3 px-4 bg-gray-200 text-gray-500 font-medium rounded-xl cursor-not-allowed"
                >
                  현재 플랜
                </button>
              ) : plan.planCode === "starter" ? (
                <button
                  disabled
                  className="w-full py-3 px-4 border border-gray-300 text-gray-600 font-medium rounded-xl cursor-not-allowed"
                >
                  기본 제공
                </button>
              ) : plan.planCode === "enterprise" ? (
                <button
                  onClick={() => window.open("mailto:duath1031@gmail.com?subject=Enterprise 문의")}
                  className="w-full py-3 px-4 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-colors"
                >
                  문의하기
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.planCode)}
                  className={`w-full py-3 px-4 font-bold rounded-xl transition-colors shadow-lg ${
                    isPopular
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {currentSub?.subscription ? "플랜 변경" : "14일 무료 체험"}
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
