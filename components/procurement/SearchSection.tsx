"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui";
import {
  filterBids,
  type SmartFilterResult,
  type CompanyDataForBid,
} from "@/lib/analytics/smartBidFilter";

// ─── Types ───

interface BidItem {
  bidNtceNo: string;
  bidNtceNm: string;
  ntceInsttNm: string;
  demandInsttNm: string;
  bidNtceDt: string;
  bidClseDt: string;
  presmptPrce: number;
  bidNtceUrl: string;
  bidMethdNm: string;
  sucsfbidMthdNm: string;
  ntceKindNm: string;
  region: string;
  daysRemaining: number;
}

interface BidResult {
  success: boolean;
  items: BidItem[];
  totalCount: number;
  summary: {
    avgAmount: number;
    minAmount: number;
    maxAmount: number;
    byType: Record<string, number>;
    byRegion: Record<string, number>;
    byMethod: Record<string, number>;
  };
  recommendation: string;
  error?: string;
}

interface PreSpecItem {
  prcureReqstNo: string;
  prcureReqstNm: string;
  rlDminsttNm: string;
  rgstDt: string;
  opninRgstClseDt: string;
  prcureReqstUrl: string;
  asignBdgtAmt: number;
  daysRemaining: number;
}

interface PreSpecResult {
  success: boolean;
  items: PreSpecItem[];
  totalCount: number;
  summary: { avgBudget: number; totalBudget: number };
  error?: string;
}

interface WinningBidItem {
  bidNtceNo: string;
  bidNtceNm: string;
  ntceInsttNm: string;
  sucsfbidAmt: number;
  sucsfbidRate: number;
  sucsfbidCorpNm: string;
  presmptPrce: number;
  opengDt: string;
  bidMethdNm: string;
  sucsfbidMthdNm: string;
}

interface WinningBidResult {
  success: boolean;
  items: WinningBidItem[];
  totalCount: number;
  summary: {
    avgRate: number;
    minRate: number;
    maxRate: number;
    avgAmount: number;
    totalAmount: number;
    byMethod: Record<string, { count: number; avgRate: number }>;
  };
  recommendation: string;
  error?: string;
}

// ─── Constants ───

const REGIONS = [
  "", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const BID_TYPES = [
  { value: "service", label: "용역" },
  { value: "goods", label: "물품" },
  { value: "construction", label: "공사" },
];

const TABS = [
  { id: "bid", label: "공고검색", color: "teal" },
  { id: "prespec", label: "사전규격", color: "indigo" },
  { id: "winning", label: "낙찰분석", color: "amber" },
  { id: "smartfilter", label: "스마트필터", color: "emerald" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Helpers ───

function formatKRW(amount: number): string {
  if (!amount) return "0원";
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}억원`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return dateStr || "-";
  const clean = dateStr.replace(/[^0-9]/g, "");
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
}

function DdayBadge({ days }: { days: number }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full ${
        days > 3
          ? "bg-green-100 text-green-700"
          : days > 0
            ? "bg-yellow-100 text-yellow-700"
            : "bg-gray-100 text-gray-500"
      }`}
    >
      {days > 0 ? `D-${days}` : "마감"}
    </span>
  );
}

// ─── Sub Components ───

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    gray: "bg-gray-50 text-gray-700",
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <Card>
      <CardContent className={`p-4 ${colorMap[color] || colorMap.gray}`}>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-lg font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="p-8 text-center text-gray-400">{message}</div>;
}

function SmartFilterRow({ result }: { result: SmartFilterResult }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = {
    eligible: { label: "참여가능", bg: "bg-green-100 text-green-700" },
    conditional: { label: "조건부", bg: "bg-yellow-100 text-yellow-700" },
    ineligible: { label: "부적격", bg: "bg-red-100 text-red-700" },
  }[result.overallStatus];

  return (
    <>
      <tr
        className="border-b hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-3 text-center">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusConfig.bg}`}>
            {statusConfig.label}
          </span>
        </td>
        <td className="px-3 py-3 max-w-xs">
          <p className="font-medium text-gray-800 truncate" title={result.bid.bidNtceNm}>
            {result.bid.bidNtceNm}
          </p>
        </td>
        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{result.bid.ntceInsttNm}</td>
        <td className="px-3 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
          {formatKRW(result.bid.presmptPrce)}
        </td>
        <td className="px-3 py-3 text-center whitespace-nowrap">
          <span className="text-xs text-green-600">{result.passCount}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-xs text-yellow-600">{result.warnCount}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-xs text-red-600">{result.failCount}</span>
        </td>
        <td className="px-2 py-3 whitespace-nowrap">
          <DdayBadge days={result.bid.daysRemaining} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-b bg-gray-50">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {result.checks.map((check, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  {check.status === "pass" && <span className="w-2 h-2 rounded-full bg-green-500" />}
                  {check.status === "warn" && <span className="w-2 h-2 rounded-full bg-yellow-500" />}
                  {check.status === "fail" && <span className="w-2 h-2 rounded-full bg-red-500" />}
                  {check.status === "unknown" && <span className="w-2 h-2 rounded-full bg-gray-400" />}
                  <span className="font-medium text-gray-700">{check.name}:</span>
                  <span className="text-gray-500 truncate" title={check.detail}>
                    {check.detail}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-600">{result.summary}</p>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ───

export default function SearchSection() {
  const [activeTab, setActiveTab] = useState<TabId>("bid");
  const [keyword, setKeyword] = useState("");
  const [bidType, setBidType] = useState("service");
  const [region, setRegion] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Tab results
  const [bidResult, setBidResult] = useState<BidResult | null>(null);
  const [preSpecResult, setPreSpecResult] = useState<PreSpecResult | null>(null);
  const [winningResult, setWinningResult] = useState<WinningBidResult | null>(null);

  // Smart filter
  const [smartFilterResults, setSmartFilterResults] = useState<SmartFilterResult[]>([]);
  const [companyData, setCompanyData] = useState<CompanyDataForBid | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (activeTab === "bid") {
        setBidResult(null);
        const body: Record<string, unknown> = { bidType };
        if (keyword.trim()) body.keyword = keyword.trim();
        if (region) body.region = region;
        if (minAmount) body.minAmount = Number(minAmount);
        if (maxAmount) body.maxAmount = Number(maxAmount);

        const res = await fetch("/api/analytics/bid-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "검색 실패");
        setBidResult(data);
      } else if (activeTab === "prespec") {
        setPreSpecResult(null);
        const body: Record<string, unknown> = {};
        if (keyword.trim()) body.keyword = keyword.trim();

        const res = await fetch("/api/analytics/bid-analysis?action=prespec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "검색 실패");
        setPreSpecResult(data);
      } else if (activeTab === "winning") {
        setWinningResult(null);
        const body: Record<string, unknown> = { bidType };
        if (keyword.trim()) body.keyword = keyword.trim();

        const res = await fetch("/api/analytics/bid-analysis?action=winning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "검색 실패");
        setWinningResult(data);
      } else if (activeTab === "smartfilter") {
        const body: Record<string, unknown> = { bidType };
        if (keyword.trim()) body.keyword = keyword.trim();
        if (region) body.region = region;
        if (minAmount) body.minAmount = Number(minAmount);
        if (maxAmount) body.maxAmount = Number(maxAmount);

        const res = await fetch("/api/analytics/bid-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const bidData = await res.json();
        if (!bidData.success) throw new Error(bidData.error || "검색 실패");
        setBidResult(bidData);

        if (!companyData) {
          setProfileLoading(true);
          setProfileError("");
          try {
            const profileRes = await fetch("/api/user/company-profile");
            const profileJson = await profileRes.json();
            if (profileJson.success && profileJson.data) {
              setCompanyData(profileJson.data);
              const filtered = filterBids(bidData.items, profileJson.data);
              setSmartFilterResults(filtered);
            } else {
              setProfileError("기업 프로필을 먼저 등록해주세요.");
            }
          } finally {
            setProfileLoading(false);
          }
        } else {
          const filtered = filterBids(bidData.items, companyData);
          setSmartFilterResults(filtered);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, keyword, bidType, region, minAmount, maxAmount, companyData]);

  const tabColor = (tabId: TabId, isActive: boolean) => {
    if (!isActive) return "border-transparent text-gray-500 hover:text-gray-700";
    const map: Record<TabId, string> = {
      bid: "border-teal-600 text-teal-700",
      prespec: "border-indigo-600 text-indigo-700",
      winning: "border-amber-600 text-amber-700",
      smartfilter: "border-emerald-600 text-emerald-700",
    };
    return map[tabId];
  };

  const searchBtnColor: Record<TabId, string> = {
    bid: "bg-teal-600 hover:bg-teal-700",
    prespec: "bg-indigo-600 hover:bg-indigo-700",
    winning: "bg-amber-600 hover:bg-amber-700",
    smartfilter: "bg-emerald-600 hover:bg-emerald-700",
  };

  const searchBtnLabel: Record<TabId, string> = {
    bid: "입찰공고 검색",
    prespec: "사전규격 검색",
    winning: "낙찰정보 검색",
    smartfilter: "스마트 필터 검색",
  };

  const showBidType = activeTab === "bid" || activeTab === "winning" || activeTab === "smartfilter";
  const showRegion = activeTab === "bid" || activeTab === "smartfilter";
  const showAmount = activeTab === "bid" || activeTab === "smartfilter";

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tabColor(tab.id, activeTab === tab.id)}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Form */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Keyword */}
            <div className={activeTab === "prespec" ? "md:col-span-2 lg:col-span-3" : "md:col-span-2"}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                검색 키워드
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={
                  activeTab === "bid"
                    ? "예: SW개발, 시스템 구축, 컨설팅"
                    : activeTab === "prespec"
                      ? "예: 정보시스템, 소프트웨어"
                      : "예: 용역, 시스템 유지보수"
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {/* Bid Type */}
            {showBidType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  입찰 유형
                </label>
                <select
                  value={bidType}
                  onChange={(e) => setBidType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {BID_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Region */}
            {showRegion && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  지역
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">전체</option>
                  {REGIONS.filter(Boolean).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount Range */}
            {showAmount && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    최소 금액 (만원)
                  </label>
                  <input
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    최대 금액 (만원)
                  </label>
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="제한없음"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Search Button */}
            <div className={`flex items-end ${activeTab === "prespec" ? "" : "md:col-span-2 lg:col-span-2"}`}>
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className={`w-full py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${searchBtnColor[activeTab]}`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    검색 중...
                  </span>
                ) : (
                  searchBtnLabel[activeTab]
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}
        </CardContent>
      </Card>

      {/* ─── Bid Results ─── */}
      {activeTab === "bid" && bidResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="총 건수" value={`${bidResult.totalCount}건`} color="teal" />
            <SummaryCard label="평균 추정가" value={formatKRW(bidResult.summary.avgAmount)} color="blue" />
            <SummaryCard label="최소 금액" value={formatKRW(bidResult.summary.minAmount)} color="gray" />
            <SummaryCard label="최대 금액" value={formatKRW(bidResult.summary.maxAmount)} color="indigo" />
          </div>

          <Card>
            <CardContent className="p-4 bg-teal-50">
              <p className="text-sm text-teal-700">{bidResult.recommendation}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {bidResult.items.length === 0 ? (
                <EmptyState message="검색 조건에 맞는 공고가 없습니다." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b text-left">
                        <th className="px-3 py-3 font-medium text-gray-600">공고명</th>
                        <th className="px-3 py-3 font-medium text-gray-600">공고기관</th>
                        <th className="px-3 py-3 font-medium text-gray-600 text-right">추정가격</th>
                        <th className="px-2 py-3 font-medium text-gray-600">마감</th>
                        <th className="px-2 py-3 font-medium text-gray-600">방식</th>
                        <th className="px-2 py-3 font-medium text-gray-600 text-center">링크</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bidResult.items.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-3 max-w-xs">
                            <p className="font-medium text-gray-800 truncate" title={item.bidNtceNm}>
                              {item.bidNtceNm}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{item.ntceInsttNm}</td>
                          <td className="px-3 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                            {formatKRW(item.presmptPrce)}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap">
                            <DdayBadge days={item.daysRemaining} />
                          </td>
                          <td
                            className="px-2 py-3 text-gray-500 text-xs whitespace-nowrap max-w-[80px] truncate"
                            title={item.sucsfbidMthdNm || item.bidMethdNm}
                          >
                            {item.sucsfbidMthdNm || item.bidMethdNm}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <a
                              href={item.bidNtceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-800 font-medium text-xs bg-teal-50 px-2 py-1 rounded hover:bg-teal-100 transition-colors"
                            >
                              상세
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Pre-Spec Results ─── */}
      {activeTab === "prespec" && preSpecResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SummaryCard label="총 건수" value={`${preSpecResult.totalCount}건`} color="indigo" />
            <SummaryCard label="평균 배정예산" value={formatKRW(preSpecResult.summary.avgBudget)} color="blue" />
            <SummaryCard label="배정예산 합계" value={formatKRW(preSpecResult.summary.totalBudget)} color="gray" />
          </div>

          <Card>
            <CardContent className="p-0">
              {preSpecResult.items.length === 0 ? (
                <EmptyState message="검색 조건에 맞는 사전규격이 없습니다." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b text-left">
                        <th className="px-4 py-3 font-medium text-gray-600">사전규격명</th>
                        <th className="px-4 py-3 font-medium text-gray-600">수요기관</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-right">배정예산</th>
                        <th className="px-4 py-3 font-medium text-gray-600">의견마감</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-center">링크</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preSpecResult.items.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 max-w-xs">
                            <p className="font-medium text-gray-800 truncate" title={item.prcureReqstNm}>
                              {item.prcureReqstNm}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{item.rlDminsttNm}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                            {formatKRW(item.asignBdgtAmt)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <DdayBadge days={item.daysRemaining} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <a
                              href={item.prcureReqstUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                            >
                              상세보기
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Winning Bid Results ─── */}
      {activeTab === "winning" && winningResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="총 건수" value={`${winningResult.totalCount}건`} color="amber" />
            <SummaryCard label="평균 낙찰률" value={`${winningResult.summary.avgRate}%`} color="teal" />
            <SummaryCard label="평균 낙찰금액" value={formatKRW(winningResult.summary.avgAmount)} color="blue" />
            <SummaryCard
              label="낙찰률 범위"
              value={`${winningResult.summary.minRate}% ~ ${winningResult.summary.maxRate}%`}
              color="gray"
            />
          </div>

          {Object.keys(winningResult.summary.byMethod).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">낙찰방식별 분석</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(winningResult.summary.byMethod).map(([method, data]) => (
                    <div key={method} className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xs text-amber-600 font-medium">{method || "기타"}</p>
                      <p className="text-lg font-bold text-amber-800">{data.avgRate}%</p>
                      <p className="text-xs text-amber-500">{data.count}건</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 bg-amber-50">
              <p className="text-sm text-amber-700">{winningResult.recommendation}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {winningResult.items.length === 0 ? (
                <EmptyState message="검색 조건에 맞는 낙찰 정보가 없습니다." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b text-left">
                        <th className="px-4 py-3 font-medium text-gray-600">공고명</th>
                        <th className="px-4 py-3 font-medium text-gray-600">낙찰업체</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-right">낙찰금액</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-right">낙찰률</th>
                        <th className="px-4 py-3 font-medium text-gray-600">개찰일</th>
                        <th className="px-4 py-3 font-medium text-gray-600">방식</th>
                      </tr>
                    </thead>
                    <tbody>
                      {winningResult.items.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 max-w-xs">
                            <p className="font-medium text-gray-800 truncate" title={item.bidNtceNm}>
                              {item.bidNtceNm}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {item.sucsfbidCorpNm || "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                            {formatKRW(item.sucsfbidAmt)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded-full ${
                                item.sucsfbidRate >= 90
                                  ? "bg-green-100 text-green-700"
                                  : item.sucsfbidRate >= 80
                                    ? "bg-yellow-100 text-yellow-700"
                                    : item.sucsfbidRate > 0
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {item.sucsfbidRate > 0 ? `${item.sucsfbidRate}%` : "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {formatDateDisplay(item.opengDt)}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {item.sucsfbidMthdNm || item.bidMethdNm}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Smart Filter Results ─── */}
      {activeTab === "smartfilter" && smartFilterResults.length > 0 && (
        <div className="space-y-4">
          {profileError && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              {profileError}
              <a href="/mypage/company" className="ml-2 text-yellow-700 underline font-medium">
                기업정보 등록
              </a>
            </div>
          )}
          {profileLoading && (
            <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
              기업 프로필을 불러오는 중...
            </div>
          )}
          {!profileError && !profileLoading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="총 공고" value={`${smartFilterResults.length}건`} color="teal" />
                <SummaryCard
                  label="참여 가능"
                  value={`${smartFilterResults.filter((r) => r.overallStatus === "eligible").length}건`}
                  color="emerald"
                />
                <SummaryCard
                  label="조건부"
                  value={`${smartFilterResults.filter((r) => r.overallStatus === "conditional").length}건`}
                  color="amber"
                />
                <SummaryCard
                  label="부적격"
                  value={`${smartFilterResults.filter((r) => r.overallStatus === "ineligible").length}건`}
                  color="gray"
                />
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b text-left">
                          <th className="px-3 py-3 font-medium text-gray-600 text-center w-20">판정</th>
                          <th className="px-3 py-3 font-medium text-gray-600">공고명</th>
                          <th className="px-3 py-3 font-medium text-gray-600">공고기관</th>
                          <th className="px-3 py-3 font-medium text-gray-600 text-right">추정가격</th>
                          <th className="px-3 py-3 font-medium text-gray-600 text-center">체크</th>
                          <th className="px-2 py-3 font-medium text-gray-600">마감</th>
                        </tr>
                      </thead>
                      <tbody>
                        {smartFilterResults.map((result, i) => (
                          <SmartFilterRow key={i} result={result} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Smart filter empty state */}
      {activeTab === "smartfilter" && smartFilterResults.length === 0 && !isLoading && (
        <div className="mt-12 text-center text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <p className="text-lg font-medium">기업 프로필 기반 입찰 적격성을 분석합니다</p>
          <p className="text-sm mt-1">입찰공고를 검색하면 자동으로 참여 가능 여부를 판정합니다.</p>
        </div>
      )}

      {/* Default empty state for other tabs */}
      {activeTab !== "smartfilter" &&
        !bidResult &&
        !preSpecResult &&
        !winningResult &&
        !isLoading && (
          <div className="mt-12 text-center text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-lg font-medium">
              {activeTab === "bid"
                ? "입찰공고를 검색하세요"
                : activeTab === "prespec"
                  ? "사전규격을 검색하세요"
                  : "낙찰정보를 검색하세요"}
            </p>
            <p className="text-sm mt-1">나라장터 공공데이터 API를 통해 실시간 조달 정보를 조회합니다.</p>
          </div>
        )}
    </div>
  );
}
