"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ───

type ContractType = "regular" | "contract" | "parttime";

interface FormData {
  // 사업주 정보
  companyName: string;
  ownerName: string;
  bizRegNo: string;
  companyAddress: string;
  // 근로자 정보
  workerName: string;
  workerBirth: string;
  workerAddress: string;
  workerPhone: string;
  // 계약 조건
  contractType: ContractType;
  contractStart: string;
  contractEnd: string;
  workplace: string;
  jobDescription: string;
  // 근무 조건
  workStartTime: string;
  workEndTime: string;
  breakTime: string;
  workDaysPerWeek: number;
  weeklyWorkHours: number;
  // 급여 조건
  monthlySalary: string;
  hourlyWage: string;
  payDay: number;
  overtimeRate: string;
  bonusInfo: string;
  // 기타
  probationPeriod: string;
  specialTerms: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    contractText: string;
    metadata: Record<string, unknown>;
  };
  error?: string;
}

const INITIAL_FORM: FormData = {
  companyName: "",
  ownerName: "",
  bizRegNo: "",
  companyAddress: "",
  workerName: "",
  workerBirth: "",
  workerAddress: "",
  workerPhone: "",
  contractType: "regular",
  contractStart: "",
  contractEnd: "",
  workplace: "",
  jobDescription: "",
  workStartTime: "09:00",
  workEndTime: "18:00",
  breakTime: "12:00~13:00",
  workDaysPerWeek: 5,
  weeklyWorkHours: 40,
  monthlySalary: "",
  hourlyWage: "",
  payDay: 25,
  overtimeRate: "통상임금의 150%",
  bonusInfo: "",
  probationPeriod: "",
  specialTerms: "",
};

const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  { value: "regular", label: "정규직" },
  { value: "contract", label: "계약직" },
  { value: "parttime", label: "단시간근로자" },
];

// ─── Main Page ───

export default function LaborContractPage() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [contractText, setContractText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Auto-fill 사업주 정보 from company profile
  useEffect(() => {
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
            ownerName: p.ownerName || prev.ownerName,
            bizRegNo: p.bizRegNo || prev.bizRegNo,
            companyAddress: p.address || prev.companyAddress,
          }));
        }
      } catch {
        // Silently fail - user can fill manually
      }
    })();
  }, []);

  const handleChange = (field: keyof FormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleContractTypeChange = (type: ContractType) => {
    setForm((prev) => ({
      ...prev,
      contractType: type,
      contractEnd: type === "regular" ? "" : prev.contractEnd,
    }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.workerName.trim()) {
      setError("근로자 이름을 입력해주세요.");
      return;
    }
    if (!form.contractType) {
      setError("계약 유형을 선택해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setContractText("");

    try {
      const res = await fetch("/api/labor/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `서버 오류 (${res.status})`);
      }

      const data: ApiResponse = await res.json();
      if (!data.success || !data.data?.contractText) {
        throw new Error(data.error || "계약서 생성에 실패했습니다.");
      }

      setContractText(data.data.contractText);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contractText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = contractText;
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
    setContractText("");
    setError("");
  };

  const isParttime = form.contractType === "parttime";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">근로계약서 AI</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                AI어드미니가 근로기준법을 준수하는 표준근로계약서를 작성합니다
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Left Panel: Input Form ─── */}
          <div className="space-y-5 print:hidden">
            {/* 사업주 정보 */}
            <SectionCard title="사업주 정보" icon={buildingIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="회사명"
                  value={form.companyName}
                  onChange={(v) => handleChange("companyName", v)}
                  placeholder="주식회사 어드미니"
                />
                <InputField
                  label="대표자명"
                  value={form.ownerName}
                  onChange={(v) => handleChange("ownerName", v)}
                  placeholder="홍길동"
                />
                <InputField
                  label="사업자등록번호"
                  value={form.bizRegNo}
                  onChange={(v) => handleChange("bizRegNo", v)}
                  placeholder="000-00-00000"
                />
                <InputField
                  label="사업장 소재지"
                  value={form.companyAddress}
                  onChange={(v) => handleChange("companyAddress", v)}
                  placeholder="서울특별시 강남구..."
                  className="sm:col-span-2"
                />
              </div>
            </SectionCard>

            {/* 근로자 정보 */}
            <SectionCard title="근로자 정보" icon={userIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="근로자 성명"
                  value={form.workerName}
                  onChange={(v) => handleChange("workerName", v)}
                  placeholder="김철수"
                  required
                />
                <InputField
                  label="생년월일"
                  type="date"
                  value={form.workerBirth}
                  onChange={(v) => handleChange("workerBirth", v)}
                />
                <InputField
                  label="주소"
                  value={form.workerAddress}
                  onChange={(v) => handleChange("workerAddress", v)}
                  placeholder="서울특별시 서초구..."
                  className="sm:col-span-2"
                />
                <InputField
                  label="연락처"
                  value={form.workerPhone}
                  onChange={(v) => handleChange("workerPhone", v)}
                  placeholder="010-0000-0000"
                />
              </div>
            </SectionCard>

            {/* 계약 조건 */}
            <SectionCard title="계약 조건" icon={clipboardIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계약 유형 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.contractType}
                    onChange={(e) => handleContractTypeChange(e.target.value as ContractType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    {CONTRACT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="계약 시작일"
                  type="date"
                  value={form.contractStart}
                  onChange={(v) => handleChange("contractStart", v)}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계약 종료일
                  </label>
                  <input
                    type="date"
                    value={form.contractEnd}
                    onChange={(e) => handleChange("contractEnd", e.target.value)}
                    disabled={form.contractType === "regular"}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                      form.contractType === "regular" ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white"
                    }`}
                  />
                  {form.contractType === "regular" && (
                    <p className="text-xs text-gray-400 mt-1">정규직은 종료일이 없습니다</p>
                  )}
                </div>
                <InputField
                  label="근무 장소"
                  value={form.workplace}
                  onChange={(v) => handleChange("workplace", v)}
                  placeholder="본사 사무실"
                  className="sm:col-span-2"
                />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    업무 내용
                  </label>
                  <textarea
                    value={form.jobDescription}
                    onChange={(e) => handleChange("jobDescription", e.target.value)}
                    placeholder="담당 업무 내용을 입력하세요"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                </div>
              </div>
            </SectionCard>

            {/* 근무 조건 */}
            <SectionCard title="근무 조건" icon={clockIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="근무 시작시간"
                  type="time"
                  value={form.workStartTime}
                  onChange={(v) => handleChange("workStartTime", v)}
                />
                <InputField
                  label="근무 종료시간"
                  type="time"
                  value={form.workEndTime}
                  onChange={(v) => handleChange("workEndTime", v)}
                />
                <InputField
                  label="휴게시간"
                  value={form.breakTime}
                  onChange={(v) => handleChange("breakTime", v)}
                  placeholder="12:00~13:00"
                />
                <InputField
                  label="주당 근무일수"
                  type="number"
                  value={String(form.workDaysPerWeek)}
                  onChange={(v) => handleChange("workDaysPerWeek", Number(v))}
                  min={1}
                  max={7}
                />
                <InputField
                  label="주당 근무시간"
                  type="number"
                  value={String(form.weeklyWorkHours)}
                  onChange={(v) => handleChange("weeklyWorkHours", Number(v))}
                  min={1}
                  max={52}
                />
              </div>
            </SectionCard>

            {/* 급여 조건 */}
            <SectionCard title="급여 조건" icon={currencyIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isParttime ? (
                  <InputField
                    label="시급 (원)"
                    type="number"
                    value={form.hourlyWage}
                    onChange={(v) => handleChange("hourlyWage", v)}
                    placeholder="9,860"
                    className="sm:col-span-2"
                  />
                ) : (
                  <InputField
                    label="월급 (원)"
                    type="number"
                    value={form.monthlySalary}
                    onChange={(v) => handleChange("monthlySalary", v)}
                    placeholder="3,000,000"
                    className="sm:col-span-2"
                  />
                )}
                <InputField
                  label="급여 지급일 (매월)"
                  type="number"
                  value={String(form.payDay)}
                  onChange={(v) => handleChange("payDay", Number(v))}
                  min={1}
                  max={31}
                />
                <InputField
                  label="연장근로수당"
                  value={form.overtimeRate}
                  onChange={(v) => handleChange("overtimeRate", v)}
                  placeholder="통상임금의 150%"
                />
                <InputField
                  label="상여금 정보"
                  value={form.bonusInfo}
                  onChange={(v) => handleChange("bonusInfo", v)}
                  placeholder="연 400% (분기별 100%)"
                  className="sm:col-span-2"
                />
              </div>
            </SectionCard>

            {/* 기타 */}
            <SectionCard title="기타 사항" icon={dotsIcon}>
              <div className="grid grid-cols-1 gap-4">
                <InputField
                  label="수습 기간"
                  value={form.probationPeriod}
                  onChange={(v) => handleChange("probationPeriod", v)}
                  placeholder="3개월"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    특약 사항
                  </label>
                  <textarea
                    value={form.specialTerms}
                    onChange={(e) => handleChange("specialTerms", e.target.value)}
                    placeholder="추가 약정 사항이 있으면 입력하세요"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                </div>
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
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>AI어드미니가 계약서를 작성 중입니다...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>AI어드미니 계약서 생성</span>
                </>
              )}
            </button>
          </div>

          {/* ─── Right Panel: Preview / Result ─── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            {contractText ? (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                {/* Preview Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <h3 className="text-sm font-semibold text-gray-900">생성된 근로계약서</h3>
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
                          텍스트 복사
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      다시 생성
                    </button>
                  </div>
                </div>
                {/* Contract Document Preview */}
                <div
                  ref={previewRef}
                  className="p-6 sm:p-8 max-h-[80vh] overflow-y-auto"
                >
                  <div className="bg-white border border-gray-300 rounded p-6 sm:p-8 shadow-inner font-serif text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap">
                    {contractText}
                  </div>
                  {/* 인쇄 시에만 보이는 어드미니 브랜딩 */}
                  <div className="hidden print:block text-center mt-8 pt-4 border-t border-gray-200">
                    <p className="text-[10px] text-gray-400">어드미니(Admini) | aiadminplatform.vercel.app</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                  {isLoading ? (
                    <>
                      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">AI어드미니가 계약서를 작성 중입니다...</h3>
                      <p className="text-sm text-gray-500">
                        근로기준법 및 관련 법령을 검토하고 있습니다
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">계약서 미리보기</h3>
                      <p className="text-sm text-gray-500 max-w-xs">
                        왼쪽 양식을 작성한 후 &quot;AI 계약서 생성&quot; 버튼을 클릭하면<br />
                        이곳에 생성된 근로계약서가 표시됩니다.
                      </p>
                      <div className="mt-6 space-y-2 text-left w-full max-w-xs">
                        <InfoBadge text="근로기준법 준수 표준 양식" />
                        <InfoBadge text="계약 유형별 맞춤 조항 자동 생성" />
                        <InfoBadge text="근로자 보호 필수 조항 포함" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
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
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
      />
    </div>
  );
}

function InfoBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

// ─── Icons ───

const buildingIcon = (
  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const userIcon = (
  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const clipboardIcon = (
  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const clockIcon = (
  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const currencyIcon = (
  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const dotsIcon = (
  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
  </svg>
);
