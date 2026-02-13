"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useBillingKey } from "@/hooks/useBillingKey";

// ─── Types ───

interface Plan {
  id: string;
  planCode: string;
  displayName: string;
  price: number;
  credits: number;
  tokenQuota: number;
  features: string;
}

interface SubData {
  subscription: {
    id: string;
    status: string;
    nextBillingDate: string;
    trialEndsAt: string | null;
    cancelledAt: string | null;
    endDate: string | null;
  } | null;
  currentPlan: {
    planCode: string;
    displayName: string;
    price: number;
    features: string;
    tokenQuota: number;
  };
  billingKey: { id: string; cardName: string; cardNumber: string } | null;
  recentPayments: {
    orderId: string;
    amount: number;
    approvedAt: string;
    itemName: string;
    receiptUrl: string | null;
  }[];
}

interface Balance {
  balance: number;
  monthlyUsed: number;
  tokenQuota: number;
}

const PLAN_TARGET: Record<string, string> = {
  starter: "체험용",
  standard: "일반인, 소상공인",
  pro: "행정사, 기업담당자, 공무원",
  pro_plus: "전문행정사, 기업법무팀",
};

const PLAN_FEATURES: Record<string, string[]> = {
  standard: [
    "AI 상담 무제한",
    "서류 작성 20건/월",
    "문서24/민원 접수",
    "인허가 자가진단",
    "서류 검토",
    "보조금 기본 매칭",
    "월 100만 토큰",
  ],
  pro: [
    "Standard 전체 포함",
    "입찰 분석 (시뮬레이터)",
    "비자 계산기",
    "인증 진단",
    "정책자금 매칭",
    "계약서 AI 분석",
    "월 300만 토큰",
  ],
  pro_plus: [
    "Pro 전체 포함",
    "거래처(B2B) 50개 관리",
    "거래처별 서류함",
    "거래처 대시보드",
    "일괄 보조금매칭",
    "리포트 자동생성",
    "월 500만 토큰",
  ],
};

const PLAN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  standard: { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700" },
  pro: { bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-700" },
  pro_plus: { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700" },
};

// ─── Main Component ───

function SubscriptionContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedPlanCode = searchParams.get("plan");

  const { registerAndSubscribe, loading: billingLoading, error: billingError } = useBillingKey();

  // Data state
  const [subData, setSubData] = useState<SubData | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  const loadData = useCallback(async () => {
    if (!session) return;
    const [subRes, balRes] = await Promise.all([
      fetch("/api/payments/subscription").then((r) => r.json()),
      fetch("/api/tokens/balance").then((r) => r.json()),
    ]);
    if (subRes.success) setSubData(subRes);
    if (balRes.success) setBalance(balRes);
    setLoading(false);
  }, [session]);

  // 선택한 플랜 정보 로드
  useEffect(() => {
    if (selectedPlanCode && selectedPlanCode !== "starter") {
      fetch("/api/plans")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            const plan = data.plans.find((p: Plan) => p.planCode === selectedPlanCode);
            if (plan) setSelectedPlan(plan);
          }
        });
    }
  }, [selectedPlanCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handlers ───

  const handleSubscribe = async () => {
    if (!selectedPlanCode || !selectedPlan) return;

    const result = await registerAndSubscribe(selectedPlanCode);
    if (result.success) {
      setSubscribeSuccess(true);
      // 3초 후 관리 화면으로 전환
      setTimeout(() => {
        router.replace("/subscription");
        loadData();
        setSubscribeSuccess(false);
        setSelectedPlan(null);
      }, 3000);
    }
  };

  const handleCancel = async () => {
    if (!subData?.subscription?.id) return;
    if (!confirm("정말 구독을 해지하시겠습니까? 현재 결제 기간이 끝날 때까지는 계속 사용 가능합니다."))
      return;

    setCancelling(true);
    const res = await fetch("/api/payments/cancel-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: subData.subscription.id }),
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      loadData();
    } else {
      alert(data.error || "해지 처리 중 오류가 발생했습니다.");
    }
    setCancelling(false);
  };

  // ─── Loading ───

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const sub = subData?.subscription;
  const currentPlan = subData?.currentPlan;
  const hasActiveSub = sub && ["active", "trial"].includes(sub.status);

  // ═══════════════════════════════════════════════════
  // 구독 성공 화면
  // ═══════════════════════════════════════════════════
  if (subscribeSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">구독이 시작되었습니다!</h2>
        <p className="text-gray-500 mb-6">
          {selectedPlan?.displayName} 플랜의 모든 기능을 사용할 수 있습니다.
        </p>
        <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-gray-400 mt-2">구독 관리 페이지로 이동합니다...</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // 체크아웃 플로우 (구독 없음 + plan 파라미터 있음)
  // ═══════════════════════════════════════════════════
  if (!hasActiveSub && selectedPlan && selectedPlanCode) {
    const colors = PLAN_COLORS[selectedPlanCode] || PLAN_COLORS.standard;
    const features = PLAN_FEATURES[selectedPlanCode] || [];
    const target = PLAN_TARGET[selectedPlanCode] || "";

    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <button
          onClick={() => router.push("/pricing")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          요금제로 돌아가기
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">구독 시작</h1>

        {/* 선택한 플랜 요약 */}
        <div className={`rounded-2xl border-2 ${colors.border} ${colors.bg} p-6 mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className={`text-xl font-bold ${colors.text}`}>{selectedPlan.displayName}</h2>
              {target && <p className="text-xs text-gray-500 mt-0.5">{target}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {(selectedPlan.price / 10000).toFixed(0)}
                <span className="text-sm font-normal text-gray-500">만원/월</span>
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200/60 pt-3 mt-3">
            <p className="text-xs text-gray-500 mb-2">포함 기능:</p>
            <ul className="space-y-1.5">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-sm">
            <span className="text-gray-500">월 토큰</span>
            <span className="font-bold text-gray-900">
              {selectedPlan.tokenQuota < 10000
                ? selectedPlan.tokenQuota.toLocaleString()
                : `${(selectedPlan.tokenQuota / 10000).toFixed(0)}만`}
              토큰
            </span>
          </div>
        </div>

        {/* 결제 정보 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">결제 정보</h3>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{selectedPlan.displayName} 월 구독료</span>
              <span className="font-medium text-gray-900">{selectedPlan.price.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">결제 주기</span>
              <span className="text-gray-700">매월 자동 결제</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-bold text-gray-900">오늘 결제 금액</span>
              <span className="text-xl font-bold text-blue-600">
                {selectedPlan.price.toLocaleString()}원
              </span>
            </div>
          </div>

          {billingError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
              {billingError}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={billingLoading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {billingLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                결제 처리 중...
              </span>
            ) : (
              `${selectedPlan.price.toLocaleString()}원 결제하고 시작하기`
            )}
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            결제수단 등록 후 첫 달 요금이 즉시 결제됩니다. 다음 달부터 매월 자동 결제되며 언제든 해지할 수 있습니다.
          </p>
        </div>

        {/* 안내 */}
        <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 space-y-1.5">
          <p className="font-medium text-gray-600">안내사항</p>
          <p>- 구독은 결제일로부터 1개월 단위로 자동 갱신됩니다.</p>
          <p>- 구독 해지 시 현재 결제 기간이 끝날 때까지 서비스를 이용할 수 있습니다.</p>
          <p>- 플랜 업그레이드 시 차액이 즉시 결제되고, 다운그레이드는 다음 결제일에 적용됩니다.</p>
          <p>- 토큰은 매월 1일에 플랜별 할당량으로 리셋됩니다.</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // 구독 관리 화면 (기존)
  // ═══════════════════════════════════════════════════
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">구독 관리</h1>

      {/* 현재 플랜 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">현재 플랜</h2>
          {sub?.status && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                sub.status === "active"
                  ? "bg-green-100 text-green-700"
                  : sub.status === "trial"
                  ? "bg-blue-100 text-blue-700"
                  : sub.status === "cancelled"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {sub.status === "active"
                ? "활성"
                : sub.status === "trial"
                ? "무료체험 중"
                : sub.status === "cancelled"
                ? "해지됨"
                : sub.status}
            </span>
          )}
        </div>

        <div className="flex items-end gap-2 mb-4">
          <span className="text-3xl font-bold text-gray-900">
            {currentPlan?.displayName || "Starter"}
          </span>
          {currentPlan && currentPlan.price > 0 && (
            <span className="text-gray-500 mb-1">
              {currentPlan.price.toLocaleString()}원/월
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-4">{currentPlan?.features}</p>

        {sub?.nextBillingDate && sub.status !== "cancelled" && (
          <p className="text-sm text-gray-500">
            다음 결제일: {new Date(sub.nextBillingDate).toLocaleDateString("ko-KR")}
          </p>
        )}
        {sub?.trialEndsAt && sub.status === "trial" && (
          <p className="text-sm text-blue-600 font-medium">
            무료체험 종료: {new Date(sub.trialEndsAt).toLocaleDateString("ko-KR")}
          </p>
        )}
        {sub?.endDate && sub.status === "cancelled" && (
          <p className="text-sm text-red-600">
            서비스 종료일: {new Date(sub.endDate).toLocaleDateString("ko-KR")}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <a
            href="/pricing"
            className="py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {sub ? "플랜 변경" : "플랜 선택"}
          </a>
          {sub && sub.status !== "cancelled" && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="py-2 px-4 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {cancelling ? "처리중..." : "구독 해지"}
            </button>
          )}
        </div>
      </div>

      {/* 토큰 사용현황 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">토큰 사용현황</h2>

        {balance && (
          <>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold text-gray-900">
                {balance.balance === -1 ? "무제한" : balance.balance.toLocaleString()}
              </span>
              {balance.balance !== -1 && (
                <span className="text-gray-500 mb-0.5">토큰 남음</span>
              )}
            </div>

            {balance.balance !== -1 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>이번 달 사용: {balance.monthlyUsed.toLocaleString()}</span>
                  <span>월 할당: {balance.tokenQuota.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (balance.monthlyUsed / balance.tokenQuota) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <a href="/mypage" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              토큰 관리 &rarr;
            </a>
          </>
        )}
      </div>

      {/* 결제수단 */}
      {subData?.billingKey && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">결제수단</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-7 bg-blue-100 rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {subData.billingKey.cardName || "카드"}
              </div>
              <div className="text-xs text-gray-500">
                {subData.billingKey.cardNumber || "****"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 최근 결제 내역 */}
      {subData?.recentPayments && subData.recentPayments.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">최근 결제</h2>
            <a href="/mypage/payments" className="text-sm text-blue-600 hover:text-blue-700">
              전체 내역 &rarr;
            </a>
          </div>
          <div className="space-y-3">
            {subData.recentPayments.map((p) => (
              <div
                key={p.orderId}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">{p.itemName}</div>
                  <div className="text-xs text-gray-500">
                    {p.approvedAt ? new Date(p.approvedAt).toLocaleDateString("ko-KR") : "-"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{p.amount.toLocaleString()}원</div>
                  {p.receiptUrl && (
                    <a
                      href={p.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      영수증
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <SubscriptionContent />
    </Suspense>
  );
}
