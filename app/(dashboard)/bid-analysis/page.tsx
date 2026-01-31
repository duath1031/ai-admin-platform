"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui";

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

const REGIONS = [
  "", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const BID_TYPES = [
  { value: "service", label: "용역" },
  { value: "goods", label: "물품" },
  { value: "construction", label: "공사" },
];

export default function BidAnalysisPage() {
  const [keyword, setKeyword] = useState("");
  const [bidType, setBidType] = useState("service");
  const [region, setRegion] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BidResult | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setIsLoading(true);
    setError("");
    setResult(null);

    try {
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

      if (!res.ok) throw new Error("API 요청 실패");

      const data: BidResult = await res.json();
      if (!data.success) throw new Error(data.error || "검색 실패");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">나라장터 입찰 분석</h1>
        <p className="text-gray-500 mt-1">
          공공조달 입찰공고를 검색하고 참여 가능성을 분석합니다.
        </p>
      </div>

      {/* 검색 폼 */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                검색 키워드
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: SW개발, 시스템 구축, 컨설팅"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

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

            <div className="md:col-span-2 lg:col-span-2 flex items-end">
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  "입찰공고 검색"
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 결과 */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="총 건수" value={`${result.totalCount}건`} color="teal" />
            <SummaryCard
              label="평균 추정가"
              value={formatKRW(result.summary.avgAmount)}
              color="blue"
            />
            <SummaryCard
              label="최소 금액"
              value={formatKRW(result.summary.minAmount)}
              color="gray"
            />
            <SummaryCard
              label="최대 금액"
              value={formatKRW(result.summary.maxAmount)}
              color="indigo"
            />
          </div>

          {/* 추천 */}
          <Card>
            <CardContent className="p-4 bg-teal-50">
              <p className="text-sm text-teal-700">{result.recommendation}</p>
            </CardContent>
          </Card>

          {/* 공고 리스트 */}
          <Card>
            <CardContent className="p-0">
              {result.items.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  검색 조건에 맞는 공고가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b text-left">
                        <th className="px-4 py-3 font-medium text-gray-600">공고명</th>
                        <th className="px-4 py-3 font-medium text-gray-600">공고기관</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-right">추정가격</th>
                        <th className="px-4 py-3 font-medium text-gray-600">마감</th>
                        <th className="px-4 py-3 font-medium text-gray-600">방식</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-center">링크</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 max-w-xs">
                            <p className="font-medium text-gray-800 truncate" title={item.bidNtceNm}>
                              {item.bidNtceNm}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {item.ntceInsttNm}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                            {formatKRW(item.presmptPrce)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`text-xs font-medium px-2 py-1 rounded-full ${
                                item.daysRemaining > 3
                                  ? "bg-green-100 text-green-700"
                                  : item.daysRemaining > 0
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {item.daysRemaining > 0
                                ? `D-${item.daysRemaining}`
                                : "마감"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {item.sucsfbidMthdNm || item.bidMethdNm}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <a
                              href={item.bidNtceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-600 hover:text-teal-800 font-medium text-xs"
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

      {/* 빈 상태 */}
      {!result && !isLoading && (
        <div className="mt-12 text-center text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg font-medium">검색 조건을 입력하고 검색하세요</p>
          <p className="text-sm mt-1">나라장터 공공데이터 API를 통해 실시간 입찰공고를 조회합니다.</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    gray: "bg-gray-50 text-gray-700",
    indigo: "bg-indigo-50 text-indigo-700",
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

function formatKRW(amount: number): string {
  if (!amount) return "0원";
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}
