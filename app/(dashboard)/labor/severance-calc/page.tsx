"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";

// ─── Types ───

interface SeveranceResult {
  eligible: boolean;
  reason?: string;
  totalDays: number;
  years: number;
  months: number;
  days: number;
  recentThreeMonthPay: number;
  recentThreeMonthDays: number;
  dailyAverageWage: number;
  dailyMinWage: number;
  severancePay: number;
  retirementIncomeTax: number;
  localRetirementTax: number;
  netSeverancePay: number;
  formula: string[];
}

// ─── Helpers ───

function formatKRW(n: number): string {
  return n.toLocaleString("ko-KR");
}

function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// ─── Main Page ───

export default function SeveranceCalcPage() {
  // Form state
  const [hireDate, setHireDate] = useState("");
  const [resignDate, setResignDate] = useState(todayStr());
  const [monthlySalary, setMonthlySalary] = useState("");
  const [recentThreeMonthPay, setRecentThreeMonthPay] = useState("");
  const [annualBonus, setAnnualBonus] = useState("");
  const [annualAllowance, setAnnualAllowance] = useState("");

  // Result state
  const [result, setResult] = useState<SeveranceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setResult(null);

    // Validation
    if (!hireDate) {
      setError("입사일을 입력해주세요.");
      setIsLoading(false);
      return;
    }
    if (!resignDate) {
      setError("퇴직일을 입력해주세요.");
      setIsLoading(false);
      return;
    }
    if (!monthlySalary || Number(monthlySalary) <= 0) {
      setError("월 기본급을 입력해주세요.");
      setIsLoading(false);
      return;
    }
    if (new Date(hireDate) >= new Date(resignDate)) {
      setError("퇴직일은 입사일 이후여야 합니다.");
      setIsLoading(false);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        hireDate,
        resignDate,
        monthlySalary: Number(monthlySalary),
      };
      if (recentThreeMonthPay) body.recentThreeMonthPay = Number(recentThreeMonthPay);
      if (annualBonus) body.annualBonus = Number(annualBonus);
      if (annualAllowance) body.annualAllowance = Number(annualAllowance);

      const res = await fetch("/api/labor/severance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setHireDate("");
    setResignDate(todayStr());
    setMonthlySalary("");
    setRecentThreeMonthPay("");
    setAnnualBonus("");
    setAnnualAllowance("");
    setResult(null);
    setError("");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          퇴직금 계산기
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-500">
          근로기준법 제34조에 따른 퇴직금을 계산합니다
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>근무 정보 입력</CardTitle>
          <CardDescription>
            퇴직금 산정에 필요한 정보를 입력해주세요. 최근 3개월 총급여를 입력하지 않으면 월 기본급 x 3으로 계산합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="hireDate" className="block text-sm font-medium text-gray-700 mb-1">
                  입사일 <span className="text-red-500">*</span>
                </label>
                <input
                  id="hireDate"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label htmlFor="resignDate" className="block text-sm font-medium text-gray-700 mb-1">
                  퇴직일 <span className="text-red-500">*</span>
                </label>
                <input
                  id="resignDate"
                  type="date"
                  value={resignDate}
                  onChange={(e) => setResignDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  required
                />
              </div>
            </div>

            {/* Salary Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="monthlySalary" className="block text-sm font-medium text-gray-700 mb-1">
                  월 기본급 (원) <span className="text-red-500">*</span>
                </label>
                <input
                  id="monthlySalary"
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="3,000,000"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  required
                />
                {monthlySalary && Number(monthlySalary) > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatKRW(Number(monthlySalary))}원
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="recentThreeMonthPay" className="block text-sm font-medium text-gray-700 mb-1">
                  최근 3개월 총급여 (원)
                  <span className="text-gray-400 text-xs ml-1">선택</span>
                </label>
                <input
                  id="recentThreeMonthPay"
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="미입력시 기본급 x 3"
                  value={recentThreeMonthPay}
                  onChange={(e) => setRecentThreeMonthPay(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
                {recentThreeMonthPay && Number(recentThreeMonthPay) > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatKRW(Number(recentThreeMonthPay))}원
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="annualBonus" className="block text-sm font-medium text-gray-700 mb-1">
                  연간 상여금 (원)
                  <span className="text-gray-400 text-xs ml-1">선택</span>
                </label>
                <input
                  id="annualBonus"
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="0"
                  value={annualBonus}
                  onChange={(e) => setAnnualBonus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
                {annualBonus && Number(annualBonus) > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatKRW(Number(annualBonus))}원
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="annualAllowance" className="block text-sm font-medium text-gray-700 mb-1">
                  연간 기타수당 (원)
                  <span className="text-gray-400 text-xs ml-1">선택</span>
                </label>
                <input
                  id="annualAllowance"
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="0"
                  value={annualAllowance}
                  onChange={(e) => setAnnualAllowance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
                {annualAllowance && Number(annualAllowance) > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatKRW(Number(annualAllowance))}원
                  </p>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    계산 중...
                  </span>
                ) : (
                  "퇴직금 계산하기"
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm sm:text-base"
              >
                초기화
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Eligibility Check */}
          {!result.eligible ? (
            <Card variant="bordered">
              <CardContent className="py-8">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100">
                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">퇴직금 수급 대상이 아닙니다</h3>
                  {result.reason && (
                    <p className="text-sm text-gray-600 max-w-md mx-auto">{result.reason}</p>
                  )}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg max-w-md mx-auto">
                    <p className="text-xs text-gray-500">
                      근로기준법 제34조에 따라 계속근로기간이 1년 이상이고, 4주간을 평균하여 1주간의 소정근로시간이 15시간 이상인 근로자에게 퇴직금이 지급됩니다.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Severance Pay Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>퇴직금 산정 결과</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Big Number - Net Severance */}
                  <div className="text-center py-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <p className="text-sm text-gray-500 mb-1">실수령 퇴직금</p>
                    <p className="text-3xl sm:text-4xl font-bold text-blue-700">
                      {formatKRW(result.netSeverancePay)}
                      <span className="text-lg sm:text-xl font-medium ml-1">원</span>
                    </p>
                  </div>

                  {/* Key Figures Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500 mb-1">재직기간</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {result.years > 0 && `${result.years}년 `}
                        {result.months > 0 && `${result.months}개월 `}
                        {result.days > 0 && `${result.days}일`}
                      </p>
                      <p className="text-xs text-gray-400">총 {formatKRW(result.totalDays)}일</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500 mb-1">1일 평균임금</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatKRW(result.dailyAverageWage)}원
                      </p>
                      {result.dailyMinWage > 0 && (
                        <p className="text-xs text-gray-400">
                          최저 {formatKRW(result.dailyMinWage)}원
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500 mb-1">퇴직금 총액</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatKRW(result.severancePay)}원
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500 mb-1">최근 3개월 급여</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatKRW(result.recentThreeMonthPay)}원
                      </p>
                      <p className="text-xs text-gray-400">
                        {result.recentThreeMonthDays}일 기준
                      </p>
                    </div>
                  </div>

                  {/* Tax & Net Breakdown */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-gray-100">
                          <td className="px-4 py-3 text-gray-600 bg-gray-50 font-medium w-1/2">퇴직금 총액</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {formatKRW(result.severancePay)}원
                          </td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="px-4 py-3 text-gray-600 bg-gray-50 font-medium">
                            (-) 퇴직소득세
                          </td>
                          <td className="px-4 py-3 text-right text-red-600">
                            -{formatKRW(result.retirementIncomeTax)}원
                          </td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="px-4 py-3 text-gray-600 bg-gray-50 font-medium">
                            (-) 지방소득세
                          </td>
                          <td className="px-4 py-3 text-right text-red-600">
                            -{formatKRW(result.localRetirementTax)}원
                          </td>
                        </tr>
                        <tr className="bg-blue-50">
                          <td className="px-4 py-3 text-blue-800 font-bold">실수령 퇴직금</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700 text-base">
                            {formatKRW(result.netSeverancePay)}원
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Formula / Calculation Steps */}
              {result.formula && result.formula.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>산정 근거 (계산 과정)</CardTitle>
                    <CardDescription>
                      근로기준법 제34조 및 퇴직급여보장법에 따른 산정 과정입니다
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3">
                      {result.formula.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Legal Notice */}
      <Card variant="bordered">
        <CardContent className="py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">유의사항</h4>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>본 계산기는 참고용이며, 실제 퇴직금은 근로계약 내용 및 회사 규정에 따라 달라질 수 있습니다.</li>
              <li>퇴직소득세는 간이세액표 기준이며, 실제 세액과 차이가 있을 수 있습니다.</li>
              <li>1일 평균임금이 통상임금보다 낮은 경우, 통상임금이 적용됩니다 (근로기준법 제2조).</li>
              <li>정확한 퇴직금 산정은 행정사, 노무사, 변호사 또는 관할 노동청에 문의하시기 바랍니다.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
