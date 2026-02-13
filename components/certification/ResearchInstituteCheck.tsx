"use client";

import { useState, useEffect, useRef } from "react";
import { useClientStore } from "@/lib/store";

// ─── Types ───

type TargetType = "institute" | "department";
type EligibleStatus = "적격" | "부적격" | "조건부적격";

interface FormData {
  companyName: string;
  bizRegNo: string;
  businessSector: string;
  employeeCount: string;
  researcherCount: string;
  rndExpenditure: string;
  revenueYear1: string;
  researchFields: string;
  existingPatents: string;
  hasResearchInstitute: boolean;
  hasRndDepartment: boolean;
}

interface DiagnosisResult {
  eligible: EligibleStatus;
  targetType: TargetType;
  score: number;
  currentStatus: string;
  gaps: string[];
  requiredActions: string[];
  benefits: string[];
  taxBenefits: string[];
  estimatedTimeline: string;
}

const INITIAL_FORM: FormData = {
  companyName: "",
  bizRegNo: "",
  businessSector: "",
  employeeCount: "",
  researcherCount: "",
  rndExpenditure: "",
  revenueYear1: "",
  researchFields: "",
  existingPatents: "",
  hasResearchInstitute: false,
  hasRndDepartment: false,
};

const BUSINESS_SECTORS = [
  { value: "", label: "업종 선택" },
  { value: "제조업", label: "제조업" },
  { value: "정보통신업", label: "정보통신업 (IT/SW)" },
  { value: "전문과학기술서비스업", label: "전문/과학/기술 서비스업" },
  { value: "건설업", label: "건설업" },
  { value: "도소매업", label: "도소매업" },
  { value: "전기전자", label: "전기/전자" },
  { value: "바이오헬스", label: "바이오/헬스케어" },
  { value: "화학", label: "화학/소재" },
  { value: "기계", label: "기계/장비" },
  { value: "에너지환경", label: "에너지/환경" },
  { value: "농림수산식품", label: "농림수산식품" },
  { value: "기타", label: "기타" },
];

// ─── Number Formatting ───

function formatNumber(value: string): string {
  const num = value.replace(/[^\d]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
}

function parseNumber(formatted: string): string {
  return formatted.replace(/[^\d]/g, "");
}

// ─── Main Component ───

export default function ResearchInstituteCheck() {
  const { selectedClient } = useClientStore();
  const [targetType, setTargetType] = useState<TargetType>("institute");
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Auto-fill from company profile on mount
  useEffect(() => {
    if (selectedClient) return; // Skip if client is selected
    (async () => {
      try {
        const res = await fetch("/api/user/company-profile");
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.data) {
          const p = data.data;
          setForm((prev) => ({
            ...prev,
            companyName: p.companyName || prev.companyName,
            bizRegNo: p.bizRegNo || prev.bizRegNo,
            businessSector: p.businessSector || prev.businessSector,
            employeeCount: p.employeeCount ? String(p.employeeCount) : prev.employeeCount,
            researcherCount: p.researcherCount ? String(p.researcherCount) : prev.researcherCount,
            rndExpenditure: p.rndExpenditure ? String(p.rndExpenditure) : prev.rndExpenditure,
            revenueYear1: p.revenueYear1 ? String(p.revenueYear1) : prev.revenueYear1,
            hasResearchInstitute: p.hasResearchInstitute ?? prev.hasResearchInstitute,
            hasRndDepartment: p.hasRndDepartment ?? prev.hasRndDepartment,
          }));
        }
      } catch {
        // silent
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill from selectedClient
  useEffect(() => {
    if (!selectedClient) return;
    setForm((prev) => ({
      ...prev,
      companyName: selectedClient.companyName || prev.companyName,
      bizRegNo: selectedClient.bizRegNo || prev.bizRegNo,
      businessSector: selectedClient.businessSector || prev.businessSector,
      employeeCount: selectedClient.employeeCount ? String(selectedClient.employeeCount) : prev.employeeCount,
      researcherCount: selectedClient.researcherCount ? String(selectedClient.researcherCount) : prev.researcherCount,
      revenueYear1: selectedClient.revenueYear1 ? String(selectedClient.revenueYear1) : prev.revenueYear1,
      hasResearchInstitute: selectedClient.hasResearchInstitute ?? prev.hasResearchInstitute,
      hasRndDepartment: selectedClient.hasRndDepartment ?? prev.hasRndDepartment,
    }));
  }, [selectedClient]);

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleNumberChange = (field: keyof FormData, value: string) => {
    const raw = parseNumber(value);
    setForm((prev) => ({ ...prev, [field]: raw }));
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (!form.companyName.trim()) {
      setError("기업명을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        companyName: form.companyName,
        bizRegNo: form.bizRegNo,
        businessSector: form.businessSector,
        employeeCount: Number(form.employeeCount) || 0,
        researcherCount: Number(form.researcherCount) || 0,
        rndExpenditure: Number(form.rndExpenditure) || 0,
        revenueYear1: Number(form.revenueYear1) || 0,
        hasResearchInstitute: form.hasResearchInstitute,
        hasRndDepartment: form.hasRndDepartment,
        researchFields: form.researchFields,
        existingPatents: form.existingPatents,
        targetType,
      };

      const res = await fetch("/api/labor/research-institute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.result) {
        throw new Error(data.error || "진단 결과를 받지 못했습니다.");
      }

      setResult(data.result);

      // Scroll to result on mobile
      setTimeout(() => {
        if (resultRef.current && window.innerWidth < 1024) {
          resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const targetLabel = result.targetType === "institute" ? "기업부설연구소" : "연구개발전담부서";
    const text = `[${targetLabel} 적격성 진단 결과]
기업명: ${form.companyName}
진단 유형: ${targetLabel}
적격 여부: ${result.eligible} (${result.score}점)

[현재 상태 분석]
${result.currentStatus}

${result.gaps.length > 0 ? `[부족한 요건]\n${result.gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")}\n` : ""}
${result.requiredActions.length > 0 ? `[필요 조치]\n${result.requiredActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n` : ""}
[세제 혜택]
${result.taxBenefits.map((t, i) => `${i + 1}. ${t}`).join("\n")}

[기타 혜택]
${result.benefits.map((b, i) => `${i + 1}. ${b}`).join("\n")}

[예상 소요기간]
${result.estimatedTimeline}

---
어드미니(Admini) | aiadminplatform.vercel.app`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setResult(null);
    setError("");
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tab Switcher */}
      <div className="flex gap-0 mb-6 border-b print:hidden">
        <button
          onClick={() => { setTargetType("institute"); setResult(null); setError(""); }}
          className={`relative px-5 py-3 text-sm font-medium transition-colors ${
            targetType === "institute"
              ? "text-purple-700 border-b-2 border-purple-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            기업부설연구소
          </div>
        </button>
        <button
          onClick={() => { setTargetType("department"); setResult(null); setError(""); }}
          className={`relative px-5 py-3 text-sm font-medium transition-colors ${
            targetType === "department"
              ? "text-purple-700 border-b-2 border-purple-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            연구개발전담부서
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Left Panel: Input Form ─── */}
        <div className="space-y-5 print:hidden">
          {/* 기업 기본정보 */}
          <SectionCard title="기업 기본정보" icon={buildingIcon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="기업명"
                value={form.companyName}
                onChange={(v) => handleChange("companyName", v)}
                placeholder="주식회사 어드미니"
                required
              />
              <InputField
                label="사업자등록번호"
                value={form.bizRegNo}
                onChange={(v) => handleChange("bizRegNo", v)}
                placeholder="000-00-00000"
              />
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">업종</label>
                <select
                  value={form.businessSector}
                  onChange={(e) => handleChange("businessSector", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
                >
                  {BUSINESS_SECTORS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>

          {/* 인력 현황 */}
          <SectionCard title="인력 현황" icon={usersIcon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="전체 직원수"
                value={form.employeeCount}
                onChange={(v) => handleChange("employeeCount", v.replace(/[^\d]/g, ""))}
                placeholder="50"
                suffix="명"
              />
              <InputField
                label="연구전담요원 수"
                value={form.researcherCount}
                onChange={(v) => handleChange("researcherCount", v.replace(/[^\d]/g, ""))}
                placeholder="5"
                suffix="명"
                required
              />
              <div className="sm:col-span-2 text-xs text-gray-500 bg-purple-50 rounded-lg p-3">
                {targetType === "institute" ? (
                  <p>
                    <strong className="text-purple-700">기업부설연구소</strong> 인정 기준: 벤처/소기업 3명+, 중기업 5명+, 중견기업 7명+, 대기업 10명+ (이공계 학사 이상 또는 기사 이상 자격 소지자)
                  </p>
                ) : (
                  <p>
                    <strong className="text-purple-700">연구개발전담부서</strong> 인정 기준: 소기업 1명+, 중소기업 2명+, 중견/대기업 3명+ (이공계 학사 이상 또는 기사 이상 자격 소지자)
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 재무 정보 */}
          <SectionCard title="재무 정보" icon={currencyIcon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="연간 R&D 투자액"
                value={form.rndExpenditure ? formatNumber(form.rndExpenditure) : ""}
                onChange={(v) => handleNumberChange("rndExpenditure", v)}
                placeholder="500,000,000"
                suffix="원"
              />
              <InputField
                label="최근 매출액"
                value={form.revenueYear1 ? formatNumber(form.revenueYear1) : ""}
                onChange={(v) => handleNumberChange("revenueYear1", v)}
                placeholder="10,000,000,000"
                suffix="원"
              />
            </div>
          </SectionCard>

          {/* 연구 활동 */}
          <SectionCard title="연구 활동" icon={labIcon}>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연구 분야
                </label>
                <textarea
                  value={form.researchFields}
                  onChange={(e) => handleChange("researchFields", e.target.value)}
                  placeholder="예: AI/머신러닝 기반 행정 자동화, 자연어처리(NLP), 문서 OCR 기술 등"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기존 특허/지식재산
                </label>
                <textarea
                  value={form.existingPatents}
                  onChange={(e) => handleChange("existingPatents", e.target.value)}
                  placeholder="예: 특허 2건 (출원 중 1건, 등록 1건), 소프트웨어 저작권 3건"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                />
              </div>
            </div>
          </SectionCard>

          {/* 현재 보유 현황 */}
          <SectionCard title="현재 보유 현황" icon={checkIcon}>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasResearchInstitute}
                  onChange={(e) => handleChange("hasResearchInstitute", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">현재 기업부설연구소를 보유하고 있습니다</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasRndDepartment}
                  onChange={(e) => handleChange("hasRndDepartment", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">현재 연구개발전담부서를 보유하고 있습니다</span>
              </label>
            </div>
          </SectionCard>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>AI어드미니가 적격성을 진단 중입니다...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>적격성 진단</span>
              </>
            )}
          </button>
        </div>

        {/* ─── Right Panel: Result ─── */}
        <div ref={resultRef} className="lg:sticky lg:top-6 lg:self-start">
          {result ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              {/* Result Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <h3 className="text-sm font-semibold text-gray-900">진단 결과</h3>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        복사됨
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        복사
                      </>
                    )}
                  </button>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    인쇄
                  </button>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    다시 진단
                  </button>
                </div>
              </div>

              {/* Result Body */}
              <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                {/* Eligibility Badge + Score */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <EligibilityBadge status={result.eligible} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {result.targetType === "institute" ? "기업부설연구소" : "연구개발전담부서"}
                      </p>
                      <p className="text-xs text-gray-500">{form.companyName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <ScoreCircle score={result.score} />
                  </div>
                </div>

                {/* Current Status */}
                <ResultSection title="현재 상태 분석" icon={infoIcon} color="purple">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {result.currentStatus}
                  </p>
                </ResultSection>

                {/* Gaps */}
                {result.gaps.length > 0 && (
                  <ResultSection title="부족한 요건" icon={warningIcon} color="amber">
                    <ul className="space-y-2">
                      {result.gaps.map((gap, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold mt-0.5">
                            {i + 1}
                          </span>
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}

                {/* Required Actions */}
                {result.requiredActions.length > 0 && (
                  <ResultSection title="필요 조치" icon={actionIcon} color="blue">
                    <ul className="space-y-2">
                      {result.requiredActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold mt-0.5">
                            {i + 1}
                          </span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}

                {/* Tax Benefits */}
                {result.taxBenefits.length > 0 && (
                  <ResultSection title="세제 혜택" icon={taxIcon} color="emerald">
                    <ul className="space-y-2">
                      {result.taxBenefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}

                {/* Other Benefits */}
                {result.benefits.length > 0 && (
                  <ResultSection title="기타 혜택" icon={giftIcon} color="indigo">
                    <ul className="space-y-2">
                      {result.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}

                {/* Estimated Timeline */}
                <ResultSection title="예상 소요기간" icon={clockIcon} color="gray">
                  <p className="text-sm text-gray-700">{result.estimatedTimeline}</p>
                </ResultSection>

                {/* Print branding */}
                <div className="hidden print:block text-center mt-6 pt-4 border-t border-gray-200">
                  <p className="text-[10px] text-gray-400">어드미니(Admini) | aiadminplatform.vercel.app</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                {isLoading ? (
                  <>
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                      <svg className="animate-spin h-8 w-8 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">AI어드미니가 적격성을 진단 중입니다...</h3>
                    <p className="text-sm text-gray-500">
                      기초연구진흥법 및 KOITA 인정 기준을 분석하고 있습니다
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {targetType === "institute" ? "기업부설연구소" : "연구개발전담부서"} 적격성 진단
                    </h3>
                    <p className="text-sm text-gray-500 max-w-sm mb-6">
                      왼쪽 양식을 작성한 후 &quot;적격성 진단&quot; 버튼을 클릭하면 AI가 KOITA 인정 기준에 따라 진단 결과를 제공합니다.
                    </p>

                    {/* Comparison Info */}
                    <div className="w-full max-w-md">
                      <div className="grid grid-cols-2 gap-3 text-left">
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                          <h4 className="text-xs font-bold text-purple-800 mb-2">기업부설연구소</h4>
                          <ul className="space-y-1.5 text-xs text-purple-700">
                            <li className="flex items-start gap-1.5">
                              <span className="text-purple-400 mt-0.5">-</span>
                              <span>연구전담요원 3~10명+</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-purple-400 mt-0.5">-</span>
                              <span>독립 연구 공간 필수</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-purple-400 mt-0.5">-</span>
                              <span>병역특례 연구요원 가능</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-purple-400 mt-0.5">-</span>
                              <span>R&amp;D 세액공제 최대 25%</span>
                            </li>
                          </ul>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <h4 className="text-xs font-bold text-gray-700 mb-2">연구개발전담부서</h4>
                          <ul className="space-y-1.5 text-xs text-gray-600">
                            <li className="flex items-start gap-1.5">
                              <span className="text-gray-400 mt-0.5">-</span>
                              <span>연구전담요원 1~3명+</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-gray-400 mt-0.5">-</span>
                              <span>독립 공간 불요</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-gray-400 mt-0.5">-</span>
                              <span>조직도에 부서 명시 필요</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-gray-400 mt-0.5">-</span>
                              <span>연구소 전환 가능 (추후)</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <InfoBadge text="KOITA(한국산업기술진흥협회) 인정 기준 적용" />
                        <InfoBadge text="기초연구진흥 및 기술개발지원에 관한 법률 근거" />
                        <InfoBadge text="세제 혜택 및 필요 조치사항 분석" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Sub-Components ───

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
        {icon}
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  className,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
  suffix?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white ${suffix ? "pr-10" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function EligibilityBadge({ status }: { status: EligibleStatus }) {
  const config = {
    "적격": { bg: "bg-green-100", text: "text-green-800", border: "border-green-200", dot: "bg-green-500" },
    "부적격": { bg: "bg-red-100", text: "text-red-800", border: "border-red-200", dot: "bg-red-500" },
    "조건부적격": { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-500" },
  }[status] || { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200", dot: "bg-gray-500" };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  const bgColor = score >= 80 ? "bg-green-50 border-green-200" : score >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center ${bgColor}`}>
      <span className={`text-lg font-bold leading-none ${color}`}>{score}</span>
      <span className="text-[9px] text-gray-500 leading-none mt-0.5">점</span>
    </div>
  );
}

function ResultSection({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  const borderColors: Record<string, string> = {
    purple: "border-l-purple-400",
    amber: "border-l-amber-400",
    blue: "border-l-blue-400",
    emerald: "border-l-emerald-400",
    indigo: "border-l-indigo-400",
    gray: "border-l-gray-400",
  };

  return (
    <div className={`border-l-3 ${borderColors[color] || "border-l-gray-400"} pl-4`} style={{ borderLeftWidth: "3px" }}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function InfoBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

// ─── Icons ───

const buildingIcon = (
  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const usersIcon = (
  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const currencyIcon = (
  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const labIcon = (
  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

const checkIcon = (
  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const infoIcon = (
  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const warningIcon = (
  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const actionIcon = (
  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const taxIcon = (
  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
  </svg>
);

const giftIcon = (
  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
);

const clockIcon = (
  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
