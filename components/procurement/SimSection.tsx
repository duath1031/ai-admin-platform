"use client";

import { useState, useCallback } from "react";
import BidSimulator from "@/components/procurement/BidSimulator";
import RateDistributionChart from "@/components/procurement/RateDistributionChart";
import MonteCarloResult from "@/components/procurement/MonteCarloResult";
import { Card, CardContent } from "@/components/ui/Card";

// ── Interfaces ──────────────────────────────────────────────

interface SimulationResult {
  rate: number;
  estimatedPrice: number;
  bidAmount: number;
  lowerLimit: number;
  isDumping: boolean;
  bidToEstimated: number;
}

interface SimulationSummary {
  totalSteps: number;
  dumpingSteps: number;
  bidAmountRange: { min: number; max: number };
}

interface MonteCarloData {
  iterations: number;
  passCount: number;
  passRate: number;
  dumpingCount: number;
  dumpingRate: number;
  bidAmounts: { min: number; max: number; mean: number; median: number };
  histogram: { rangeLabel: string; count: number; frequency: number }[];
}

interface RateDistributionData {
  buckets: { rangeStart: number; rangeEnd: number; count: number; frequency: number }[];
  stats: { mean: number; median: number; stdDev: number; min: number; max: number; total: number };
}

interface ReservePriceData {
  bidNo: string;
  bssamt: number;
  plnprc: number;
  assessmentRate: number;
  reservePrices: { index: number; price: number; isDrawn: boolean }[];
  openingDt: string;
}

// ── Helpers ─────────────────────────────────────────────────

function formatKRW(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(2)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

type SimTab = "segment" | "montecarlo" | "distribution" | "reserve";

const SIM_TABS: { key: SimTab; label: string }[] = [
  { key: "segment", label: "구간별 시뮬레이션" },
  { key: "montecarlo", label: "몬테카를로" },
  { key: "distribution", label: "사정률 분포" },
  { key: "reserve", label: "예비가격 조회" },
];

// ── Component ───────────────────────────────────────────────

export default function SimSection() {
  // Tab state
  const [activeTab, setActiveTab] = useState<SimTab>("segment");

  // Tab 1 - Segment simulation
  const [simResults, setSimResults] = useState<SimulationResult[]>([]);
  const [simSummary, setSimSummary] = useState<SimulationSummary | undefined>();
  const [simLoading, setSimLoading] = useState(false);
  const [lastParams, setLastParams] = useState<{
    foundationAmt: number;
    aValue: number;
    bidRate: number;
    rateMin: number;
    rateMax: number;
    rateStep: number;
    lowerLimitRate: number;
  } | null>(null);

  // Tab 2 - Monte Carlo
  const [mcIterations, setMcIterations] = useState<number>(1000);
  const [mcAgencyFilter, setMcAgencyFilter] = useState("");
  const [mcResult, setMcResult] = useState<MonteCarloData | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcDataSource, setMcDataSource] = useState<string>("");
  const [mcDataCount, setMcDataCount] = useState<number>(0);

  // Tab 3 - Rate distribution
  const [rdPeriod, setRdPeriod] = useState<number>(3);
  const [rdAgencyFilter, setRdAgencyFilter] = useState("");
  const [rdData, setRdData] = useState<RateDistributionData | null>(null);
  const [rdLoading, setRdLoading] = useState(false);

  // Tab 4 - Reserve price lookup
  const [rpBidNo, setRpBidNo] = useState("");
  const [rpBidType, setRpBidType] = useState<string>("service");
  const [rpData, setRpData] = useState<ReservePriceData | null>(null);
  const [rpLoading, setRpLoading] = useState(false);

  // ── API calls ───────────────────────────────────────────

  const handleSimulate = useCallback(async (params: {
    foundationAmt: number;
    aValue: number;
    bidRate: number;
    rateMin: number;
    rateMax: number;
    rateStep: number;
    lowerLimitRate: number;
  }) => {
    setSimLoading(true);
    setLastParams(params);
    try {
      const res = await fetch("/api/analytics/bid-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate", ...params }),
      });
      const data = await res.json();
      if (data.results) {
        setSimResults(data.results);
        setSimSummary(data.summary);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimLoading(false);
    }
  }, []);

  const handleMonteCarlo = useCallback(async () => {
    if (!lastParams) return;
    setMcLoading(true);
    try {
      const res = await fetch("/api/analytics/bid-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "montecarlo",
          ...lastParams,
          iterations: mcIterations,
          agencyFilter: mcAgencyFilter || undefined,
        }),
      });
      const data = await res.json();
      if (data.result) {
        setMcResult(data.result);
        setMcDataSource(data.dataSource || "");
        setMcDataCount(data.dataCount || 0);
      }
    } catch (err) {
      console.error("Monte Carlo error:", err);
    } finally {
      setMcLoading(false);
    }
  }, [lastParams, mcIterations, mcAgencyFilter]);

  const handleDistribution = useCallback(async () => {
    setRdLoading(true);
    try {
      const res = await fetch("/api/analytics/bid-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "distribution",
          periodMonths: rdPeriod,
          agencyFilter: rdAgencyFilter || undefined,
        }),
      });
      const data = await res.json();
      if (data.buckets) {
        setRdData({ buckets: data.buckets, stats: data.stats });
      }
    } catch (err) {
      console.error("Distribution error:", err);
    } finally {
      setRdLoading(false);
    }
  }, [rdPeriod, rdAgencyFilter]);

  const handleReserveLookup = useCallback(async () => {
    if (!rpBidNo.trim()) return;
    setRpLoading(true);
    try {
      const res = await fetch("/api/analytics/bid-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reserve",
          bidNo: rpBidNo.trim(),
          bidType: rpBidType,
        }),
      });
      const data = await res.json();
      if (data.bidNo) {
        setRpData(data);
      }
    } catch (err) {
      console.error("Reserve price lookup error:", err);
    } finally {
      setRpLoading(false);
    }
  }, [rpBidNo, rpBidType]);

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {SIM_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: 구간별 시뮬레이션 */}
      {activeTab === "segment" && (
        <Card>
          <CardContent>
            <BidSimulator
              onSimulate={handleSimulate}
              results={simResults}
              loading={simLoading}
              summary={simSummary}
            />

            {simSummary && simResults.length > 0 && (
              <div className="mt-4 space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">분석구간</p>
                    <p className="text-lg font-bold text-blue-700">
                      {simSummary.totalSteps}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">적격구간</p>
                    <p className="text-lg font-bold text-green-700">
                      {simSummary.totalSteps - simSummary.dumpingSteps}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">덤핑위험</p>
                    <p className="text-lg font-bold text-red-600">
                      {simSummary.dumpingSteps}
                    </p>
                  </div>
                </div>

                {/* Bar chart visualization */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    사정률별 투찰금액 분포
                  </p>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {simResults.map((r, i) => {
                      const maxBid = simSummary.bidAmountRange.max || 1;
                      const widthPercent = Math.max(
                        2,
                        (r.bidAmount / maxBid) * 100
                      );
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-16 text-right text-xs text-gray-500 font-mono shrink-0">
                            {r.rate.toFixed(2)}%
                          </div>
                          <div className="flex-1">
                            <div
                              className={`h-4 rounded-r transition-all ${
                                r.isDumping ? "bg-red-400" : "bg-blue-400"
                              }`}
                              style={{ width: `${widthPercent}%` }}
                              title={formatKRW(r.bidAmount)}
                            />
                          </div>
                          <div className="w-20 text-xs text-gray-400 text-right shrink-0 font-mono">
                            {formatKRW(r.bidAmount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded bg-blue-400" />
                      적격
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded bg-red-400" />
                      덤핑위험
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: 몬테카를로 */}
      {activeTab === "montecarlo" && (
        <Card>
          <CardContent>
            {!lastParams ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-3xl mb-2">!</div>
                <p className="text-sm text-gray-500 font-medium">
                  먼저 구간별 시뮬레이션을 실행하세요
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  기초금액, 투찰률 등 기본 파라미터가 필요합니다.
                </p>
                <button
                  onClick={() => setActiveTab("segment")}
                  className="mt-3 px-4 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  시뮬레이션으로 이동
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Iteration selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    반복 횟수
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 1000, 5000, 10000].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMcIterations(n)}
                        className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                          mcIterations === n
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-medium"
                            : "border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {n.toLocaleString()}회
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agency filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    발주기관 필터 (선택)
                  </label>
                  <input
                    type="text"
                    value={mcAgencyFilter}
                    onChange={(e) => setMcAgencyFilter(e.target.value)}
                    placeholder="예: 서울시, 국토교통부"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Run button */}
                <button
                  onClick={handleMonteCarlo}
                  disabled={mcLoading}
                  className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {mcLoading
                    ? `시뮬레이션 실행 중 (${mcIterations.toLocaleString()}회)...`
                    : `몬테카를로 실행 (${mcIterations.toLocaleString()}회)`}
                </button>

                {/* Parameter summary */}
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-600">적용 파라미터</p>
                  <p>기초금액: {formatKRW(lastParams.foundationAmt)}</p>
                  <p>투찰률: {lastParams.bidRate.toFixed(3)}%</p>
                  <p>
                    사정률 범위: {lastParams.rateMin}% ~ {lastParams.rateMax}%
                  </p>
                </div>

                {/* Results */}
                <MonteCarloResult
                  result={mcResult}
                  loading={mcLoading}
                  dataSource={mcDataSource}
                  dataCount={mcDataCount}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: 사정률 분포 */}
      {activeTab === "distribution" && (
        <Card>
          <CardContent>
            <div className="space-y-4">
              {/* Period selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  조회 기간
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 1, label: "1개월" },
                    { value: 3, label: "3개월" },
                    { value: 6, label: "6개월" },
                    { value: 12, label: "12개월" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setRdPeriod(p.value)}
                      className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                        rdPeriod === p.value
                          ? "bg-blue-50 border-blue-500 text-blue-700 font-medium"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agency filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  발주기관 필터 (선택)
                </label>
                <input
                  type="text"
                  value={rdAgencyFilter}
                  onChange={(e) => setRdAgencyFilter(e.target.value)}
                  placeholder="예: 서울시, 국방부"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Fetch button */}
              <button
                onClick={handleDistribution}
                disabled={rdLoading}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {rdLoading ? "데이터 조회 중..." : "사정률 분포 조회"}
              </button>

              {/* Chart */}
              <RateDistributionChart
                buckets={rdData?.buckets || []}
                stats={
                  rdData?.stats || {
                    mean: 0,
                    median: 0,
                    stdDev: 0,
                    min: 0,
                    max: 0,
                    total: 0,
                  }
                }
                loading={rdLoading}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: 예비가격 조회 */}
      {activeTab === "reserve" && (
        <Card>
          <CardContent>
            <div className="space-y-4">
              {/* Bid number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  입찰공고번호
                </label>
                <input
                  type="text"
                  value={rpBidNo}
                  onChange={(e) => setRpBidNo(e.target.value)}
                  placeholder="예: 20260200001-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Bid type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  입찰 유형
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "service", label: "용역" },
                    { value: "goods", label: "물품" },
                    { value: "construction", label: "공사" },
                  ].map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setRpBidType(t.value)}
                      className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                        rpBidType === t.value
                          ? "bg-blue-50 border-blue-500 text-blue-700 font-medium"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lookup button */}
              <button
                onClick={handleReserveLookup}
                disabled={rpLoading || !rpBidNo.trim()}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {rpLoading ? "조회 중..." : "예비가격 조회"}
              </button>

              {/* Results */}
              {rpData && (
                <div className="space-y-3">
                  {/* Bid info summary */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs">
                    <p className="font-medium text-gray-700">
                      공고번호: {rpData.bidNo}
                    </p>
                    <p className="text-gray-500">
                      기초금액: {formatKRW(rpData.bssamt)}
                    </p>
                    <p className="text-gray-500">
                      예정가격: {formatKRW(rpData.plnprc)}
                    </p>
                    <p className="text-gray-500">
                      사정률: {rpData.assessmentRate.toFixed(4)}%
                    </p>
                    <p className="text-gray-500">
                      개찰일시: {rpData.openingDt}
                    </p>
                  </div>

                  {/* 15 Reserve prices */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      예비가격 15개
                    </p>
                    <div className="grid grid-cols-1 gap-1">
                      {rpData.reservePrices.map((rp) => (
                        <div
                          key={rp.index}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                            rp.isDrawn
                              ? "bg-yellow-50 border border-yellow-300"
                              : "bg-gray-50 border border-gray-200"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                rp.isDrawn
                                  ? "bg-yellow-400 text-yellow-900"
                                  : "bg-gray-200 text-gray-500"
                              }`}
                            >
                              {rp.index}
                            </span>
                            <span
                              className={`font-mono ${
                                rp.isDrawn
                                  ? "text-yellow-800 font-bold"
                                  : "text-gray-600"
                              }`}
                            >
                              {formatKRW(rp.price)}
                            </span>
                          </div>
                          {rp.isDrawn && (
                            <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold">
                              추첨
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Drawn count info */}
                  <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
                    추첨된 예비가격:{" "}
                    {rpData.reservePrices.filter((rp) => rp.isDrawn).length}개 /
                    15개
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!rpData && !rpLoading && (
                <div className="text-center py-6 text-gray-400 text-sm">
                  입찰공고번호를 입력하고 조회하면 예비가격이 표시됩니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
