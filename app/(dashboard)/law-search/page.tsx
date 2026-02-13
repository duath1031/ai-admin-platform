"use client";

import { useState } from "react";
import { usePaywall } from "@/lib/billing/usePaywall";
import PaywallModal from "@/components/billing/PaywallModal";

// ---------------------------------------------------------------------------
// Types (mirrors LegalSearchResult from lawService)
// ---------------------------------------------------------------------------

interface IntentInfo {
  mode: "procedure" | "dispute" | "general";
  confidence: number;
  keywords: string[];
}

interface StatuteItem {
  lawId: string;
  lawName: string;
  lawType: string;
  lawUrl: string;
  relevantArticles?: string[];
}

interface PrecedentItem {
  caseNumber: string;
  caseName: string;
  court: string;
  decisionDate: string;
  summary: string;
  url: string;
}

interface RulingItem {
  rulingNumber: string;
  title: string;
  agency: string;
  decisionDate: string;
  summary: string;
  url: string;
}

interface FormItem {
  formName: string;
  formUrl: string;
  lawName: string;
  lawPage: string;
  isValidated?: boolean;
  fallbackUrl?: string;
}

interface LocalLawItem {
  lawName?: string;
  localGov?: string;
  lawUrl?: string;
}

interface LegalSearchResult {
  success: boolean;
  intent: IntentInfo;
  statutes: StatuteItem[];
  precedents: PrecedentItem[];
  rulings: RulingItem[];
  forms: FormItem[];
  localLaws: LocalLawItem[];
  error?: string;
  systemMessage?: string;
}

// ---------------------------------------------------------------------------
// Mode display helpers
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  procedure: { label: "절차/요건 검색", color: "bg-blue-100 text-blue-700" },
  dispute: { label: "분쟁/구제 검색", color: "bg-red-100 text-red-700" },
  general: { label: "일반 법령 검색", color: "bg-gray-100 text-gray-700" },
};

// ---------------------------------------------------------------------------
// Quick search presets
// ---------------------------------------------------------------------------

const QUICK_SEARCHES = [
  "건축허가 절차",
  "식품위생법 영업신고",
  "행정심판 청구",
  "사업자등록 절차",
  "공장등록 요건",
  "산업안전보건법",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LawSearchPage() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LegalSearchResult | null>(null);
  const [error, setError] = useState("");

  const { paywallProps, checkAndConsume } = usePaywall();

  // ---- Search handler ----
  const executeSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setError("검색어를 2자 이상 입력해주세요.");
      return;
    }

    const ok = await checkAndConsume("law_search");
    if (!ok) return;

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/law-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `서버 오류 (${res.status})`);
      }

      const data: LegalSearchResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "법령 검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => executeSearch(query);

  const handleQuickSearch = (q: string) => {
    setQuery(q);
    executeSearch(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) handleSearch();
  };

  // ---- Helper: total result count ----
  const totalCount = result
    ? result.statutes.length +
      result.precedents.length +
      result.rulings.length +
      result.forms.length +
      result.localLaws.length
    : 0;

  // ---- Render ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ===== Header ===== */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg mb-2">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">법령 검색</h1>
          <p className="text-gray-500">국가법령정보센터 연동 법령/판례/서식 통합 검색</p>
        </div>

        {/* ===== Search Card ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* Search input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="예: 식품위생법 영업허가, 건축허가 절차, 행정심판 청구"
              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              disabled={isLoading}
            />
          </div>

          {/* Quick search buttons */}
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium">자주 검색하는 키워드</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SEARCHES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickSearch(q)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-sm bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 rounded-lg border border-gray-200 hover:border-blue-300 transition-all disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Token badge + Search button */}
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              2,000 토큰 차감
            </span>
            <button
              onClick={handleSearch}
              disabled={isLoading || query.trim().length < 2}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  법령정보 검색 중...
                </span>
              ) : (
                "검색"
              )}
            </button>
          </div>
        </div>

        {/* ===== Error ===== */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* ===== Results ===== */}
        {result && (
          <div className="space-y-5">

            {/* Intent badge */}
            {result.intent && (
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${MODE_LABELS[result.intent.mode]?.color || "bg-gray-100 text-gray-700"}`}>
                  {MODE_LABELS[result.intent.mode]?.label || result.intent.mode}
                </span>
                {result.intent.keywords?.length > 0 && (
                  <span className="text-xs text-gray-400">
                    키워드: {result.intent.keywords.join(", ")}
                  </span>
                )}
              </div>
            )}

            {/* System message (warning) */}
            {result.systemMessage && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-yellow-800 text-sm">{result.systemMessage}</p>
              </div>
            )}

            {/* No results */}
            {totalCount === 0 && !result.systemMessage && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 font-medium">검색 결과가 없습니다.</p>
                <p className="text-gray-400 text-sm mt-1">다른 검색어를 입력해보세요.</p>
              </div>
            )}

            {/* ---- Statutes (법령) ---- */}
            {result.statutes.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  <h2 className="text-lg font-bold text-gray-900">
                    관련 법령 <span className="text-blue-600">({result.statutes.length}건)</span>
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {result.statutes.map((s, i) => (
                    <div key={`statute-${i}`} className="px-6 py-4 hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{s.lawName}</span>
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded">
                            {s.lawType}
                          </span>
                        </div>
                        <a
                          href={s.lawUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          법령 보기
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                      {s.relevantArticles && s.relevantArticles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {s.relevantArticles.map((art, j) => (
                            <span key={j} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              {art}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---- Precedents (판례) ---- */}
            {result.precedents.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                  <h2 className="text-lg font-bold text-gray-900">
                    관련 판례 <span className="text-purple-600">({result.precedents.length}건)</span>
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {result.precedents.map((p, i) => (
                    <div key={`prec-${i}`} className="px-6 py-4 hover:bg-purple-50/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{p.caseName}</p>
                          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                            <span>{p.caseNumber}</span>
                            <span className="text-gray-300">|</span>
                            <span>{p.court}</span>
                            {p.decisionDate && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span>{p.decisionDate}</span>
                              </>
                            )}
                          </div>
                          {p.summary && (
                            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{p.summary}</p>
                          )}
                        </div>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 font-medium flex-shrink-0"
                        >
                          판례 보기
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---- Rulings (행정심판 재결례) ---- */}
            {result.rulings.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h2 className="text-lg font-bold text-gray-900">
                    행정심판 재결례 <span className="text-teal-600">({result.rulings.length}건)</span>
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {result.rulings.map((r, i) => (
                    <div key={`ruling-${i}`} className="px-6 py-4 hover:bg-teal-50/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{r.title}</p>
                          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                            <span>{r.agency}</span>
                            {r.decisionDate && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span>{r.decisionDate}</span>
                              </>
                            )}
                          </div>
                          {r.summary && (
                            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{r.summary}</p>
                          )}
                        </div>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 font-medium flex-shrink-0"
                        >
                          재결례 보기
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---- Forms (서식) ---- */}
            {result.forms.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h2 className="text-lg font-bold text-gray-900">
                    관련 서식 <span className="text-green-600">({result.forms.length}건)</span>
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {result.forms.map((f, i) => (
                    <div key={`form-${i}`} className="px-6 py-4 hover:bg-green-50/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{f.formName}</p>
                          <p className="mt-1 text-sm text-gray-500">근거법령: {f.lawName}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={f.formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            다운로드
                          </a>
                          {f.lawPage && (
                            <a
                              href={f.lawPage}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 font-medium"
                            >
                              법령 페이지
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---- Local Laws (자치법규) ---- */}
            {result.localLaws.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h2 className="text-lg font-bold text-gray-900">
                    자치법규 <span className="text-orange-600">({result.localLaws.length}건)</span>
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {result.localLaws.map((l, i) => (
                    <div key={`local-${i}`} className="px-6 py-4 hover:bg-orange-50/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{l.lawName || "자치법규"}</p>
                          {l.localGov && (
                            <p className="mt-1 text-sm text-gray-500">{l.localGov}</p>
                          )}
                        </div>
                        {l.lawUrl && (
                          <a
                            href={l.lawUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800 font-medium"
                          >
                            법규 보기
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== External Links ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">참고 사이트</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href="https://www.law.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">국가법령정보센터</p>
                <p className="text-xs text-gray-400">law.go.kr</p>
              </div>
            </a>
            <a
              href="https://glaw.scourt.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-purple-700">대법원 종합법률정보</p>
                <p className="text-xs text-gray-400">glaw.scourt.go.kr</p>
              </div>
            </a>
            <a
              href="https://www.acrc.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-teal-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-teal-700">국민권익위원회</p>
                <p className="text-xs text-gray-400">acrc.go.kr</p>
              </div>
            </a>
          </div>
        </div>

        {/* ===== Disclaimer ===== */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            본 검색 결과는 참고용이며, 법률 해석은 전문가 상담을 권장합니다.
          </p>
        </div>

        {/* ===== Expert CTA ===== */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">행정사합동사무소 정의</h3>
              <p className="text-sm text-gray-300 mt-1">
                법령 해석, 인허가 절차, 행정심판 등 전문 상담이 필요하신가요?
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="tel:070-8657-1888"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              070-8657-1888
            </a>
            <a
              href="https://pf.kakao.com/_jWfwb"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-200 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.86 5.21 4.65 6.6-.14.53-.92 3.42-.95 3.64 0 0-.02.16.08.22.1.06.22.03.22.03.29-.04 3.37-2.2 3.9-2.57.68.1 1.38.15 2.1.15 5.52 0 10-3.58 10-7.97C22 6.58 17.52 3 12 3z" />
              </svg>
              카카오톡 상담
            </a>
            <a
              href="https://jungeui.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              온라인 의뢰 (jungeui.com)
            </a>
          </div>
        </div>

      </div>

      {/* ===== Paywall Modal ===== */}
      <PaywallModal {...paywallProps} />
    </div>
  );
}
