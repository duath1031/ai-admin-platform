"use client";

import { useState, useEffect } from "react";
import { runFundMatching, type FundMatchResult } from "@/lib/analytics/fundMatcher";

export default function FundMatchingPage() {
  const [results, setResults] = useState<FundMatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "high" | "medium">("all");

  useEffect(() => {
    fetchAndMatch();
  }, []);

  async function fetchAndMatch() {
    try {
      const res = await fetch("/api/user/company-profile");
      const data = await res.json();
      if (!data.success || !data.data) {
        setError("기업 프로필을 먼저 등록해주세요. 마이페이지 > 기업정보에서 등록할 수 있습니다.");
        return;
      }
      const matchResults = runFundMatching(data.data);
      setResults(matchResults);
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-gray-500">정책자금 매칭을 분석하고 있습니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 mx-auto text-yellow-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-yellow-800 font-medium">{error}</p>
          <a href="/mypage/company" className="inline-block mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm">
            기업정보 등록하기
          </a>
        </div>
      </div>
    );
  }

  const filteredResults = filter === "all" ? results : results.filter(r => r.matchLevel === filter);
  const highCount = results.filter(r => r.matchLevel === "high").length;
  const medCount = results.filter(r => r.matchLevel === "medium").length;
  const maxAmount = results.length > 0 ? Math.max(...results.filter(r => r.matchLevel === "high").map(r => r.program.maxAmountNum)) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">정책자금 매칭</h1>
        <p className="text-gray-500 mt-1">
          기업 프로필 기반으로 신청 가능한 정책자금을 자동 매칭합니다.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-indigo-50 rounded-xl p-4 text-center">
          <p className="text-xs text-indigo-600 font-medium">분석 프로그램</p>
          <p className="text-2xl font-bold text-indigo-800 mt-1">{results.length}개</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-xs text-green-600 font-medium">높은 적합도</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{highCount}개</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-xs text-blue-600 font-medium">최대 지원금액</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{formatAmount(maxAmount)}</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "all" as const, label: "전체", count: results.length },
          { key: "high" as const, label: "높은 적합", count: highCount },
          { key: "medium" as const, label: "보통", count: medCount },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* 결과 리스트 */}
      <div className="space-y-4">
        {filteredResults.map((result) => (
          <FundCard key={result.program.id} result={result} />
        ))}
        {filteredResults.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            해당 조건의 정책자금이 없습니다.
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-xl text-xs text-gray-500">
        * 본 매칭 결과는 기업 프로필 데이터 기반의 참고용입니다. 실제 신청 요건은 각 사업 공고문을 확인하시기 바랍니다. 공모 시기는 프로그램마다 다릅니다.
      </div>
    </div>
  );
}

function FundCard({ result }: { result: FundMatchResult }) {
  const [expanded, setExpanded] = useState(false);

  const levelColor = {
    high: { border: "border-green-200", bg: "bg-green-50", badge: "bg-green-100 text-green-700", bar: "bg-green-500" },
    medium: { border: "border-yellow-200", bg: "bg-yellow-50", badge: "bg-yellow-100 text-yellow-700", bar: "bg-yellow-500" },
    low: { border: "border-red-200", bg: "bg-red-50", badge: "bg-red-100 text-red-700", bar: "bg-red-500" },
  }[result.matchLevel];

  return (
    <div className={`border rounded-xl overflow-hidden ${levelColor.border}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${levelColor.badge}`}>
                {result.matchLevel === "high" ? "높음" : result.matchLevel === "medium" ? "보통" : "낮음"}
              </span>
              <span className="text-xs text-gray-500">{result.program.category}</span>
              <span className="text-xs text-gray-400">{result.program.agency}</span>
            </div>
            <p className="font-semibold text-gray-900">{result.program.name}</p>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span>{result.program.maxAmount}</span>
              <span>{result.program.supportType}</span>
              <span>{result.program.period}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800">{result.matchScore}</p>
              <p className="text-xs text-gray-400">점</p>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {/* 점수 바 */}
        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${levelColor.bar}`} style={{ width: `${result.matchScore}%` }} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <p className="text-sm text-gray-600 mt-3 mb-3">{result.program.description}</p>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-green-700 mb-2">충족 요건</p>
              {result.metRequirements.length > 0 ? (
                <ul className="space-y-1">
                  {result.metRequirements.map((item, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-sm text-green-800">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">없음</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-red-700 mb-2">미충족 요건</p>
              {result.unmetRequirements.length > 0 ? (
                <ul className="space-y-1">
                  {result.unmetRequirements.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-red-800">
                      <svg className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">없음</p>
              )}
            </div>
          </div>

          <div className={`mt-3 p-3 rounded-lg text-sm ${levelColor.bg}`}>
            {result.recommendation}
          </div>

          <a
            href={result.program.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-sm text-indigo-600 hover:text-indigo-800"
          >
            공식 사이트 방문
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

function formatAmount(amount: number): string {
  if (amount <= 0) return "-";
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(0)}억원`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}
