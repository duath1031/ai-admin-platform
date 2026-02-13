"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui";
import { BidSimulator, RateDistributionChart, MonteCarloResult } from "@/components/procurement";
import ClientSelector from "@/components/common/ClientSelector";

// ─── Types ───

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

// ─── Main Page ───

export default function BidSimulationPage() {
  // Simulation state
  const [simResults, setSimResults] = useState<SimulationResult[]>([]);
  const [simSummary, setSimSummary] = useState<SimulationSummary | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Monte Carlo state
  const [mcResult, setMcResult] = useState<MonteCarloData | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcDataSource, setMcDataSource] = useState<string>("");
  const [mcDataCount, setMcDataCount] = useState<number>(0);
  const [mcIterations, setMcIterations] = useState<string>("1000");

  // Rate Distribution state
  const [rateData, setRateData] = useState<RateDistributionData | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateMonths, setRateMonths] = useState<string>("6");
  const [rateAgency, setRateAgency] = useState<string>("");

  // Reserve Price Lookup state
  const [reserveData, setReserveData] = useState<ReservePriceData | null>(null);
  const [reserveLoading, setReserveLoading] = useState(false);
  const [lookupBidNo, setLookupBidNo] = useState("");
  const [lookupBidType, setLookupBidType] = useState<string>("service");

  // Tab state
  const [activeTab, setActiveTab] = useState<"simulate" | "montecarlo" | "distribution" | "lookup">("simulate");

  // Last simulation params (for MC reuse)
  const [lastParams, setLastParams] = useState<{
    foundationAmt: number;
    aValue: number;
    bidRate: number;
    lowerLimitRate: number;
  } | null>(null);

  // Error
  const [error, setError] = useState<string>("");

  // ── API call helper ──
  const callAPI = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/analytics/bid-simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "API 오류");
    }
    return data;
  }, []);

  // ── 구간별 시뮬레이션 ──
  const handleSimulate = useCallback(
    async (params: {
      foundationAmt: number;
      aValue: number;
      bidRate: number;
      rateMin: number;
      rateMax: number;
      rateStep: number;
      lowerLimitRate: number;
    }) => {
      setSimLoading(true);
      setError("");
      try {
        const data = await callAPI({ action: "simulate", ...params });
        setSimResults(data.results);
        setSimSummary(data.summary);
        setLastParams({
          foundationAmt: params.foundationAmt,
          aValue: params.aValue,
          bidRate: params.bidRate,
          lowerLimitRate: params.lowerLimitRate,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "시뮬레이션 오류");
      } finally {
        setSimLoading(false);
      }
    },
    [callAPI],
  );

  // ── 몬테카를로 시뮬레이션 ──
  const handleMonteCarlo = useCallback(async () => {
    if (!lastParams) {
      setError("먼저 기본 시뮬레이션을 실행하세요.");
      return;
    }
    setMcLoading(true);
    setError("");
    try {
      const data = await callAPI({
        action: "montecarlo",
        ...lastParams,
        iterations: Number(mcIterations) || 1000,
        agency: rateAgency || undefined,
      });
      setMcResult(data.result);
      setMcDataSource(data.dataSource);
      setMcDataCount(data.dataCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "몬테카를로 오류");
    } finally {
      setMcLoading(false);
    }
  }, [callAPI, lastParams, mcIterations, rateAgency]);

  // ── 사정률 분포 조회 ──
  const handleRateDistribution = useCallback(async () => {
    setRateLoading(true);
    setError("");
    try {
      const data = await callAPI({
        action: "rate-distribution",
        months: Number(rateMonths) || 6,
        agency: rateAgency || undefined,
      });
      setRateData(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분포 조회 오류");
    } finally {
      setRateLoading(false);
    }
  }, [callAPI, rateMonths, rateAgency]);

  // ── 예비가격 조회 ──
  const handleReservePriceLookup = useCallback(async () => {
    if (!lookupBidNo.trim()) return;
    setReserveLoading(true);
    setError("");
    try {
      const data = await callAPI({
        action: "reserve-prices",
        bidNo: lookupBidNo.trim(),
        bidType: lookupBidType,
      });
      setReserveData(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "예비가격 조회 오류");
    } finally {
      setReserveLoading(false);
    }
  }, [callAPI, lookupBidNo, lookupBidType]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">입찰 시뮬레이터</h1>
          <p className="text-sm text-gray-500 mt-1">
            과거 공개 데이터 기반 분석 도구 — 복수예비가격 사정률 시뮬레이션
          </p>
        </div>
        <ClientSelector />
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-500 underline text-xs">
            닫기
          </button>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {[
          { key: "simulate", label: "구간별 시뮬레이션" },
          { key: "montecarlo", label: "몬테카를로" },
          { key: "distribution", label: "사정률 분포" },
          { key: "lookup", label: "예비가격 조회" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 구간별 시뮬레이션 ── */}
      {activeTab === "simulate" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 입력 패널 */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">시뮬레이션 입력</h2>
                <BidSimulator
                  onSimulate={handleSimulate}
                  results={simResults}
                  loading={simLoading}
                  summary={simSummary ?? undefined}
                />
              </CardContent>
            </Card>
          </div>

          {/* 결과 패널 */}
          <div className="lg:col-span-3 space-y-4">
            {/* 빠른 결과 카드 */}
            {simSummary && (
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-gray-500">분석 구간</p>
                    <p className="text-xl font-bold text-gray-800">{simSummary.totalSteps}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-gray-500">적격 구간</p>
                    <p className="text-xl font-bold text-green-600">
                      {simSummary.totalSteps - simSummary.dumpingSteps}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-gray-500">덤핑 위험</p>
                    <p className={`text-xl font-bold ${simSummary.dumpingSteps > 0 ? "text-red-600" : "text-green-600"}`}>
                      {simSummary.dumpingSteps}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 시뮬레이션 결과 시각화 */}
            {simResults.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">투찰금액 구간별 분포</h3>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {simResults.map((r, i) => {
                      const maxBid = Math.max(...simResults.map((s) => s.bidAmount));
                      const widthPercent = maxBid > 0 ? (r.bidAmount / maxBid) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-2 group">
                          <div className="w-16 text-right text-xs text-gray-500 font-mono shrink-0">
                            {r.rate.toFixed(2)}%
                          </div>
                          <div className="flex-1 relative h-5">
                            <div
                              className={`h-full rounded-r transition-all ${
                                r.isDumping ? "bg-red-400" : "bg-blue-400"
                              }`}
                              style={{ width: `${widthPercent}%` }}
                            />
                            {/* 하한가 마커 */}
                            {!r.isDumping && r.lowerLimit > 0 && maxBid > 0 && (
                              <div
                                className="absolute top-0 h-full w-px bg-red-500"
                                style={{ left: `${(r.lowerLimit / maxBid) * 100}%` }}
                              />
                            )}
                          </div>
                          <div className="w-20 text-right text-xs text-gray-600 font-mono shrink-0 opacity-0 group-hover:opacity-100">
                            {formatKRW(r.bidAmount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-blue-400 rounded" /> 적격
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-red-400 rounded" /> 덤핑 위험
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-red-500" /> 하한가
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── 탭 2: 몬테카를로 시뮬레이션 ── */}
      {activeTab === "montecarlo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800">몬테카를로 시뮬레이션</h2>
              <p className="text-xs text-gray-500">
                과거 사정률 분포 데이터를 기반으로 N회 시뮬레이션을 실행하여 하한가 통과율을 분석합니다.
              </p>

              {!lastParams && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                  먼저 &quot;구간별 시뮬레이션&quot; 탭에서 기본 시뮬레이션을 실행하세요.
                  기초금액, A값, 투찰률, 하한율이 자동으로 적용됩니다.
                </div>
              )}

              {lastParams && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs text-gray-600">
                  <p>기초금액: <span className="font-medium">{lastParams.foundationAmt.toLocaleString()}원</span></p>
                  <p>A값: <span className="font-medium">{lastParams.aValue.toLocaleString()}원</span></p>
                  <p>투찰률: <span className="font-medium">{lastParams.bidRate}%</span></p>
                  <p>낙찰하한율: <span className="font-medium">{lastParams.lowerLimitRate}%</span></p>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-600 mb-1">시뮬레이션 횟수</label>
                <select
                  value={mcIterations}
                  onChange={(e) => setMcIterations(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="100">100회 (빠른 테스트)</option>
                  <option value="1000">1,000회 (표준)</option>
                  <option value="5000">5,000회 (정밀)</option>
                  <option value="10000">10,000회 (최대)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">발주처 필터 (선택)</label>
                <input
                  type="text"
                  value={rateAgency}
                  onChange={(e) => setRateAgency(e.target.value)}
                  placeholder="예: 서울시, 국방부"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <button
                onClick={handleMonteCarlo}
                disabled={mcLoading || !lastParams}
                className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {mcLoading ? "시뮬레이션 실행 중..." : "몬테카를로 시뮬레이션 실행"}
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">시뮬레이션 결과</h2>
              <MonteCarloResult
                result={mcResult}
                loading={mcLoading}
                dataSource={mcDataSource}
                dataCount={mcDataCount}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 탭 3: 사정률 분포 ── */}
      {activeTab === "distribution" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800">사정률 분포 조회</h2>
              <p className="text-xs text-gray-500">
                DB에 수집된 과거 개찰 결과의 사정률 분포를 조회합니다.
              </p>

              <div>
                <label className="block text-xs text-gray-600 mb-1">조회 기간</label>
                <select
                  value={rateMonths}
                  onChange={(e) => setRateMonths(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="1">최근 1개월</option>
                  <option value="3">최근 3개월</option>
                  <option value="6">최근 6개월</option>
                  <option value="12">최근 12개월</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">발주처 필터 (선택)</label>
                <input
                  type="text"
                  value={rateAgency}
                  onChange={(e) => setRateAgency(e.target.value)}
                  placeholder="예: 서울시, 국방부"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <button
                onClick={handleRateDistribution}
                disabled={rateLoading}
                className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {rateLoading ? "조회 중..." : "사정률 분포 조회"}
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">분포 차트</h2>
              <RateDistributionChart
                buckets={rateData?.buckets || []}
                stats={rateData?.stats || { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, total: 0 }}
                loading={rateLoading}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 탭 4: 예비가격 조회 ── */}
      {activeTab === "lookup" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800">복수예비가격 조회</h2>
              <p className="text-xs text-gray-500">
                특정 공고번호의 15개 예비가격과 추첨 결과를 조회합니다.
              </p>

              <div>
                <label className="block text-xs text-gray-600 mb-1">공고번호</label>
                <input
                  type="text"
                  value={lookupBidNo}
                  onChange={(e) => setLookupBidNo(e.target.value)}
                  placeholder="예: 20260100001-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">입찰 유형</label>
                <select
                  value={lookupBidType}
                  onChange={(e) => setLookupBidType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="service">용역</option>
                  <option value="goods">물품</option>
                  <option value="construction">공사</option>
                </select>
              </div>

              <button
                onClick={handleReservePriceLookup}
                disabled={reserveLoading || !lookupBidNo.trim()}
                className="w-full py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {reserveLoading ? "조회 중..." : "예비가격 조회"}
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">예비가격 상세</h2>
              {reserveLoading ? (
                <div className="animate-pulse space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-6 bg-gray-200 rounded" />
                  ))}
                </div>
              ) : reserveData ? (
                <div className="space-y-4">
                  {/* 요약 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">기초금액</p>
                      <p className="text-sm font-bold">{formatKRW(reserveData.bssamt)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">예정가격</p>
                      <p className="text-sm font-bold">{formatKRW(reserveData.plnprc)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-gray-500">사정률</p>
                      <p className="text-lg font-bold text-blue-700">{reserveData.assessmentRate.toFixed(4)}%</p>
                    </div>
                  </div>

                  {/* 15개 예비가격 */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">예비가격 15개</p>
                    <div className="space-y-1">
                      {reserveData.reservePrices.map((rp) => (
                        <div
                          key={rp.index}
                          className={`flex items-center justify-between px-3 py-1.5 rounded text-sm ${
                            rp.isDrawn ? "bg-yellow-50 border border-yellow-300" : "bg-gray-50"
                          }`}
                        >
                          <span className="text-gray-500">#{rp.index}</span>
                          <span className="font-mono">{rp.price.toLocaleString()}원</span>
                          {rp.isDrawn && (
                            <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-medium">
                              추첨
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  공고번호를 입력하고 조회하세요.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 법적 면책조항 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-500 leading-relaxed">
        <p className="font-medium text-gray-600 mb-1">법적 안내</p>
        <p>
          본 도구는 나라장터(G2B)에서 공개된 과거 데이터를 기반으로 한 분석 도구이며,
          미래의 입찰 결과를 예측하거나 특정 투찰가를 추천하지 않습니다.
          시뮬레이션 결과는 참고용으로만 활용하시기 바라며, 실제 투찰 의사결정은
          사용자의 판단과 책임하에 이루어져야 합니다.
          본 서비스는 관련 법령(국가를 당사자로 하는 계약에 관한 법률 등)을 준수하며,
          입찰 담합, 가격 조작 등 위법행위를 조장하거나 지원하지 않습니다.
        </p>
      </div>
    </div>
  );
}

// ── Helper ──

function formatKRW(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(2)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}
