"use client";

import { useState, useEffect, useCallback } from "react";
import { runFundMatching, type FundMatchResult } from "@/lib/analytics/fundMatcher";

// ─── Types ───

interface DeadlineItem {
  id: string;
  title: string;
  agency: string;
  supportAmount: string | null;
  supportType: string | null;
  applicationEnd: string;
  detailUrl: string | null;
  daysLeft: number;
  urgency: "critical" | "high" | "medium" | "low";
  match: {
    id: string;
    matchScore: number;
    isBookmarked: boolean;
    isApplied: boolean;
  } | null;
}

interface BookmarkItem {
  id: string;
  matchScore: number;
  matchedCriteria: string[];
  unmatchedCriteria: string[];
  isApplied: boolean;
  appliedAt: string | null;
  program: {
    id: string;
    title: string;
    agency: string;
    supportAmount: string | null;
    supportType: string | null;
    applicationEnd: string | null;
    detailUrl: string | null;
  };
}

type TabId = "matching" | "deadlines" | "bookmarks";

const TABS: { id: TabId; label: string; icon: string }[] = [
  {
    id: "matching",
    label: "프로필 매칭",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    id: "deadlines",
    label: "마감임박",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    id: "bookmarks",
    label: "즐겨찾기",
    icon: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z",
  },
];

// ─── Helpers ───

function formatAmount(amount: number): string {
  if (amount <= 0) return "-";
  if (amount >= 100_000_000)
    return `${(amount / 100_000_000).toFixed(0)}억원`;
  if (amount >= 10_000)
    return `${Math.round(amount / 10_000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function DdayBadge({ days, size = "sm" }: { days: number; size?: "sm" | "lg" }) {
  const baseClass = size === "lg" ? "px-3 py-1.5 text-sm font-bold" : "px-2 py-0.5 text-xs font-medium";
  if (days <= 3) {
    return <span className={`${baseClass} rounded-full bg-red-100 text-red-700 animate-pulse`}>D-{days}</span>;
  }
  if (days <= 7) {
    return <span className={`${baseClass} rounded-full bg-orange-100 text-orange-700`}>D-{days}</span>;
  }
  if (days <= 14) {
    return <span className={`${baseClass} rounded-full bg-yellow-100 text-yellow-700`}>D-{days}</span>;
  }
  return <span className={`${baseClass} rounded-full bg-green-100 text-green-700`}>D-{days}</span>;
}

function UrgencyIcon({ urgency }: { urgency: string }) {
  if (urgency === "critical") return <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />;
  if (urgency === "high") return <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />;
  if (urgency === "medium") return <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />;
}

// ─── Main Component ───

export default function FundMatchingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("matching");

  // 프로필 매칭 state
  const [results, setResults] = useState<FundMatchResult[]>([]);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState("");
  const [filter, setFilter] = useState<"all" | "high" | "medium">("all");
  const [matchingApi, setMatchingApi] = useState(false);

  // AI 컨설팅 state
  const [consultingResult, setConsultingResult] = useState<{
    programName: string;
    analysis: string;
  } | null>(null);
  const [consultingLoading, setConsultingLoading] = useState(false);
  const [appGenLoading, setAppGenLoading] = useState<string | null>(null);

  // 마감임박 state
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [deadlineLoading, setDeadlineLoading] = useState(false);
  const [deadlineStats, setDeadlineStats] = useState({ total: 0, critical: 0 });

  // 즐겨찾기 state
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // ─── 프로필 매칭 ───

  useEffect(() => {
    fetchAndMatch();
  }, []);

  async function fetchAndMatch() {
    try {
      const res = await fetch("/api/user/company-profile");
      const data = await res.json();
      if (!data.success || !data.data) {
        setMatchError("기업 프로필을 먼저 등록해주세요. 마이페이지 > 기업정보에서 등록할 수 있습니다.");
        return;
      }
      const matchResults = runFundMatching(data.data);
      setResults(matchResults);
    } catch {
      setMatchError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setMatchLoading(false);
    }
  }

  async function runFullMatching() {
    setMatchingApi(true);
    try {
      const res = await fetch("/api/subsidy/match", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`매칭 완료! 총 ${data.summary.totalPrograms}개 프로그램, 높은 적합도 ${data.summary.highMatchCount}개`);
      } else {
        alert(data.error || "매칭 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setMatchingApi(false);
    }
  }

  async function requestConsulting(programName: string, programInfo: string) {
    setConsultingLoading(true);
    setConsultingResult(null);
    try {
      const res = await fetch("/api/subsidy/consulting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programName, programInfo }),
      });
      const data = await res.json();
      if (data.success) {
        setConsultingResult({ programName: data.programName, analysis: data.analysis });
      } else {
        alert(data.error || "분석 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setConsultingLoading(false);
    }
  }

  async function generateApplication(programName: string, programInfo: string) {
    setAppGenLoading(programName);
    try {
      const res = await fetch("/api/subsidy/generate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programName, programInfo }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`신청서가 생성되었습니다! 서류함에서 확인하세요.`);
        window.open(`/documents/${data.documentId}`, "_blank");
      } else {
        alert(data.error || "생성 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setAppGenLoading(null);
    }
  }

  // ─── 마감임박 ───

  const fetchDeadlines = useCallback(async () => {
    setDeadlineLoading(true);
    try {
      const res = await fetch("/api/subsidy/deadlines");
      const data = await res.json();
      if (data.success) {
        setDeadlines(data.deadlines || []);
        setDeadlineStats({ total: data.total, critical: data.critical });
      }
    } catch {
      // silent
    } finally {
      setDeadlineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "deadlines" && deadlines.length === 0) {
      fetchDeadlines();
    }
  }, [activeTab, deadlines.length, fetchDeadlines]);

  // ─── 즐겨찾기 ───

  const fetchBookmarks = useCallback(async () => {
    setBookmarkLoading(true);
    try {
      const res = await fetch("/api/subsidy/bookmark");
      const data = await res.json();
      if (data.success) {
        setBookmarks(data.bookmarks || []);
      }
    } catch {
      // silent
    } finally {
      setBookmarkLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "bookmarks" && bookmarks.length === 0) {
      fetchBookmarks();
    }
  }, [activeTab, bookmarks.length, fetchBookmarks]);

  async function toggleBookmark(matchId: string) {
    try {
      const res = await fetch("/api/subsidy/bookmark", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json();
      if (data.success) {
        // 즐겨찾기 목록 새로고침
        fetchBookmarks();
        // 마감임박 목록에서도 업데이트
        setDeadlines((prev) =>
          prev.map((d) =>
            d.match?.id === matchId
              ? { ...d, match: { ...d.match, isBookmarked: data.isBookmarked } }
              : d
          )
        );
      }
    } catch {
      // silent
    }
  }

  // ─── Computed ───

  const filteredResults =
    filter === "all" ? results : results.filter((r) => r.matchLevel === filter);
  const highCount = results.filter((r) => r.matchLevel === "high").length;
  const medCount = results.filter((r) => r.matchLevel === "medium").length;
  const maxAmount =
    results.length > 0
      ? Math.max(
          0,
          ...results.filter((r) => r.matchLevel === "high").map((r) => r.program.maxAmountNum)
        )
      : 0;

  // ─── Render ───

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">정부지원 / 정책자금</h1>
        <p className="text-sm text-gray-500 mt-1">
          기업마당 연동 + 기업 프로필 기반 정책자금 매칭, 마감일 추적, AI 전략 분석
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
            {tab.id === "deadlines" && deadlineStats.critical > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {deadlineStats.critical}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* Tab 1: 프로필 매칭 */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === "matching" && (
        <>
          {matchLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-500">정책자금 매칭을 분석하고 있습니다...</p>
            </div>
          ) : matchError ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
              <svg className="w-12 h-12 mx-auto text-yellow-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-yellow-800 font-medium">{matchError}</p>
              <a href="/mypage/company" className="inline-block mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm">
                기업정보 등록하기
              </a>
            </div>
          ) : (
            <>
              {/* 상단: 전체 매칭 버튼 + 요약 */}
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-3 gap-3 flex-1 mr-4">
                  <div className="bg-indigo-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-indigo-600 font-medium">분석 프로그램</p>
                    <p className="text-xl font-bold text-indigo-800 mt-0.5">{results.length}개</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-600 font-medium">높은 적합도</p>
                    <p className="text-xl font-bold text-green-800 mt-0.5">{highCount}개</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-600 font-medium">최대 지원금액</p>
                    <p className="text-xl font-bold text-blue-800 mt-0.5">{formatAmount(maxAmount)}</p>
                  </div>
                </div>
                <button
                  onClick={runFullMatching}
                  disabled={matchingApi}
                  className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 transition-colors whitespace-nowrap"
                >
                  {matchingApi ? "매칭 중..." : "전체 매칭 (2,000토큰)"}
                </button>
              </div>

              {/* 필터 */}
              <div className="flex gap-2">
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
                  <FundCard
                    key={result.program.id}
                    result={result}
                    onConsulting={requestConsulting}
                    consultingLoading={consultingLoading}
                    onGenerateApp={generateApplication}
                    appGenLoading={appGenLoading}
                  />
                ))}
                {filteredResults.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    해당 조건의 정책자금이 없습니다.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* Tab 2: 마감임박 */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === "deadlines" && (
        <>
          {deadlineLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-500">마감임박 프로그램을 조회하고 있습니다...</p>
            </div>
          ) : deadlines.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-600">30일 이내 마감 예정인 프로그램이 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">
                기업마당 동기화 크론이 실행되면 자동으로 프로그램이 추가됩니다.
              </p>
              <button
                onClick={fetchDeadlines}
                className="mt-4 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                새로고침
              </button>
            </div>
          ) : (
            <>
              {/* 마감 요약 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-600 font-medium">긴급 (3일 이내)</p>
                  <p className="text-xl font-bold text-red-800 mt-0.5">
                    {deadlines.filter((d) => d.urgency === "critical").length}건
                  </p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-orange-600 font-medium">주의 (7일 이내)</p>
                  <p className="text-xl font-bold text-orange-800 mt-0.5">
                    {deadlines.filter((d) => d.urgency === "high").length}건
                  </p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-yellow-600 font-medium">관심 (14일 이내)</p>
                  <p className="text-xl font-bold text-yellow-800 mt-0.5">
                    {deadlines.filter((d) => d.urgency === "medium").length}건
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-600 font-medium">여유 (30일 이내)</p>
                  <p className="text-xl font-bold text-green-800 mt-0.5">
                    {deadlines.filter((d) => d.urgency === "low").length}건
                  </p>
                </div>
              </div>

              {/* 마감임박 리스트 */}
              <div className="space-y-3">
                {deadlines.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-xl p-4 transition-colors hover:bg-gray-50 ${
                      item.urgency === "critical"
                        ? "border-red-200 bg-red-50/30"
                        : item.urgency === "high"
                          ? "border-orange-200"
                          : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <UrgencyIcon urgency={item.urgency} />
                          <span className="text-xs text-gray-500">{item.agency}</span>
                          {item.match && (
                            <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                              매칭 {item.match.matchScore}점
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                          {item.supportAmount && <span>{item.supportAmount}</span>}
                          {item.supportType && <span>{item.supportType}</span>}
                          <span>마감: {formatDate(item.applicationEnd)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <DdayBadge days={item.daysLeft} size="lg" />
                        {item.match && (
                          <button
                            onClick={() => toggleBookmark(item.match!.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            title={item.match.isBookmarked ? "즐겨찾기 해제" : "즐겨찾기"}
                          >
                            <svg
                              className={`w-5 h-5 ${item.match.isBookmarked ? "text-yellow-500 fill-yellow-500" : "text-gray-400"}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </button>
                        )}
                        {item.detailUrl && (
                          <a
                            href={item.detailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            상세
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* Tab 3: 즐겨찾기 */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === "bookmarks" && (
        <>
          {bookmarkLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-500">즐겨찾기를 불러오고 있습니다...</p>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-lg font-medium text-gray-600">즐겨찾기한 프로그램이 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">
                마감임박 탭에서 관심 프로그램을 즐겨찾기에 추가하세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((item) => {
                const daysLeft = item.program.applicationEnd
                  ? Math.ceil((new Date(item.program.applicationEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <div key={item.id} className="border border-yellow-200 rounded-xl p-4 bg-yellow-50/30 hover:bg-yellow-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-yellow-500 fill-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          <span className="text-xs text-gray-500">{item.program.agency}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                            매칭 {item.matchScore}점
                          </span>
                          {item.isApplied && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">
                              신청완료
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900">{item.program.title}</p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                          {item.program.supportAmount && <span>{item.program.supportAmount}</span>}
                          {item.program.supportType && <span>{item.program.supportType}</span>}
                          {item.program.applicationEnd && (
                            <span>마감: {formatDate(item.program.applicationEnd)}</span>
                          )}
                        </div>

                        {/* 매칭/미매칭 요약 */}
                        {(item.matchedCriteria.length > 0 || item.unmatchedCriteria.length > 0) && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {item.matchedCriteria.map((c, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                {c}
                              </span>
                            ))}
                            {item.unmatchedCriteria.map((c, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {daysLeft !== null && daysLeft > 0 && (
                          <DdayBadge days={daysLeft} />
                        )}
                        {daysLeft !== null && daysLeft <= 0 && (
                          <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full">마감</span>
                        )}
                        <button
                          onClick={() => toggleBookmark(item.id)}
                          className="p-1.5 rounded-lg hover:bg-yellow-100 transition-colors"
                          title="즐겨찾기 해제"
                        >
                          <svg className="w-5 h-5 text-yellow-500 fill-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                        {item.program.detailUrl && (
                          <a
                            href={item.program.detailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            상세
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* AI 전략 분석 결과 모달 */}
      {consultingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConsultingResult(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                AI 전략 분석: {consultingResult.programName}
              </h2>
              <button onClick={() => setConsultingResult(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="prose prose-sm max-w-none">
              {consultingResult.analysis.split("\n").map((line, i) => {
                if (line.startsWith("## "))
                  return <h3 key={i} className="text-base font-bold mt-4 mb-2">{line.replace("## ", "")}</h3>;
                if (line.startsWith("### "))
                  return <h4 key={i} className="text-sm font-bold mt-3 mb-1">{line.replace("### ", "")}</h4>;
                if (line.startsWith("- "))
                  return <li key={i} className="text-sm text-gray-700 ml-4">{line.replace("- ", "")}</li>;
                if (line.trim() === "") return <br key={i} />;
                return <p key={i} className="text-sm text-gray-700">{line}</p>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* 안내 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-500 leading-relaxed">
        <p className="font-medium text-gray-600 mb-1">안내</p>
        <p>
          본 매칭 결과는 기업 프로필 데이터 기반의 참고용입니다. 실제 신청 요건은 각 사업 공고문을
          확인하시기 바랍니다. 기업마당(bizinfo.go.kr) 데이터는 매일 자동 동기화됩니다.
          신청서 자동 작성 기능은 AI가 기업 정보를 기반으로 초안을 생성하는 것이며,
          실제 접수를 대행하지 않습니다.
        </p>
      </div>
    </div>
  );
}

// ─── FundCard (프로필 매칭 결과 카드) ───

function FundCard({
  result,
  onConsulting,
  consultingLoading,
  onGenerateApp,
  appGenLoading,
}: {
  result: FundMatchResult;
  onConsulting: (name: string, info: string) => void;
  consultingLoading: boolean;
  onGenerateApp: (name: string, info: string) => void;
  appGenLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const levelColor = {
    high: {
      border: "border-green-200",
      bg: "bg-green-50",
      badge: "bg-green-100 text-green-700",
      bar: "bg-green-500",
    },
    medium: {
      border: "border-yellow-200",
      bg: "bg-yellow-50",
      badge: "bg-yellow-100 text-yellow-700",
      bar: "bg-yellow-500",
    },
    low: {
      border: "border-red-200",
      bg: "bg-red-50",
      badge: "bg-red-100 text-red-700",
      bar: "bg-red-500",
    },
  }[result.matchLevel];

  const programInfo = `${result.program.description} / ${result.program.maxAmount} / ${result.program.supportType}`;

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
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
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
          <div className={`mt-3 p-3 rounded-lg text-sm ${levelColor.bg}`}>{result.recommendation}</div>
          <div className="flex flex-wrap gap-2 mt-4">
            <a
              href={result.program.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              공식 사이트
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <button
              onClick={() => onConsulting(result.program.name, programInfo)}
              disabled={consultingLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              {consultingLoading ? "분석 중..." : "AI 전략 분석 (3,000토큰)"}
            </button>
            <button
              onClick={() => onGenerateApp(result.program.name, programInfo)}
              disabled={appGenLoading !== null}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {appGenLoading === result.program.name ? "생성 중..." : "신청서 초안 작성 (5,000토큰)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
