"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface TokenPackage {
  id: string;
  tokens: number;
  price: number;
  label: string;
  description: string;
}

export default function TokenChargePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/token/purchase")
      .then((r) => r.json())
      .then((data) => {
        setPackages(data.packages || []);
        setBalance(data.balance || 0);
        setLoading(false);
      });
  }, []);

  const handlePurchase = async (packageId: string) => {
    if (!session) {
      router.push("/api/auth/signin");
      return;
    }

    setPurchasing(packageId);
    setResult(null);

    try {
      const res = await fetch("/api/token/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();

      if (data.success) {
        setBalance(data.balance);
        setResult({
          success: true,
          message: `${data.charged.toLocaleString()} 토큰이 충전되었습니다!`,
        });
      } else if (data.needBillingKey) {
        setResult({
          success: false,
          message: "결제수단을 먼저 등록해주세요.",
        });
        setTimeout(() => router.push("/subscription"), 2000);
      } else {
        setResult({
          success: false,
          message: data.error || "결제에 실패했습니다.",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "네트워크 오류가 발생했습니다.",
      });
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">토큰 충전</h1>
        <p className="text-gray-500">
          월 토큰이 부족할 때 추가 충전하세요
        </p>
      </div>

      {/* 현재 잔액 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">현재 토큰 잔액</p>
            <p className="text-3xl font-bold mt-1">
              {balance === -1
                ? "무제한"
                : `${balance.toLocaleString()} 토큰`}
            </p>
          </div>
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 결과 메시지 */}
      {result && (
        <div
          className={`mb-6 p-4 rounded-xl text-sm font-medium ${
            result.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {result.message}
        </div>
      )}

      {/* 패키지 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {packages.map((pkg, i) => {
          const isPopular = i === 1;
          return (
            <div
              key={pkg.id}
              className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all hover:shadow-lg ${
                isPopular
                  ? "border-blue-400 bg-blue-50/50 ring-2 ring-blue-200 shadow-lg"
                  : "border-gray-200 bg-white shadow-md"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    인기
                  </span>
                </div>
              )}

              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">{pkg.label}</h3>
                <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>
              </div>

              <div className="text-center mb-6">
                <span className="text-3xl font-bold text-gray-900">
                  {(pkg.price / 10000).toFixed(0) === "0"
                    ? pkg.price.toLocaleString()
                    : `${(pkg.price / 10000).toFixed(0)}만`}
                </span>
                <span className="text-lg text-gray-500">원</span>
                <p className="text-xs text-gray-400 mt-1">
                  1토큰 = {(pkg.price / pkg.tokens).toFixed(2)}원
                </p>
              </div>

              {/* 토큰 사용 예시 */}
              <div className="bg-gray-50 rounded-lg p-3 mb-5 flex-1">
                <p className="text-xs text-gray-500 font-medium mb-2">
                  이만큼 쓸 수 있어요
                </p>
                <div className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>AI 상담</span>
                    <span className="font-medium">
                      {(pkg.tokens / 1000).toLocaleString()}회
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>서류 작성</span>
                    <span className="font-medium">
                      {Math.floor(pkg.tokens / 3000).toLocaleString()}건
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>RPA 접수</span>
                    <span className="font-medium">
                      {Math.floor(pkg.tokens / 5000).toLocaleString()}건
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={purchasing !== null}
                className={`w-full py-3 px-4 font-bold rounded-xl transition-colors ${
                  purchasing === pkg.id
                    ? "bg-gray-300 text-gray-500 cursor-wait"
                    : isPopular
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {purchasing === pkg.id ? "결제 중..." : "충전하기"}
              </button>
            </div>
          );
        })}
      </div>

      {/* 안내사항 */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">안내사항</h3>
        <ul className="space-y-1.5 text-xs text-gray-500">
          <li>- 충전된 토큰은 즉시 사용 가능합니다.</li>
          <li>- 추가 충전 토큰은 월 리셋과 별도로 유지됩니다.</li>
          <li>- 등록된 결제수단(카드)으로 자동 결제됩니다.</li>
          <li>- 결제 후 토큰은 환불되지 않습니다.</li>
          <li>- 토큰은 모든 유료 기능에 사용 가능합니다.</li>
        </ul>
      </div>
    </div>
  );
}
