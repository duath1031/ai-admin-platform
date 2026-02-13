"use client";

import { useState, useCallback } from "react";
import { LOWER_LIMIT_PRESETS } from "@/lib/analytics/bidSimulator";

interface SimulationResult {
  rate: number;
  estimatedPrice: number;
  bidAmount: number;
  lowerLimit: number;
  isDumping: boolean;
  bidToEstimated: number;
}

interface BidSimulatorProps {
  onSimulate: (params: {
    foundationAmt: number;
    aValue: number;
    bidRate: number;
    rateMin: number;
    rateMax: number;
    rateStep: number;
    lowerLimitRate: number;
  }) => void;
  results: SimulationResult[];
  loading: boolean;
  summary?: {
    totalSteps: number;
    dumpingSteps: number;
    bidAmountRange: { min: number; max: number };
  };
}

function formatKRW(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(2)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

export default function BidSimulator({ onSimulate, results, loading, summary }: BidSimulatorProps) {
  const [foundationAmt, setFoundationAmt] = useState<string>("");
  const [aValue, setAValue] = useState<string>("0");
  const [bidRate, setBidRate] = useState<number>(87.745);
  const [rateMin, setRateMin] = useState<string>("99.5");
  const [rateMax, setRateMax] = useState<string>("100.5");
  const [rateStep, setRateStep] = useState<string>("0.1");
  const [lowerLimitPreset, setLowerLimitPreset] = useState<string>("service");
  const [lowerLimitRate, setLowerLimitRate] = useState<number>(87.745);

  const handlePresetChange = useCallback((preset: string) => {
    setLowerLimitPreset(preset);
    const p = LOWER_LIMIT_PRESETS[preset];
    if (p && p.rate > 0) {
      setLowerLimitRate(p.rate);
      if (preset === "service" || preset === "goods") {
        setBidRate(p.rate);
      } else if (preset === "construction") {
        setBidRate(86.745);
      }
    }
  }, []);

  const handleSimulate = useCallback(() => {
    const amt = Number(foundationAmt.replace(/,/g, ""));
    if (!amt || amt <= 0) return;
    onSimulate({
      foundationAmt: amt,
      aValue: Number(aValue.replace(/,/g, "")) || 0,
      bidRate,
      rateMin: Number(rateMin),
      rateMax: Number(rateMax),
      rateStep: Number(rateStep),
      lowerLimitRate,
    });
  }, [foundationAmt, aValue, bidRate, rateMin, rateMax, rateStep, lowerLimitRate, onSimulate]);

  return (
    <div className="space-y-4">
      {/* 기초금액 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">기초금액 (원)</label>
        <input
          type="text"
          value={foundationAmt}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, "");
            setFoundationAmt(v ? Number(v).toLocaleString() : "");
          }}
          placeholder="예: 1,000,000,000"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* A값 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">A값 (직접생산비 등)</label>
        <input
          type="text"
          value={aValue}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, "");
            setAValue(v ? Number(v).toLocaleString() : "0");
          }}
          placeholder="0"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* 하한율 프리셋 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">낙찰하한율 프리셋</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(LOWER_LIMIT_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                lowerLimitPreset === key
                  ? "bg-blue-50 border-blue-500 text-blue-700 font-medium"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 투찰률 슬라이더 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          투찰률: <span className="text-blue-600 font-bold">{bidRate.toFixed(3)}%</span>
        </label>
        <input
          type="range"
          min="85"
          max="100"
          step="0.005"
          value={bidRate}
          onChange={(e) => setBidRate(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>85%</span>
          <span>100%</span>
        </div>
      </div>

      {/* 낙찰하한율 직접 입력 */}
      {lowerLimitPreset === "custom" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">낙찰하한율 (%)</label>
          <input
            type="number"
            value={lowerLimitRate}
            onChange={(e) => setLowerLimitRate(Number(e.target.value))}
            step="0.001"
            min="0"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      )}

      {/* 사정률 범위 */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">사정률 하한(%)</label>
          <input
            type="number"
            value={rateMin}
            onChange={(e) => setRateMin(e.target.value)}
            step="0.1"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">사정률 상한(%)</label>
          <input
            type="number"
            value={rateMax}
            onChange={(e) => setRateMax(e.target.value)}
            step="0.1"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">단위(%)</label>
          <input
            type="number"
            value={rateStep}
            onChange={(e) => setRateStep(e.target.value)}
            step="0.01"
            min="0.01"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      {/* 시뮬레이션 버튼 */}
      <button
        onClick={handleSimulate}
        disabled={loading || !foundationAmt}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "분석 중..." : "시뮬레이션 실행"}
      </button>

      {/* 결과 요약 */}
      {summary && results.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 space-y-1">
          <p className="text-sm font-medium text-blue-800">분석 결과 요약</p>
          <p className="text-xs text-blue-600">
            전체 {summary.totalSteps}개 구간 중 덤핑 위험 {summary.dumpingSteps}개 구간
          </p>
          <p className="text-xs text-blue-600">
            투찰금액 범위: {formatKRW(summary.bidAmountRange.min)} ~ {formatKRW(summary.bidAmountRange.max)}
          </p>
        </div>
      )}

      {/* 결과 테이블 */}
      {results.length > 0 && (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left text-gray-600">사정률</th>
                <th className="px-2 py-1.5 text-right text-gray-600">예정가격</th>
                <th className="px-2 py-1.5 text-right text-gray-600">투찰금액</th>
                <th className="px-2 py-1.5 text-right text-gray-600">하한가</th>
                <th className="px-2 py-1.5 text-center text-gray-600">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r, i) => (
                <tr key={i} className={r.isDumping ? "bg-red-50" : ""}>
                  <td className="px-2 py-1.5 font-mono">{r.rate.toFixed(2)}%</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatKRW(r.estimatedPrice)}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-medium text-blue-700">{formatKRW(r.bidAmount)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatKRW(r.lowerLimit)}</td>
                  <td className="px-2 py-1.5 text-center">
                    {r.isDumping ? (
                      <span className="text-red-600 font-medium">덤핑</span>
                    ) : (
                      <span className="text-green-600">적격</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
