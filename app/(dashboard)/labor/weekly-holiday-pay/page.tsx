"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui";

interface WeeklyHolidayPayResult {
  eligible: boolean;
  reason: string;
  hourlyWage: number;
  weeklyWorkHours: number;
  contractDaysPerWeek: number;
  actualDaysWorked: number;
  weeklyHolidayHours: number;
  weeklyHolidayPay: number;
  monthlyHolidayPay: number;
  weeklyBasePay: number;
  weeklyTotalPay: number;
  monthlyBasePay: number;
  monthlyTotalPay: number;
  effectiveHourlyWage: number;
  formula: string[];
  monthlySalaryNote?: string;
}

export default function WeeklyHolidayPayPage() {
  const [hourlyWage, setHourlyWage] = useState<number | "">("");
  const [weeklyWorkHours, setWeeklyWorkHours] = useState<number>(40);
  const [contractDaysPerWeek, setContractDaysPerWeek] = useState<number>(5);
  const [actualDaysWorked, setActualDaysWorked] = useState<number | "">("");
  const [isMonthlySalary, setIsMonthlySalary] = useState(false);

  const [result, setResult] = useState<WeeklyHolidayPayResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hourlyWage || hourlyWage <= 0) {
      setError("시급을 입력해주세요.");
      return;
    }
    if (weeklyWorkHours <= 0) {
      setError("주소정근로시간을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/labor/weekly-holiday-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hourlyWage: Number(hourlyWage),
          weeklyWorkHours,
          contractDaysPerWeek,
          actualDaysWorked: actualDaysWorked === "" ? contractDaysPerWeek : Number(actualDaysWorked),
          isMonthlySalary,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `API 요청 실패 (${res.status})`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString() + "원";

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">주휴수당 계산기</h1>
        <p className="text-gray-500 mt-1">
          근로기준법 제55조에 따른 주휴수당을 계산합니다
        </p>
      </div>

      {/* 입력 폼 */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleCalculate} className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">근로 조건 입력</h3>

            <div className="grid md:grid-cols-2 gap-4">
              {/* 시급 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  시급 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={hourlyWage}
                    onChange={(e) => setHourlyWage(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="예: 9,860"
                    min={0}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
                </div>
              </div>

              {/* 주소정근로시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  주소정근로시간 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={weeklyWorkHours}
                    onChange={(e) => setWeeklyWorkHours(Number(e.target.value))}
                    min={1}
                    max={52}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">시간</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">일반적으로 주 40시간 (주 5일 x 8시간)</p>
              </div>

              {/* 주계약근무일수 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  주계약근무일수
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={contractDaysPerWeek}
                    onChange={(e) => setContractDaysPerWeek(Number(e.target.value))}
                    min={1}
                    max={7}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">일</span>
                </div>
              </div>

              {/* 실제근무일수 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  실제근무일수
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={actualDaysWorked}
                    onChange={(e) => setActualDaysWorked(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={`미입력 시 ${contractDaysPerWeek}일`}
                    min={0}
                    max={7}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">일</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">해당 주에 실제 출근한 일수 (결근 반영)</p>
              </div>
            </div>

            {/* 월급제 여부 */}
            <label className="flex items-center gap-3 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={isMonthlySalary}
                onChange={(e) => setIsMonthlySalary(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">월급제 근로자</span>
                <p className="text-xs text-gray-400 mt-0.5">월급에 주휴수당이 이미 포함되어 있는지 확인합니다</p>
              </div>
            </label>

            {/* 에러 */}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            {/* 계산 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  계산 중...
                </span>
              ) : (
                "주휴수당 계산하기"
              )}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* 결과 */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* 자격 여부 배지 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-800">주휴수당 자격 판정</h3>
                <span
                  className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold ${
                    result.eligible
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {result.eligible ? "자격있음" : "자격없음"}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">{result.reason}</p>
            </CardContent>
          </Card>

          {/* 자격이 있을 때 요약 카드 */}
          {result.eligible && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="주휴시간"
                value={`${result.weeklyHolidayHours}시간`}
                color="indigo"
              />
              <SummaryCard
                label="주휴수당"
                value={fmt(result.weeklyHolidayPay)}
                color="blue"
              />
              <SummaryCard
                label="월환산 주휴수당"
                value={fmt(result.monthlyHolidayPay)}
                color="emerald"
              />
              <SummaryCard
                label="실질시급"
                value={fmt(result.effectiveHourlyWage)}
                color="purple"
              />
            </div>
          )}

          {/* 월급제 안내 */}
          {result.monthlySalaryNote && (
            <Card>
              <CardContent className="p-4 bg-blue-50 border border-blue-200">
                <div className="flex gap-2">
                  <span className="text-blue-500 text-lg flex-shrink-0">&#9432;</span>
                  <p className="text-sm text-blue-700">{result.monthlySalaryNote}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 비교 테이블 */}
          {result.eligible && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">급여 비교표</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-3 px-4 text-left font-medium text-gray-500">구분</th>
                        <th className="py-3 px-4 text-right font-medium text-gray-500">기본급</th>
                        <th className="py-3 px-4 text-right font-medium text-gray-500">기본급 + 주휴수당</th>
                        <th className="py-3 px-4 text-right font-medium text-gray-500">차액</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-700">주급</td>
                        <td className="py-3 px-4 text-right text-gray-600">{fmt(result.weeklyBasePay)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-indigo-600">{fmt(result.weeklyTotalPay)}</td>
                        <td className="py-3 px-4 text-right text-green-600">+{fmt(result.weeklyHolidayPay)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-700">월급</td>
                        <td className="py-3 px-4 text-right text-gray-600">{fmt(result.monthlyBasePay)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-indigo-600">{fmt(result.monthlyTotalPay)}</td>
                        <td className="py-3 px-4 text-right text-green-600">+{fmt(result.monthlyHolidayPay)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 계산 과정 */}
          {result.formula && result.formula.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">계산 과정</h3>
                <ol className="space-y-2">
                  {result.formula.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-gray-700 pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 면책조항 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-500">
          본 계산 결과는 참고용이며, 실제 급여 산정과 다를 수 있습니다.
          정확한 안내는 관할 고용노동부 또는 전문 노무사/행정사에게 상담하세요.
          근로기준법 제55조, 근로기준법 시행령 제30조 기준.
        </p>
      </div>
    </div>
  );
}

/* -- 요약 카드 컴포넌트 -- */
function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "indigo" | "blue" | "emerald" | "purple";
}) {
  const colorMap = {
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
  };

  const labelColorMap = {
    indigo: "text-indigo-500",
    blue: "text-blue-500",
    emerald: "text-emerald-500",
    purple: "text-purple-500",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className={`text-xs font-medium ${labelColorMap[color]} mb-1`}>{label}</p>
      <p className="text-lg font-bold break-all">{value}</p>
    </div>
  );
}
