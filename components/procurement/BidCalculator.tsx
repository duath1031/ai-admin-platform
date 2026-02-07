"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui";

/**
 * The A-Value Calculator (투찰 하한가 계산기)
 *
 * 공식: 투찰금액 = [(기초금액 × 사정률 - A값) × 낙찰하한율] + A값
 *
 * - 기초금액: 발주처가 공개한 기준 금액
 * - A값: 국민연금, 건강보험 등 고정비용 (변동 없이 그대로 반영)
 * - 사정률: 예정가격 결정 비율 (보통 99%~101%)
 * - 낙찰하한율: 덤핑 방지 하한선 (용역 87.745%, 공사 86% 등)
 */

interface CalculationResult {
  preAmt: number;           // 예정가격
  baseForBid: number;       // 투찰 기준금액 (예정가격 - A값)
  bidFloorAmt: number;      // 투찰 하한가
  bidFloorRate: number;     // 투찰 하한율 (%)
}

export default function BidCalculator() {
  // 입력값
  const [foundationAmt, setFoundationAmt] = useState<string>("");
  const [aValue, setAValue] = useState<string>("");
  const [estimatedRate, setEstimatedRate] = useState<string>("100.0");
  const [floorRate, setFloorRate] = useState<string>("87.745");

  // 프리셋
  const ratePresets = [
    { label: "99.0%", value: "99.0" },
    { label: "99.5%", value: "99.5" },
    { label: "100.0%", value: "100.0" },
    { label: "100.5%", value: "100.5" },
    { label: "101.0%", value: "101.0" },
  ];

  const floorPresets = [
    { label: "용역 87.745%", value: "87.745" },
    { label: "공사 86%", value: "86.0" },
    { label: "물품 최저가", value: "100.0" },
  ];

  // 계산 결과
  const result = useMemo<CalculationResult | null>(() => {
    const foundation = parseFloat(foundationAmt.replace(/,/g, ""));
    const a = parseFloat(aValue.replace(/,/g, "")) || 0;
    const rate = parseFloat(estimatedRate) / 100;
    const floor = parseFloat(floorRate) / 100;

    if (isNaN(foundation) || foundation <= 0) return null;
    if (isNaN(rate) || rate <= 0) return null;
    if (isNaN(floor) || floor <= 0) return null;

    // 예정가격 = 기초금액 × 사정률
    const preAmt = foundation * rate;

    // 투찰 기준금액 = 예정가격 - A값
    const baseForBid = preAmt - a;

    // 투찰 하한가 = (기준금액 × 낙찰하한율) + A값
    // 소수점 절사 (원 단위)
    const bidFloorAmt = Math.floor(baseForBid * floor + a);

    // 투찰 하한율 (예정가격 대비)
    const bidFloorRate = (bidFloorAmt / preAmt) * 100;

    return {
      preAmt: Math.floor(preAmt),
      baseForBid: Math.floor(baseForBid),
      bidFloorAmt,
      bidFloorRate: Math.round(bidFloorRate * 1000) / 1000,
    };
  }, [foundationAmt, aValue, estimatedRate, floorRate]);

  // 금액 포맷팅
  const formatAmount = (value: string) => {
    const num = value.replace(/[^0-9]/g, "");
    if (!num) return "";
    return Number(num).toLocaleString();
  };

  const formatKRW = (amount: number): string => {
    if (amount >= 100000000) {
      const billions = Math.floor(amount / 100000000);
      const millions = Math.floor((amount % 100000000) / 10000);
      return millions > 0
        ? `${billions}억 ${millions.toLocaleString()}만원`
        : `${billions}억원`;
    }
    if (amount >= 10000) {
      return `${Math.floor(amount / 10000).toLocaleString()}만원`;
    }
    return `${amount.toLocaleString()}원`;
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">🧮</span>
          <div>
            <h2 className="text-lg font-bold text-slate-800">투찰 하한가 계산기</h2>
            <p className="text-xs text-slate-500">The A-Value Calculator</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 입력 섹션 */}
          <div className="space-y-4">
            {/* 기초금액 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                기초금액 (원)
              </label>
              <input
                type="text"
                value={foundationAmt}
                onChange={(e) => setFoundationAmt(formatAmount(e.target.value))}
                placeholder="예: 100,000,000"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right font-mono"
              />
            </div>

            {/* A값 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                A값 (고정비용, 원)
                <span className="ml-1 text-xs text-slate-400">국민연금/건강보험 등</span>
              </label>
              <input
                type="text"
                value={aValue}
                onChange={(e) => setAValue(formatAmount(e.target.value))}
                placeholder="예: 5,000,000"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right font-mono"
              />
            </div>

            {/* 예상 사정률 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                예상 사정률 (%)
              </label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {ratePresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setEstimatedRate(preset.value)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      estimatedRate === preset.value
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={estimatedRate}
                onChange={(e) => setEstimatedRate(e.target.value)}
                step="0.1"
                min="90"
                max="110"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right font-mono"
              />
            </div>

            {/* 낙찰하한율 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                낙찰하한율 (%)
              </label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {floorPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setFloorRate(preset.value)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      floorRate === preset.value
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={floorRate}
                onChange={(e) => setFloorRate(e.target.value)}
                step="0.001"
                min="50"
                max="100"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-right font-mono"
              />
            </div>
          </div>

          {/* 결과 섹션 */}
          <div className="space-y-4">
            {result ? (
              <>
                {/* 메인 결과 */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white">
                  <p className="text-sm text-blue-100 mb-1">투찰 하한가</p>
                  <p className="text-3xl font-bold tracking-tight">
                    {result.bidFloorAmt.toLocaleString()}원
                  </p>
                  <p className="text-sm text-blue-200 mt-1">
                    {formatKRW(result.bidFloorAmt)}
                  </p>
                </div>

                {/* 상세 분석 */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">예정가격 (추정)</span>
                    <span className="font-mono font-medium">
                      {result.preAmt.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">투찰 기준금액</span>
                    <span className="font-mono text-slate-700">
                      {result.baseForBid.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-600">예정가 대비 하한율</span>
                    <span className="font-mono font-medium text-emerald-600">
                      {result.bidFloorRate.toFixed(3)}%
                    </span>
                  </div>
                </div>

                {/* 계산 공식 설명 */}
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-amber-700 font-medium mb-1">계산 공식</p>
                  <p className="text-xs text-amber-600 font-mono">
                    [(기초금액 × 사정률 - A값) × 하한율] + A값
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full bg-slate-100 rounded-xl p-8">
                <div className="text-center">
                  <span className="text-4xl mb-4 block">📊</span>
                  <p className="text-slate-500 text-sm">
                    기초금액을 입력하면
                    <br />
                    투찰 하한가가 계산됩니다
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 도움말 */}
        <div className="mt-6 pt-4 border-t border-slate-200">
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-700">
              A값이란? (클릭해서 보기)
            </summary>
            <div className="mt-2 p-3 bg-slate-100 rounded-lg space-y-1">
              <p>
                <strong>A값</strong>은 국민연금, 건강보험료, 노인장기요양보험료 등 법정 부담금으로,
                기초금액에서 고정적으로 반영되는 금액입니다.
              </p>
              <p>
                예정가격 산정 시 A값은 사정률과 관계없이 그대로 반영되므로,
                투찰가 계산 시 A값을 제외한 나머지 금액에만 낙찰하한율을 적용합니다.
              </p>
              <p className="text-amber-600">
                A값은 입찰공고 상세페이지 또는 원가계산서에서 확인할 수 있습니다.
              </p>
            </div>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
