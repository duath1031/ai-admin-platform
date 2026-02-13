"use client";

import { useState } from "react";
import { usePaywall } from "@/lib/billing/usePaywall";
import PaywallModal from "@/components/billing/PaywallModal";

interface Party {
  name: string;
  role: string;
}

interface KeyTerm {
  term: string;
  description: string;
  risk: "safe" | "caution" | "danger";
}

interface Risk {
  category: string;
  description: string;
  severity: "high" | "medium" | "low";
  clause: string;
  recommendation: string;
}

interface AnalysisResult {
  success: boolean;
  contractType: string;
  parties: Party[];
  summary: string;
  keyTerms: KeyTerm[];
  risks: Risk[];
  missingClauses: string[];
  overallScore: number;
  overallAssessment: string;
  recommendations: string[];
}

const CONTRACT_TYPES = [
  { value: "", label: "자동 감지" },
  { value: "용역계약", label: "용역계약" },
  { value: "공사계약", label: "공사계약" },
  { value: "매매계약", label: "매매계약" },
  { value: "임대차계약", label: "임대차계약" },
  { value: "근로계약", label: "근로계약" },
  { value: "위임계약", label: "위임계약" },
  { value: "기타", label: "기타" },
];

function getScoreColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#3b82f6";
  if (score >= 50) return "#eab308";
  if (score >= 30) return "#f97316";
  return "#ef4444";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "매우 양호";
  if (score >= 70) return "양호";
  if (score >= 50) return "주의 필요";
  if (score >= 30) return "위험";
  return "매우 위험";
}

function getScoreGradient(score: number): string {
  if (score >= 90) return "from-green-50 to-emerald-50 border-green-200";
  if (score >= 70) return "from-blue-50 to-indigo-50 border-blue-200";
  if (score >= 50) return "from-yellow-50 to-amber-50 border-yellow-200";
  if (score >= 30) return "from-orange-50 to-red-50 border-orange-200";
  return "from-red-50 to-rose-50 border-red-200";
}

function getRiskBadge(risk: "safe" | "caution" | "danger") {
  switch (risk) {
    case "safe":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          안전
        </span>
      );
    case "caution":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          주의
        </span>
      );
    case "danger":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          위험
        </span>
      );
    default:
      return null;
  }
}

function getSeverityIcon(severity: "high" | "medium" | "low") {
  switch (severity) {
    case "high":
      return (
        <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" />
          </svg>
        </div>
      );
    case "medium":
      return (
        <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495z" />
          </svg>
        </div>
      );
    case "low":
      return (
        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}

export default function ContractAnalysisPage() {
  const [contractType, setContractType] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const { paywallProps, checkAndConsume } = usePaywall();

  const handleAnalysis = async () => {
    setError("");
    setResult(null);

    if (content.trim().length < 100) {
      setError("계약서 내용이 너무 짧습니다. 최소 100자 이상 입력해주세요.");
      return;
    }

    const ok = await checkAndConsume("contract_analysis");
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/contract-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, contractType: contractType || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "분석 중 오류가 발생했습니다.");
        return;
      }

      setResult(data as AnalysisResult);
    } catch (err) {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = result ? getScoreColor(result.overallScore) : "#3b82f6";
  const scoreLabel = result ? getScoreLabel(result.overallScore) : "";
  const scoreGradient = result ? getScoreGradient(result.overallScore) : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">계약서 AI 분석</h1>
            <p className="text-gray-500 mt-1">AI가 계약서의 위험 요소를 자동으로 분석합니다</p>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="mb-4">
            <label htmlFor="contractType" className="block text-sm font-medium text-gray-700 mb-2">
              계약 유형
            </label>
            <select
              id="contractType"
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors"
            >
              {CONTRACT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="contractContent" className="block text-sm font-medium text-gray-700 mb-2">
              계약서 내용
            </label>
            <textarea
              id="contractContent"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder="계약서 전문을 여기에 붙여넣으세요. (최소 100자 이상)"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors resize-y"
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-sm ${content.trim().length < 100 ? "text-gray-400" : "text-green-600"}`}>
                {content.trim().length.toLocaleString()}자 입력됨
                {content.trim().length < 100 && ` (최소 100자 필요)`}
              </span>
              <span className="text-sm text-purple-600 font-medium">
                4,000 토큰 차감
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleAnalysis}
            disabled={loading || content.trim().length < 100}
            className="w-full py-3.5 px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-purple-200 disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                AI가 계약서를 분석하고 있습니다...
              </span>
            ) : (
              "분석 시작"
            )}
          </button>
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            {/* Score Card */}
            <div className={`bg-gradient-to-br ${scoreGradient} rounded-2xl border p-6`}>
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <svg className="w-24 h-24" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke={scoreColor}
                      strokeWidth="8"
                      strokeDasharray={`${result.overallScore * 2.83} 283`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                    <text x="50" y="55" textAnchor="middle" className="text-2xl font-bold" fill={scoreColor}>
                      {result.overallScore}
                    </text>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">종합 점수</h2>
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: scoreColor }}
                    >
                      {scoreLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      {result.contractType}
                    </span>
                    {result.parties.length > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                        {result.parties.map((p) => `${p.name}(${p.role})`).join(", ")}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{result.summary}</p>
                </div>
              </div>
              {result.overallAssessment && result.overallAssessment !== result.summary && (
                <div className="mt-4 pt-4 border-t border-gray-200/50">
                  <p className="text-gray-700 text-sm leading-relaxed">{result.overallAssessment}</p>
                </div>
              )}
            </div>

            {/* Key Terms Card */}
            {result.keyTerms.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  핵심 조항 분석
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-1/4">조항</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">내용</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-20">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.keyTerms.map((term, idx) => (
                        <tr key={idx} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{term.term}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{term.description}</td>
                          <td className="py-3 px-4 text-center">{getRiskBadge(term.risk)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Risks Card */}
            {result.risks.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  위험 요소
                  <span className="text-sm font-normal text-gray-500">({result.risks.length}건)</span>
                </h3>
                <div className="space-y-4">
                  {result.risks.map((risk, idx) => (
                    <div key={idx} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(risk.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{risk.category}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              risk.severity === "high" ? "bg-red-100 text-red-700" :
                              risk.severity === "medium" ? "bg-yellow-100 text-yellow-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>
                              {risk.severity === "high" ? "높음" : risk.severity === "medium" ? "보통" : "낮음"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{risk.description}</p>
                          {risk.clause && (
                            <div className="bg-gray-50 rounded-lg p-3 mb-2">
                              <p className="text-xs text-gray-500 mb-1">관련 조항</p>
                              <p className="text-sm text-gray-700 italic">&ldquo;{risk.clause}&rdquo;</p>
                            </div>
                          )}
                          {risk.recommendation && (
                            <p className="text-sm text-green-700 flex items-start gap-1">
                              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {risk.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Clauses Card */}
            {result.missingClauses.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
                  </svg>
                  누락 조항
                  <span className="text-sm font-normal text-gray-500">({result.missingClauses.length}건)</span>
                </h3>
                <ul className="space-y-2">
                  {result.missingClauses.map((clause, idx) => (
                    <li key={idx} className="flex items-center gap-3 py-2">
                      <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                      </svg>
                      <span className="text-sm text-gray-700">{clause}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations Card */}
            {result.recommendations.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                  개선 권고
                </h3>
                <ol className="space-y-3">
                  {result.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-gray-700 leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Expert CTA Card */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white">
              <h3 className="text-lg font-bold mb-2">계약서 검토는 전문가와 함께</h3>
              <p className="text-purple-100 text-sm mb-5">
                AI 분석 결과를 바탕으로 전문 행정사의 정밀 검토를 받아보세요.
              </p>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-purple-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-sm">행정사합동사무소 정의</p>
                    <p className="text-purple-200 text-xs">염현수 대표 행정사</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-purple-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  <a href="tel:070-8657-1888" className="text-sm hover:underline">070-8657-1888</a>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-purple-200 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                  </svg>
                  <a href="https://pf.kakao.com/_jWfwb" target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                    카카오 상담: pf.kakao.com/_jWfwb
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-purple-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  <a href="https://jungeui.com/%EB%AC%B8%EC%9D%98%ED%95%98%EA%B8%B0" target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                    온라인 의뢰: jungeui.com/문의하기
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Paywall Modal */}
      <PaywallModal {...paywallProps} />
    </div>
  );
}
