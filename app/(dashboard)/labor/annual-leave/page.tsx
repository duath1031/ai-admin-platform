"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui";

interface YearlyHistoryItem {
  year: number;
  periodStart: string;
  periodEnd: string;
  entitled: number;
  description: string;
}

interface AnnualLeaveResult {
  hireDate: string;
  asOfDate: string;
  totalServiceDays: number;
  serviceYears: number;
  serviceMonths: number;
  currentEntitled: number;
  usedDays: number;
  remainingDays: number;
  yearlyHistory: YearlyHistoryItem[];
  totalEntitled: number;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AnnualLeavePage() {
  const [hireDate, setHireDate] = useState("");
  const [usedDays, setUsedDays] = useState(0);
  const [asOfDate, setAsOfDate] = useState(getTodayStr());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnnualLeaveResult | null>(null);

  const handleCalculate = async () => {
    if (!hireDate) {
      setError("입사일을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/labor/annual-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hireDate,
          usedDays,
          asOfDate: asOfDate || getTodayStr(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `API 요청 실패 (${res.status})`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const usedRatio = result
    ? result.currentEntitled > 0
      ? Math.min(100, (result.usedDays / result.currentEntitled) * 100)
      : 0
    : 0;

  const remainingRatio = result
    ? result.currentEntitled > 0
      ? Math.max(0, 100 - usedRatio)
      : 0
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">연차 계산기</h1>
        <p className="text-gray-500 mt-1">
          근로기준법 제60조에 따른 연차유급휴가를 계산합니다
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            기본 정보 입력
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                입사일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                사용일수
              </label>
              <input
                type="number"
                value={usedDays}
                onChange={(e) =>
                  setUsedDays(Math.max(0, Number(e.target.value)))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                min={0}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                기준일
              </label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleCalculate}
            disabled={isLoading}
            className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                계산 중...
              </span>
            ) : (
              "연차 계산하기"
            )}
          </button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="근속기간"
              value={`${result.serviceYears}년 ${result.serviceMonths}개월`}
              sub={`총 ${result.totalServiceDays.toLocaleString()}일`}
              color="indigo"
            />
            <SummaryCard
              label="현재 발생연차"
              value={`${result.currentEntitled.toLocaleString()}일`}
              sub={`누적 ${result.totalEntitled.toLocaleString()}일`}
              color="blue"
            />
            <SummaryCard
              label="사용일수"
              value={`${result.usedDays.toLocaleString()}일`}
              sub={
                result.currentEntitled > 0
                  ? `${Math.round(usedRatio)}% 사용`
                  : "-"
              }
              color="amber"
            />
            <SummaryCard
              label="잔여연차"
              value={`${result.remainingDays.toLocaleString()}일`}
              sub={
                result.remainingDays < 0
                  ? "초과 사용"
                  : result.remainingDays === 0
                    ? "전부 소진"
                    : "사용 가능"
              }
              color={
                result.remainingDays > 0
                  ? "green"
                  : result.remainingDays === 0
                    ? "gray"
                    : "red"
              }
            />
          </div>

          {/* Progress Bar */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                연차 사용 현황
              </h3>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>
                  사용 {result.usedDays.toLocaleString()}일 /{" "}
                  {result.currentEntitled.toLocaleString()}일
                </span>
                <span>잔여 {result.remainingDays.toLocaleString()}일</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden flex">
                {usedRatio > 0 && (
                  <div
                    className="h-full bg-indigo-500 transition-all duration-700 flex items-center justify-center"
                    style={{ width: `${usedRatio}%` }}
                  >
                    {usedRatio >= 15 && (
                      <span className="text-[10px] text-white font-medium">
                        사용
                      </span>
                    )}
                  </div>
                )}
                {remainingRatio > 0 && (
                  <div
                    className="h-full bg-green-400 transition-all duration-700 flex items-center justify-center"
                    style={{ width: `${remainingRatio}%` }}
                  >
                    {remainingRatio >= 15 && (
                      <span className="text-[10px] text-white font-medium">
                        잔여
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" />
                  사용
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-green-400" />
                  잔여
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Yearly Timeline */}
          {result.yearlyHistory && result.yearlyHistory.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">
                  연도별 연차 발생 내역
                </h3>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[39px] top-2 bottom-2 w-0.5 bg-gray-200 md:left-[47px]" />

                  <div className="space-y-4">
                    {result.yearlyHistory.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 md:gap-4">
                        {/* Year badge */}
                        <div className="relative z-10 flex-shrink-0">
                          <div
                            className={`w-[78px] md:w-[94px] px-2 py-1.5 rounded-lg text-center text-xs font-bold ${
                              idx === result.yearlyHistory.length - 1
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-100 text-gray-700 border border-gray-200"
                            }`}
                          >
                            {item.year === 0
                              ? "입사 1년차"
                              : `${item.year}년차`}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                                {item.entitled}일
                              </span>
                              <span className="text-sm text-gray-700 font-medium truncate">
                                {item.description}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {formatDate(item.periodStart)} ~{" "}
                              {formatDate(item.periodEnd)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500">
              본 계산 결과는 근로기준법 제60조를 기준으로 산출된 참고용
              정보입니다. 취업규칙, 단체협약, 근로계약서 등에 따라 실제
              연차일수가 다를 수 있습니다. 정확한 안내는 행정사, 노무사, 변호사 또는
              관할 노동청에 문의하시기 바랍니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Summary Card Component ---- */
function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; sub: string }> = {
    indigo: {
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      sub: "text-indigo-500",
    },
    blue: { bg: "bg-blue-50", text: "text-blue-700", sub: "text-blue-500" },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      sub: "text-amber-500",
    },
    green: {
      bg: "bg-green-50",
      text: "text-green-700",
      sub: "text-green-500",
    },
    red: { bg: "bg-red-50", text: "text-red-700", sub: "text-red-500" },
    gray: { bg: "bg-gray-50", text: "text-gray-700", sub: "text-gray-500" },
  };

  const c = colorMap[color] || colorMap.gray;

  return (
    <Card>
      <CardContent className={`p-4 ${c.bg}`}>
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
        <p className={`text-lg md:text-xl font-bold ${c.text}`}>{value}</p>
        <p className={`text-xs mt-0.5 ${c.sub}`}>{sub}</p>
      </CardContent>
    </Card>
  );
}
