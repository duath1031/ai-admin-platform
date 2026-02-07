"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui";

/**
 * Agency Bias Analyzer (발주처 사정률 경향 분석)
 *
 * 특정 발주처의 과거 낙찰 데이터를 분석하여 사정률 경향을 히트맵으로 시각화
 * - 실제 사정률 = (예정가격 / 기초금액) × 100
 * - 98%~102% 구간을 0.1% 단위로 분석
 */

interface BiasData {
  agency: string;
  totalCount: number;
  avgRate: number;
  mostCommonRange: string;
  distribution: { range: string; count: number; percentage: number }[];
}

export default function AgencyBiasAnalyzer() {
  const [agency, setAgency] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [biasData, setBiasData] = useState<BiasData | null>(null);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!agency.trim()) {
      setError("발주처명을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setBiasData(null);

    try {
      const res = await fetch("/api/analytics/agency-bias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agency: agency.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "분석 실패");
      }

      setBiasData(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 히트맵 색상 계산
  const getHeatColor = (percentage: number): string => {
    if (percentage >= 30) return "bg-red-500";
    if (percentage >= 20) return "bg-orange-500";
    if (percentage >= 15) return "bg-amber-500";
    if (percentage >= 10) return "bg-yellow-400";
    if (percentage >= 5) return "bg-lime-400";
    if (percentage > 0) return "bg-green-300";
    return "bg-slate-100";
  };

  const getHeatTextColor = (percentage: number): string => {
    if (percentage >= 15) return "text-white";
    return "text-slate-700";
  };

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">📊</span>
          <div>
            <h2 className="text-lg font-bold text-slate-800">발주처 사정률 분석</h2>
            <p className="text-xs text-slate-500">Agency Bias Analyzer</p>
          </div>
        </div>

        {/* 검색 */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            placeholder="발주처명 입력 (예: 서울시, 국토교통부)"
            className="flex-1 px-4 py-2.5 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          />
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                분석중
              </span>
            ) : (
              "분석"
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* 결과 */}
        {biasData && (
          <div className="space-y-6">
            {/* 요약 */}
            <div className="bg-white rounded-xl p-4 border border-indigo-100">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500">분석 건수</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {biasData.totalCount}건
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">평균 사정률</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {biasData.avgRate.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">최다 구간</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {biasData.mostCommonRange}
                  </p>
                </div>
              </div>
            </div>

            {/* 히트맵 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                사정률 분포 히트맵
              </h3>
              <div className="grid grid-cols-5 gap-1">
                {biasData.distribution.map((item, idx) => (
                  <div
                    key={idx}
                    className={`relative p-2 rounded ${getHeatColor(item.percentage)} ${getHeatTextColor(item.percentage)} transition-all hover:scale-105`}
                    title={`${item.range}: ${item.count}건 (${item.percentage.toFixed(1)}%)`}
                  >
                    <p className="text-xs font-medium text-center">{item.range}</p>
                    <p className="text-lg font-bold text-center">{item.count}</p>
                    <p className="text-xs text-center opacity-80">
                      {item.percentage.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 분석 결과 메시지 */}
            <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg p-4 border border-indigo-200">
              <p className="text-sm text-indigo-800">
                <span className="font-bold">{biasData.agency}</span>는 주로{" "}
                <span className="font-bold text-purple-700">{biasData.mostCommonRange}</span>{" "}
                구간에서 예정가격이 형성됩니다.
              </p>
              <p className="text-xs text-indigo-600 mt-1">
                이 발주처에 투찰 시 예상 사정률 <strong>{biasData.avgRate.toFixed(2)}%</strong>를 참고하세요.
              </p>
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-4 text-xs text-slate-500 justify-center">
              <span>빈도:</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-slate-100 rounded" />
                <span>0%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-green-300 rounded" />
                <span>~5%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-yellow-400 rounded" />
                <span>~15%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-orange-500 rounded" />
                <span>~25%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-red-500 rounded" />
                <span>30%+</span>
              </div>
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {!biasData && !isLoading && !error && (
          <div className="text-center py-8 text-slate-400">
            <span className="text-4xl block mb-3">🔍</span>
            <p className="text-sm">
              발주처명을 입력하면 과거 낙찰 데이터를 기반으로
              <br />
              사정률 경향을 분석합니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
