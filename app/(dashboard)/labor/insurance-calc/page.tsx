"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
} from "@/components/ui";
import ClientSelector from "@/components/common/ClientSelector";

// ─── Types ───

interface InsuranceDeduction {
  label: string;
  employeeAmount: number;
  employerAmount: number;
  rate?: string;
}

interface InsuranceCalcResult {
  monthlySalary: number;
  nonTaxableAmount: number;
  taxableAmount: number;
  nationalPension: InsuranceDeduction;
  healthInsurance: InsuranceDeduction;
  longTermCare: InsuranceDeduction;
  employmentInsurance: InsuranceDeduction;
  industrialAccident: InsuranceDeduction;
  incomeTax: InsuranceDeduction;
  localIncomeTax: InsuranceDeduction;
  totalEmployeeDeduction: number;
  totalEmployerBurden: number;
  netPay: number;
  totalLaborCost: number;
  deductionsList: InsuranceDeduction[];
}

interface IndustryRate {
  code: string;
  name: string;
  rate: number;
}

interface CompanySize {
  code: string;
  label: string;
  extraRate: string;
}

// ─── Helper ───

function fmt(n: number): string {
  return n.toLocaleString();
}

// ─── Summary Card ───

function SummaryCard({
  title,
  value,
  color,
  sub,
}: {
  title: string;
  value: number;
  color: string;
  sub?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    red: "bg-red-50 border-red-200 text-red-700",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-xl border-2 p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-2xl font-bold mt-1">{fmt(value)}원</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

// ─── Simple Bar Chart ───

function DeductionBarChart({ deductions }: { deductions: InsuranceDeduction[] }) {
  const maxVal = Math.max(
    ...deductions.map((d) => Math.max(d.employeeAmount, d.employerAmount)),
    1
  );

  return (
    <div className="space-y-3">
      {deductions.map((d) => {
        const empPct = (d.employeeAmount / maxVal) * 100;
        const erPct = (d.employerAmount / maxVal) * 100;
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">{d.label}</span>
              <span className="text-xs text-gray-500">
                근로자 {fmt(d.employeeAmount)} / 사업주 {fmt(d.employerAmount)}
              </span>
            </div>
            <div className="flex gap-1 h-5">
              {d.employeeAmount > 0 && (
                <div
                  className="bg-blue-500 rounded-sm transition-all duration-500"
                  style={{ width: `${empPct}%`, minWidth: empPct > 0 ? "4px" : "0" }}
                  title={`근로자: ${fmt(d.employeeAmount)}원`}
                />
              )}
              {d.employerAmount > 0 && (
                <div
                  className="bg-amber-500 rounded-sm transition-all duration-500"
                  style={{ width: `${erPct}%`, minWidth: erPct > 0 ? "4px" : "0" }}
                  title={`사업주: ${fmt(d.employerAmount)}원`}
                />
              )}
              {d.employeeAmount === 0 && d.employerAmount === 0 && (
                <div className="bg-gray-200 rounded-sm h-full w-1" />
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
          근로자 부담
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
          사업주 부담
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function InsuranceCalcPage() {
  // Reference data from GET API
  const [industryRates, setIndustryRates] = useState<IndustryRate[]>([]);
  const [companySizes, setCompanySizes] = useState<CompanySize[]>([]);

  // Form state
  const [monthlySalary, setMonthlySalary] = useState<string>("");
  const [nonTaxableAmount, setNonTaxableAmount] = useState<string>("200000");
  const [dependents, setDependents] = useState<string>("1");
  const [childrenUnder20, setChildrenUnder20] = useState<string>("0");
  const [companySize, setCompanySize] = useState<string>("under150");
  const [industryCode, setIndustryCode] = useState<string>("80");

  // Exemption checkboxes
  const [npExempt, setNpExempt] = useState(false);
  const [hiExempt, setHiExempt] = useState(false);
  const [eiExempt, setEiExempt] = useState(false);

  // Company profile for print
  const [companyName, setCompanyName] = useState<string>("");

  // Result state
  const [result, setResult] = useState<InsuranceCalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [initLoading, setInitLoading] = useState(true);

  // ── Fetch reference data + company profile on mount ──
  useEffect(() => {
    async function fetchReferenceData() {
      try {
        const res = await fetch("/api/labor/insurance-calc");
        const data = await res.json();
        if (data.success) {
          setIndustryRates(data.industryRates || []);
          setCompanySizes(data.companySizes || []);
        }
      } catch {
        console.error("기준 데이터 로드 실패");
      } finally {
        setInitLoading(false);
      }
    }
    async function fetchCompanyProfile() {
      try {
        const res = await fetch("/api/user/company-profile");
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.data?.companyName) {
          setCompanyName(data.data.companyName);
        }
      } catch { /* silent */ }
    }
    fetchReferenceData();
    fetchCompanyProfile();
  }, []);

  // ── Calculate ──
  const handleCalculate = useCallback(async () => {
    setError("");
    setResult(null);

    const salary = Number(monthlySalary.replace(/,/g, ""));
    if (!salary || salary <= 0) {
      setError("월 급여를 올바르게 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/labor/insurance-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlySalary: salary,
          nonTaxableAmount: Number(nonTaxableAmount.replace(/,/g, "")) || 0,
          dependents: Number(dependents) || 1,
          childrenUnder20: Number(childrenUnder20) || 0,
          companySize,
          industryCode,
          nationalPensionExempt: npExempt,
          healthInsuranceExempt: hiExempt,
          employmentInsuranceExempt: eiExempt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "계산 중 오류가 발생했습니다.");
      }
      if (!data.success) {
        throw new Error(data.error || "API 오류");
      }
      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "계산 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    monthlySalary,
    nonTaxableAmount,
    dependents,
    childrenUnder20,
    companySize,
    industryCode,
    npExempt,
    hiExempt,
    eiExempt,
  ]);

  // ── Print ──
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ── Salary input formatting ──
  const handleSalaryChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, "");
    setMonthlySalary(numeric);
  };

  const handleNonTaxChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, "");
    setNonTaxableAmount(numeric);
  };

  const displaySalary = monthlySalary
    ? Number(monthlySalary).toLocaleString()
    : "";
  const displayNonTax = nonTaxableAmount
    ? Number(nonTaxableAmount).toLocaleString()
    : "";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6 print:p-0">
      {/* Print-only company header */}
      {companyName && (
        <div className="hidden print:block text-center mb-2">
          <p className="text-lg font-bold text-gray-900">{companyName}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between print:text-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            4대보험 계산기
          </h1>
          <p className="text-gray-500 mt-1">
            2026년 기준 4대보험료 및 소득세를 계산합니다
          </p>
        </div>
        <div className="print:hidden">
          <ClientSelector />
        </div>
      </div>

      {/* Input Form */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>급여 정보 입력</CardTitle>
          <CardDescription>
            세전 월급여와 부양가족 정보를 입력하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg
                className="animate-spin h-6 w-6 text-primary-600"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="ml-2 text-gray-500">기준 데이터 로딩 중...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Row 1: Salary + NonTaxable */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="월 급여 (세전) *"
                    placeholder="예: 3,000,000"
                    value={displaySalary}
                    onChange={(e) => handleSalaryChange(e.target.value)}
                    type="text"
                    inputMode="numeric"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    비과세 포함 총 지급액
                  </p>
                </div>
                <div>
                  <Input
                    label="비과세액 (식대 등)"
                    placeholder="예: 200,000"
                    value={displayNonTax}
                    onChange={(e) => handleNonTaxChange(e.target.value)}
                    type="text"
                    inputMode="numeric"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    식대, 차량유지비 등 (기본 20만원)
                  </p>
                </div>
              </div>

              {/* Row 2: Dependents + Children */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="부양가족 수 (본인 포함)"
                  type="number"
                  min="1"
                  max="20"
                  value={dependents}
                  onChange={(e) => setDependents(e.target.value)}
                  helperText="본인 포함 인적공제 대상자 수"
                />
                <Input
                  label="20세 이하 자녀 수"
                  type="number"
                  min="0"
                  max="20"
                  value={childrenUnder20}
                  onChange={(e) => setChildrenUnder20(e.target.value)}
                  helperText="자녀세액공제 대상"
                />
              </div>

              {/* Row 3: Company Size + Industry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="block mb-2">사업장 규모</Label>
                  <Select value={companySize} onValueChange={setCompanySize}>
                    <SelectTrigger>
                      <SelectValue placeholder="사업장 규모 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {companySizes.map((cs) => (
                        <SelectItem key={cs.code} value={cs.code}>
                          {cs.label} (추가 {cs.extraRate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-gray-400">
                    고용보험 사업주 추가요율에 영향
                  </p>
                </div>
                <div>
                  <Label className="block mb-2">산재보험 업종</Label>
                  <Select value={industryCode} onValueChange={setIndustryCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="업종 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {industryRates.map((ir) => (
                        <SelectItem key={ir.code} value={ir.code}>
                          {ir.name} ({ir.rate}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-gray-400">
                    산재보험료율은 업종별로 상이
                  </p>
                </div>
              </div>

              {/* Exemptions */}
              <div>
                <Label className="block mb-3">면제 항목</Label>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={npExempt}
                      onCheckedChange={(v) => setNpExempt(v === true)}
                    />
                    <span className="text-sm text-gray-700">국민연금 면제</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={hiExempt}
                      onCheckedChange={(v) => setHiExempt(v === true)}
                    />
                    <span className="text-sm text-gray-700">건강보험 면제</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={eiExempt}
                      onCheckedChange={(v) => setEiExempt(v === true)}
                    />
                    <span className="text-sm text-gray-700">고용보험 면제</span>
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  60세 이상(국민연금), 의료급여 수급자(건강보험), 65세 이상 등
                </p>
              </div>

              {/* Error */}
              {error && (
                <Alert>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCalculate}
                  isLoading={loading}
                  disabled={loading}
                  size="lg"
                >
                  계산하기
                </Button>
                {result && (
                  <Button variant="outline" size="lg" onClick={handlePrint}>
                    인쇄
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Results ─── */}
      {result && (
        <div className="space-y-6" id="calc-result">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <SummaryCard
              title="총 급여"
              value={result.monthlySalary}
              color="blue"
              sub={`과세 대상: ${fmt(result.taxableAmount)}원`}
            />
            <SummaryCard
              title="공제 합계"
              value={result.totalEmployeeDeduction}
              color="red"
              sub="근로자 부담분"
            />
            <SummaryCard
              title="실수령액"
              value={result.netPay}
              color="green"
              sub={`급여 대비 ${((result.netPay / result.monthlySalary) * 100).toFixed(1)}%`}
            />
            <SummaryCard
              title="사업주 부담"
              value={result.totalEmployerBurden}
              color="amber"
              sub={`총 인건비: ${fmt(result.totalLaborCost)}원`}
            />
          </div>

          {/* Detail Table */}
          <Card>
            <CardHeader>
              <CardTitle>공제 항목별 상세</CardTitle>
              <CardDescription>
                근로자 부담분과 사업주 부담분을 항목별로 확인합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">
                      항목
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">
                      요율
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-blue-600">
                      근로자 부담
                    </th>
                    <th className="text-right py-3 px-2 font-semibold text-amber-600">
                      사업주 부담
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.deductionsList.map((d, i) => {
                    const isLast = i === result.deductionsList.length - 1;
                    const isTax = d.label === "소득세" || d.label === "지방소득세";
                    return (
                      <tr
                        key={d.label}
                        className={`border-b border-gray-100 ${
                          i === 4 ? "border-b-2 border-gray-300" : ""
                        } ${isLast ? "border-b-0" : ""}`}
                      >
                        <td className="py-2.5 px-2">
                          <span className="font-medium text-gray-800">
                            {d.label}
                          </span>
                          {isTax && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                              세금
                            </span>
                          )}
                          {!isTax && i < 5 && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded">
                              보험
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right text-gray-500 text-xs whitespace-nowrap">
                          {d.rate || "-"}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-blue-700 tabular-nums">
                          {d.employeeAmount > 0
                            ? `${fmt(d.employeeAmount)}원`
                            : "-"}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-amber-700 tabular-nums">
                          {d.employerAmount > 0
                            ? `${fmt(d.employerAmount)}원`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50">
                    <td className="py-3 px-2 font-bold text-gray-900" colSpan={2}>
                      합계
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-blue-800 tabular-nums">
                      {fmt(result.totalEmployeeDeduction)}원
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-amber-800 tabular-nums">
                      {fmt(result.totalEmployerBurden)}원
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>항목별 부담 비교</CardTitle>
              <CardDescription>
                근로자와 사업주의 항목별 부담액을 시각적으로 비교합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeductionBarChart deductions={result.deductionsList} />
            </CardContent>
          </Card>

          {/* Net Pay Breakdown Bar */}
          <Card>
            <CardHeader>
              <CardTitle>실수령액 비율</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Stacked bar */}
                <div className="w-full h-10 flex rounded-lg overflow-hidden">
                  <div
                    className="bg-green-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
                    style={{
                      width: `${(result.netPay / result.monthlySalary) * 100}%`,
                    }}
                  >
                    {((result.netPay / result.monthlySalary) * 100).toFixed(1)}%
                  </div>
                  <div
                    className="bg-red-400 flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
                    style={{
                      width: `${(result.totalEmployeeDeduction / result.monthlySalary) * 100}%`,
                    }}
                  >
                    {(
                      (result.totalEmployeeDeduction / result.monthlySalary) *
                      100
                    ).toFixed(1)}
                    %
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
                    실수령액 {fmt(result.netPay)}원
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-red-400" />
                    공제합계 {fmt(result.totalEmployeeDeduction)}원
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Print button in results area */}
          <div className="flex justify-end print:hidden">
            <Button variant="outline" onClick={handlePrint}>
              결과 인쇄하기
            </Button>
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="text-xs text-gray-400 space-y-1 print:mt-8">
        <p>
          * 본 계산기는 2026년 기준 보험요율을 적용하며, 실제 급여명세서와 차이가
          있을 수 있습니다.
        </p>
        <p>
          * 소득세는 근로소득 간이세액표를 기반으로 추정하며, 연말정산 시
          달라질 수 있습니다.
        </p>
        <p>
          * 국민연금 기준소득월액 상한 6,370,000원 / 하한 400,000원이 적용됩니다.
        </p>
        <p>
          * 정확한 안내는 행정사, 노무사, 변호사 또는 관할 노동청에 문의하시기 바랍니다.
        </p>
      </div>

      {/* Print-only 어드미니 branding */}
      <div className="hidden print:block text-center mt-8 pt-4 border-t border-gray-200">
        <p className="text-[10px] text-gray-400">어드미니(Admini) | aiadminplatform.vercel.app</p>
      </div>
    </div>
  );
}
