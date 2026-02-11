"use client";

import { useState, useEffect } from "react";
import { runCertificationCheck, type CertEligibilityResult, type CompanyData } from "@/lib/analytics/certificationChecker";

export default function CertificationCheckPage() {
  const [profile, setProfile] = useState<CompanyData | null>(null);
  const [results, setResults] = useState<CertEligibilityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/user/company-profile");
      const data = await res.json();
      if (!data.success || !data.data) {
        setError("기업 프로필을 먼저 등록해주세요. 마이페이지 > 기업정보에서 등록할 수 있습니다.");
        return;
      }
      setProfile(data.data);
      const diagnosticResults = runCertificationCheck(data.data);
      setResults(diagnosticResults);
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-gray-500">기업 프로필을 분석하고 있습니다...</p>
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

  const eligible = results.filter(r => r.eligible);
  const avgScore = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">인증 적격성 진단</h1>
        <p className="text-gray-500 mt-1">
          기업 프로필 기반으로 주요 인증의 취득 가능성을 자동 진단합니다.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-teal-50 rounded-xl p-4 text-center">
          <p className="text-xs text-teal-600 font-medium">진단 인증 수</p>
          <p className="text-2xl font-bold text-teal-800 mt-1">{results.length}개</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-xs text-green-600 font-medium">적격 판정</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{eligible.length}개</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-xs text-blue-600 font-medium">평균 적합도</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{avgScore}점</p>
        </div>
      </div>

      {/* 기업명 표시 */}
      {profile && (
        <div className="mb-4 px-4 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
          분석 대상: <span className="font-medium text-gray-900">{(profile as any).companyName || "미입력"}</span>
          {(profile as any).bizType && <span className="ml-2">({(profile as any).bizType})</span>}
        </div>
      )}

      {/* 결과 리스트 */}
      <div className="space-y-4">
        {results.map((result) => (
          <CertCard key={result.certType} result={result} />
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-xl text-xs text-gray-500">
        * 본 진단은 기업 프로필 데이터 기반의 참고용 결과입니다. 실제 인증 심사 기준과 차이가 있을 수 있으며, 정확한 요건은 각 인증기관에 확인하시기 바랍니다.
      </div>
    </div>
  );
}

function CertCard({ result }: { result: CertEligibilityResult }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = result.score >= 70
    ? "border-green-200 bg-green-50"
    : result.score >= 40
      ? "border-yellow-200 bg-yellow-50"
      : "border-red-200 bg-red-50";

  const badgeColor = result.eligible
    ? "bg-green-100 text-green-700"
    : "bg-red-100 text-red-700";

  return (
    <div className={`border rounded-xl overflow-hidden ${result.score >= 70 ? 'border-green-200' : result.score >= 40 ? 'border-yellow-200' : 'border-red-200'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 flex-shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke={result.score >= 70 ? '#22c55e' : result.score >= 40 ? '#eab308' : '#ef4444'}
                strokeWidth="3"
                strokeDasharray={`${result.score * 0.974} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {result.score}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{result.certName}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>
              {result.eligible ? '적격' : '부적격'}
            </span>
          </div>
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            {/* 충족 항목 */}
            <div>
              <p className="text-xs font-medium text-green-700 mb-2">충족 항목</p>
              {result.met.length > 0 ? (
                <ul className="space-y-1">
                  {result.met.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-green-800">
                      <svg className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {/* 미충족 항목 */}
            <div>
              <p className="text-xs font-medium text-red-700 mb-2">미충족 항목</p>
              {result.unmet.length > 0 ? (
                <ul className="space-y-1">
                  {result.unmet.map((item, i) => (
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
          <div className={`mt-3 p-3 rounded-lg text-sm ${statusColor}`}>
            {result.recommendation}
          </div>
        </div>
      )}
    </div>
  );
}
